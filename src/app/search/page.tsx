import type { Metadata } from "next";
import Link from "next/link";
import {
  MIN_QUERY_LENGTH,
  listPublications,
  searchPages,
} from "@/lib/db/queries";
import { highlightSnippet } from "@/lib/highlight";
import { storage } from "@/lib/storage";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

export const metadata: Metadata = {
  title: "ਖੋਜ",
  description: "Search the full newspaper archive.",
};

interface Props {
  searchParams: Promise<{ q?: string; p?: string; page?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const pub = sp.p ?? "";
  const pageNum = Math.max(1, Number(sp.page) || 1);

  const publications = listPublications();
  const tooShort = q.length > 0 && q.length < MIN_QUERY_LENGTH;

  const { items, total } =
    q.length >= MIN_QUERY_LENGTH
      ? searchPages(q, {
          publicationSlug: pub || undefined,
          limit: PER_PAGE,
          offset: (pageNum - 1) * PER_PAGE,
        })
      : { items: [], total: 0 };

  const store = storage();
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const linkTo = (n: number) =>
    `/search/?q=${encodeURIComponent(q)}${pub ? `&p=${pub}` : ""}${n > 1 ? `&page=${n}` : ""}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <nav className="mb-4 text-xs text-neutral-500">
        <Link href="/" className="underline">ਸਾਰੇ ਅਖ਼ਬਾਰ</Link>
        <span className="mx-1.5">/</span>
        <span>ਖੋਜ</span>
      </nav>

      <h1 className="mb-4 text-xl font-bold text-neutral-900 dark:text-neutral-50">
        ਖ਼ਬਰਾਂ ਖੋਜੋ
      </h1>

      <form action="/search/" method="get" className="mb-6 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="ਸ਼ਬਦ ਲਿਖੋ, ਜਿਵੇਂ ਪਟਿਆਲਾ"
          aria-label="ਖੋਜ"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
        <select
          name="p"
          defaultValue={pub}
          aria-label="ਅਖ਼ਬਾਰ"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">ਸਾਰੇ ਅਖ਼ਬਾਰ</option>
          {publications.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name_local ?? p.name}
            </option>
          ))}
        </select>
        <button type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
          ਖੋਜੋ
        </button>
      </form>

      {tooShort && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          ਘੱਟੋ ਘੱਟ {MIN_QUERY_LENGTH} ਅੱਖਰ ਲਿਖੋ।
        </p>
      )}

      {q.length >= MIN_QUERY_LENGTH && (
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          {total > 0 ? `${total} ਸਫ਼ੇ ਮਿਲੇ` : "ਕੁਝ ਨਹੀਂ ਮਿਲਿਆ"}
        </p>
      )}

      <ol className="space-y-3">
        {items.map((hit) => (
          <li key={hit.page_id}
            className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <Link href={`/${hit.publication_slug}/${hit.publish_date}/?page=${hit.page_number}`}
              className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={store.url(`${hit.thumb_prefix}/thumb.webp`)} alt=""
                width={64} height={90} loading="lazy"
                className="h-[90px] w-16 shrink-0 rounded bg-white object-cover" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {hit.publication_name_local ?? hit.publication_name}
                </p>
                <p className="text-xs text-neutral-500">
                  {formatDate(hit.publish_date)} · ਸਫ਼ਾ {hit.page_number}
                </p>
                {/* Escaped in highlightSnippet; only its own <mark> survives. */}
                <p className="mt-1 line-clamp-3 text-sm text-neutral-700 [&_mark]:bg-yellow-200 [&_mark]:text-inherit dark:text-neutral-300 dark:[&_mark]:bg-yellow-600/50"
                  dangerouslySetInnerHTML={{ __html: highlightSnippet(hit.snippet) }} />
              </div>
            </Link>
          </li>
        ))}
      </ol>

      {lastPage > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm">
          {pageNum > 1 ? (
            <Link href={linkTo(pageNum - 1)} rel="prev" className="underline">← ਪਿੱਛੇ</Link>
          ) : <span />}
          <span className="text-neutral-500 tabular-nums">{pageNum} / {lastPage}</span>
          {pageNum < lastPage ? (
            <Link href={linkTo(pageNum + 1)} rel="next" className="underline">ਅੱਗੇ →</Link>
          ) : <span />}
        </nav>
      )}
    </main>
  );
}
