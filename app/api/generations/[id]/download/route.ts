import { NextResponse } from "next/server";
import { getGenerationStoragePathForUser, purgeExpiredGenerations } from "../../../../../lib/generations/service";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

function inferMimeTypeFromPath(path: string) {
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/png";
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ status: "error", code: "UNAUTHENTICATED", message: "Please login to continue." }, { status: 401 });
    }

    const { id } = await context.params;
    const admin = createSupabaseAdminClient();
    await purgeExpiredGenerations(admin, user.id);

    const storagePath = await getGenerationStoragePathForUser(admin, user.id, id);

    if (!storagePath) {
      return NextResponse.json({ status: "error", code: "NOT_FOUND", message: "Image not found." }, { status: 404 });
    }

    const download = await admin.storage.from(process.env.SUPABASE_GENERATIONS_BUCKET || "generated-images").download(storagePath);

    if (download.error || !download.data) {
      return NextResponse.json(
        {
          status: "error",
          code: "DOWNLOAD_FAILED",
          message: download.error?.message || "Failed to download image"
        },
        { status: 500 }
      );
    }

    const arrayBuffer = await download.data.arrayBuffer();
    const filename = `gele-ai-${id}.png`;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": inferMimeTypeFromPath(storagePath),
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
