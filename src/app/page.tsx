import Link from "next/link";
import { listPublications, getLatestIssue } from "@/lib/db/queries";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const publications = listPublications();

  const cards = publications.map((p) => ({
    ...p,
    latest: getLatestIssue(p.slug),
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
          ਚੜ੍ਹਦੀਕਲਾ ਈ-ਪੇਪਰ
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Choose a publication to read today&apos;s edition or browse the archive.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map((p) => (
          <li key={p.id}>
            <Link
              href={`/${p.slug}/`}
              className="block rounded-xl border border-neutral-200 p-4 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
            >
              <span className="block font-semibold text-neutral-900 dark:text-neutral-50">
                {p.name_local ?? p.name}
              </span>
              <span className="mt-0.5 block text-xs text-neutral-500">
                {p.name}
                {p.region ? ` · ${p.region}` : ""}
              </span>
              <span className="mt-2 block text-xs text-neutral-600 dark:text-neutral-400">
                {p.latest
                  ? `Latest: ${formatDate(p.latest.publish_date, p.language)}`
                  : "No editions yet"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
