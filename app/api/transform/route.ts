import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { resolveTransformProvider } from "../../../lib/ai/provider";
import { ProviderError } from "../../../lib/ai/types";
import { getUserFreeGenerationsToday, listActiveUserGenerations, purgeExpiredGenerations, storeGenerationAndCreateSignedUrl } from "../../../lib/generations/service";
import { checkRateLimit, getRateLimitKey } from "../../../lib/server/rate-limit";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { TransformResponsePayload } from "../../../lib/transform/types";
import { parseTransformFormData, ValidationError } from "../../../lib/transform/validation";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 6;
const FREE_DAILY_LIMIT = 3;
const TRANSIENT_PROVIDER_CODES = new Set(["TRANSIENT_PROVIDER_FAILURE"]);

function withRequestId(response: NextResponse, requestId: string) {
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = randomUUID();

  const rateLimit = checkRateLimit({
    key: getRateLimitKey(request),
    limit: RATE_LIMIT_MAX_REQUESTS,
    windowMs: RATE_LIMIT_WINDOW_MS
  });

  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      {
        status: "error",
        code: "RATE_LIMITED",
        message: `Too many requests. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        requestId
      },
      { status: 429 }
    );
    response.headers.set("retry-after", String(rateLimit.retryAfterSeconds));
    response.headers.set("x-ratelimit-limit", String(RATE_LIMIT_MAX_REQUESTS));
    response.headers.set("x-ratelimit-remaining", "0");
    return withRequestId(response, requestId);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      const response = NextResponse.json(
        {
          status: "error",
          code: "UNAUTHENTICATED",
          message: "Please login to continue.",
          requestId
        },
        { status: 401 }
      );
      return withRequestId(response, requestId);
    }

    const formData = await request.formData();
    const input = await parseTransformFormData(formData);

    const supabaseAdmin = createSupabaseAdminClient();

    await purgeExpiredGenerations(supabaseAdmin, user.id);

    const usage = await getUserFreeGenerationsToday(supabaseAdmin, user.id, input.clientTimeZone);

    if (usage.count >= FREE_DAILY_LIMIT) {
      const response = NextResponse.json(
        {
          status: "error",
          code: "FREE_DAILY_LIMIT_REACHED",
          message: "Daily free generation limit reached.",
          retryAfterSeconds: usage.retryAfterSeconds,
          requestId
        },
        { status: 429 }
      );
      response.headers.set("retry-after", String(usage.retryAfterSeconds));
      return withRequestId(response, requestId);
    }

    const provider = resolveTransformProvider();
    let result;

    try {
      result = await provider.transformPortrait(input);
    } catch (error) {
      if (error instanceof ProviderError && TRANSIENT_PROVIDER_CODES.has(error.code)) {
        result = await provider.transformPortrait(input);
      } else {
        throw error;
      }
    }

    const stored = await storeGenerationAndCreateSignedUrl(supabaseAdmin, {
      userId: user.id,
      prompt: input.stylePrompt,
      geleColor: input.geleColor,
      base64Image: result.imageBase64,
      mimeType: result.mimeType,
      model: result.model,
      durationMs: Date.now() - startedAt,
      usageDay: usage.usageDay
    });

    const payload: TransformResponsePayload = {
      jobId: stored.generationId,
      status: "completed",
      outputImageUrl: stored.signedUrl,
      meta: {
        provider: "gemini",
        durationMs: Date.now() - startedAt,
        model: result.model
      }
    };

    const response = NextResponse.json(payload, { status: 200 });
    response.headers.set("x-ratelimit-limit", String(RATE_LIMIT_MAX_REQUESTS));
    response.headers.set("x-ratelimit-remaining", String(rateLimit.remaining));
    response.headers.set("x-ratelimit-reset", String(rateLimit.resetAt));
    return withRequestId(response, requestId);
  } catch (error) {
    if (error instanceof ValidationError) {
      const response = NextResponse.json(
        {
          status: "error",
          code: error.code,
          message: error.message,
          requestId
        },
        { status: 400 }
      );
      return withRequestId(response, requestId);
    }

    if (error instanceof ProviderError) {
      const response = NextResponse.json(
        {
          status: "error",
          code: error.code,
          message: error.message,
          requestId
        },
        { status: error.statusCode }
      );
      return withRequestId(response, requestId);
    }

    const response = NextResponse.json(
      {
        status: "error",
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unexpected server error while transforming image.",
        requestId
      },
      { status: 500 }
    );
    return withRequestId(response, requestId);
  }
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ status: "error", code: "UNAUTHENTICATED", message: "Please login to continue." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    await purgeExpiredGenerations(admin, user.id);
    const images = await listActiveUserGenerations(admin, user.id);

    return NextResponse.json({ status: "ok", data: images });
  } catch (error) {
    return NextResponse.json(
      { status: "error", code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
