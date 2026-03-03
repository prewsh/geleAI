import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { resolveTransformProvider } from "../../../lib/ai/provider";
import { ProviderError } from "../../../lib/ai/types";
import { checkRateLimit, getRateLimitKey } from "../../../lib/server/rate-limit";
import { TransformResponsePayload } from "../../../lib/transform/types";
import { parseTransformFormData, ValidationError } from "../../../lib/transform/validation";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 6;
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
    const formData = await request.formData();
    const input = await parseTransformFormData(formData);

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

    const payload: TransformResponsePayload = {
      jobId: randomUUID(),
      status: "completed",
      outputImageUrl: `data:${result.mimeType};base64,${result.imageBase64}`,
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
        message: "Unexpected server error while transforming image.",
        requestId
      },
      { status: 500 }
    );
    return withRequestId(response, requestId);
  }
}
