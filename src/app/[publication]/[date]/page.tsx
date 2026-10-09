import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageViewer, { type ViewerPage } from "@/components/PageViewer";
import { getIssue, getPublicationBySlug, listPages } from "@/lib/db/queries";
import { storage } from "@/lib/storage";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ publication: string; date: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publication, date } = await params;
  const issue = getIssue(publication, date);
  if (!issue) return { title: "Edition not found" };
  const title = `${issue.publication_name_local ?? issue.publication_name} — ${formatDate(date, issue.publication_language)}`;
  return {
    title,
    description: `Read the ${issue.publication_name} edition of ${formatDate(date, "en")}.`,
    openGraph: { title, type: "article" },
  };
}

export default async function EditionPage({ params, searchParams }: Props) {
  const { publication, date } = await params;
  const { page: requestedPage } = await searchParams;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  if (!getPublicationBySlug(publication)) notFound();

  const issue = getIssue(publication, date);
  if (!issue) notFound();

  if (issue.status !== "ready") {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-xl font-bold">
          {issue.status === "processing" ? "ਤਿਆਰ ਹੋ ਰਿਹਾ ਹੈ" : "ਇਹ ਐਡੀਸ਼ਨ ਉਪਲਬਧ ਨਹੀਂ"}
        </h1>
        <p className="mt-2 text-sm text-ink-faint">
          {issue.status === "processing"
            ? "This edition is still being prepared. Please check back shortly."
            : "This edition could not be published. The newsroom has been notified."}
        </p>
        <Link href={`/${publication}/`} className="mt-6 inline-block text-sm underline">
          Back to latest edition
        </Link>
      </main>
    );
  }

  const store = storage();
  const pages: ViewerPage[] = listPages(issue.id).map((p) => ({
    id: p.id,
    number: p.page_number,
    width: p.width,
    height: p.height,
    read: store.url(`${p.storage_prefix}/read.webp`),
    full: store.url(`${p.storage_prefix}/full.webp`),
    thumb: store.url(`${p.storage_prefix}/thumb.webp`),
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <nav className="mb-4 text-xs text-ink-faint">
        <Link href="/" className="underline">ਸਾਰੇ ਅਖ਼ਬਾਰ</Link>
        <span className="mx-1.5">/</span>
        <span>{issue.publication_name_local ?? issue.publication_name}</span>
      </nav>

      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
        <h1 className="text-xl font-bold text-ink">
          {issue.publication_name_local ?? issue.publication_name}
        </h1>
        <div className="flex items-baseline gap-3">
          <p className="text-sm text-ink-faint">
            {formatDate(date, issue.publication_language)} · {issue.page_count} ਸਫ਼ੇ
          </p>
          <Link href={`/${publication}/archive/`} className="text-sm underline">
            ਪੁਰਾਣੇ ਅੰਕ
          </Link>
          {issue.source_key && (
            <a
              href={`/${publication}/${date}/download/`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-sm text-ink-soft transition-colors hover:border-brand-ink"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 3v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
              </svg>
              PDF
            </a>
          )}
        </div>
      </header>

      {/* A search hit links straight to the page it was found on. */}
      <PageViewer pages={pages} initialPage={Number(requestedPage) || 1} />
    </main>
  );
}
