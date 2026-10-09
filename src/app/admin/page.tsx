import type { Metadata } from "next";
import Link from "next/link";
import LogoutButton from "@/components/admin/LogoutButton";
import UploadForm from "@/components/admin/UploadForm";
import IndexPanel from "@/components/admin/IndexPanel";
import { indexingStats, listIssues, listPublications } from "@/lib/db/queries";
import { formatDate, todayISO } from "@/lib/format";

export const metadata: Metadata = {
  title: "ਨਿਊਜ਼ਰੂਮ",
  robots: { index: false, follow: false },
};

/** Always fresh: this is behind a session and shows upload state. */
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  ready: { label: "ਤਿਆਰ", cls: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200" },
  processing: { label: "ਚੱਲ ਰਿਹਾ", cls: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  failed: { label: "ਅਸਫਲ", cls: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" },
};

export default function AdminPage() {
  const publications = listPublications();
  const recent = listIssues({ limit: 30 });
  const today = todayISO();
  const publishedToday = recent.items.filter(
    (i) => i.publish_date === today && i.status === "ready",
  ).length;
  const complete = publishedToday >= publications.length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold text-ink">ਨਿਊਜ਼ਰੂਮ</h1>
          <p className="text-sm text-ink-faint">
            {formatDate(today)} · {publications.length} ਵਿੱਚੋਂ{" "}
            <strong className={complete ? "text-green-700 dark:text-green-400" : "text-accent-ink"}>
              {publishedToday}
            </strong>{" "}
            ਅਖ਼ਬਾਰ ਪ੍ਰਕਾਸ਼ਿਤ
          </p>
        </div>
        <div className="ms-auto flex items-center gap-3">
          <Link href="/" className="text-sm text-ink-soft underline">ਸਾਈਟ ਵੇਖੋ</Link>
          <LogoutButton />
        </div>
      </header>

      <UploadForm
        publications={publications.map((p) => ({
          slug: p.slug,
          name: p.name,
          name_local: p.name_local,
          // The matcher leans on region: the titles differ only by region, so
          // without it "Charhdikala Haryana" and "Charhdikala Delhi" are the
          // same string.
          region: p.region,
        }))}
        today={today}
      />

      <IndexPanel initial={indexingStats()} />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-ink-faint">ਹਾਲ ਦੇ ਅੰਕ</h2>
        {recent.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
            ਅਜੇ ਕੁਝ ਅਪਲੋਡ ਨਹੀਂ ਹੋਇਆ। ਉੱਪਰ ਪਹਿਲੀ PDF ਛੱਡੋ।
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-soft text-start">
                <tr>
                  <th className="px-3 py-2 text-start font-semibold text-ink">ਅਖ਼ਬਾਰ</th>
                  <th className="px-3 py-2 text-start font-semibold text-ink">ਤਰੀਕ</th>
                  <th className="px-3 py-2 text-start font-semibold text-ink">ਸਫ਼ੇ</th>
                  <th className="px-3 py-2 text-start font-semibold text-ink">ਹਾਲਤ</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {recent.items.map((i) => {
                  const s = STATUS[i.status] ?? { label: i.status, cls: "bg-surface-soft text-ink" };
                  return (
                    <tr key={i.id} className="border-t border-line">
                      <td className="px-3 py-2 text-ink">
                        {i.publication_name_local ?? i.publication_name}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-ink-soft">{i.publish_date}</td>
                      <td className="px-3 py-2 tabular-nums text-ink-soft">
                        {i.page_count || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                          {s.label}
                        </span>
                        {i.error && (
                          <span className="ms-2 text-xs text-accent-ink">{i.error}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-end">
                        {i.status === "ready" && (
                          <Link
                            href={`/${i.publication_slug}/${i.publish_date}/`}
                            className="text-xs text-ink-soft underline"
                          >
                            ਖੋਲ੍ਹੋ
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
