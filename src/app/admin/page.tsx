import type { Metadata } from "next";
import Link from "next/link";
import LogoutButton from "@/components/admin/LogoutButton";
import UploadForm from "@/components/admin/UploadForm";
import { listIssues, listPublications } from "@/lib/db/queries";
import { formatDate, todayISO } from "@/lib/format";

export const metadata: Metadata = {
  title: "ePaper newsroom",
  robots: { index: false, follow: false },
};

/** Always fresh: this is behind a session and shows upload state. */
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  ready: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  processing: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  failed: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

export default function AdminPage() {
  const publications = listPublications();
  const recent = listIssues({ limit: 30 });
  const today = todayISO();
  const todayCount = recent.items.filter(
    (i) => i.publish_date === today && i.status === "ready",
  ).length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center gap-3 border-b border-line pb-4 border-line">
        <div>
          <h1 className="text-xl font-bold">ePaper newsroom</h1>
          <p className="text-sm text-ink-faint">
            {todayCount} of {publications.length} editions published for {formatDate(today, "en")}
          </p>
        </div>
        <div className="ms-auto flex items-center gap-2">
          <Link href="/" className="text-sm underline">View site</Link>
          <LogoutButton />
        </div>
      </header>

      <UploadForm
        publications={publications.map((p) => ({
          slug: p.slug,
          name: p.name,
          name_local: p.name_local,
        }))}
        today={today}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-faint">
          Recent editions
        </h2>
        {recent.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint border-line">
            Nothing uploaded yet. Choose a publication above to publish the first edition.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-soft text-left bg-surface">
                <tr>
                  <th className="px-3 py-2 font-semibold">Publication</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Pages</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {recent.items.map((i) => (
                  <tr key={i.id} className="border-t border-line">
                    <td className="px-3 py-2">{i.publication_name_local ?? i.publication_name}</td>
                    <td className="px-3 py-2 tabular-nums">{i.publish_date}</td>
                    <td className="px-3 py-2 tabular-nums">{i.page_count || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[i.status]}`}>
                        {i.status}
                      </span>
                      {i.error && (
                        <span className="ms-2 text-xs text-red-700 dark:text-red-300">{i.error.slice(0, 60)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-end">
                      {i.status === "ready" && (
                        <Link href={`/${i.publication_slug}/${i.publish_date}/`}
                          className="text-xs underline" target="_blank">
                          open
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
