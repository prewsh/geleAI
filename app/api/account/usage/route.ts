import { NextResponse } from "next/server";
import { getUserFreeGenerationsToday, purgeExpiredGenerations } from "../../../../lib/generations/service";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

const FREE_DAILY_LIMIT = 3;

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ status: "error", code: "UNAUTHENTICATED", message: "Please login to continue." }, { status: 401 });
    }

    const url = new URL(request.url);
    const clientTimeZone = url.searchParams.get("tz") || "Africa/Lagos";

    const admin = createSupabaseAdminClient();
    await purgeExpiredGenerations(admin, user.id);

    const usage = await getUserFreeGenerationsToday(admin, user.id, clientTimeZone);

    return NextResponse.json({
      status: "ok",
      data: {
        limit: FREE_DAILY_LIMIT,
        used: usage.count,
        remaining: Math.max(0, FREE_DAILY_LIMIT - usage.count),
        retryAfterSeconds: usage.retryAfterSeconds
      }
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
