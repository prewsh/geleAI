import Link from "next/link";
import { redirect } from "next/navigation";
import { listActiveUserGenerations, purgeExpiredGenerations } from "../../lib/generations/service";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const admin = createSupabaseAdminClient();
  await purgeExpiredGenerations(admin, user.id);
  const images = await listActiveUserGenerations(admin, user.id);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 md:px-8">
      <div className="rounded-3xl border border-orange-100 bg-[var(--bg-panel)]/95 p-6 shadow-[0_24px_80px_rgba(190,95,35,0.14)] backdrop-blur md:p-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand)]">Dashboard</p>
            <h1 className="text-3xl leading-tight md:text-4xl">Your generated portraits</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Generated images stay available for 7 days, then are automatically deleted from your account and storage.
            </p>
          </div>
          <Link href="/" className="rounded-xl border border-orange-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-orange-50">
            Back to generator
          </Link>
        </div>

        {images.length === 0 ? (
          <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-6 text-sm text-[var(--muted)]">
            No generated images yet. Go back to the home page and run your first generation.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <article key={image.id} className="overflow-hidden rounded-2xl border border-orange-100 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.imageUrl} alt="Generated portrait" className="h-64 w-full object-cover" />
                <div className="space-y-1 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{image.geleColor || "auto"} gele</p>
                  <p className="line-clamp-2 text-sm text-[var(--ink)]">{image.prompt || "No prompt"}</p>
                  <p className="text-xs text-[var(--muted)]">Created: {new Date(image.createdAt).toLocaleString()}</p>
                  <p className="text-xs text-[var(--muted)]">Expires: {new Date(image.expiresAt).toLocaleString()}</p>
                  <a
                    href={`/api/generations/${image.id}/download`}
                    download={`gele-ai-${image.id}.png`}
                    className="mt-2 inline-block rounded-lg border border-orange-300 px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-orange-50"
                  >
                    Download image
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
