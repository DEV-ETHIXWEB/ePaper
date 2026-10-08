import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublicationBySlug,
  issueDateRange,
  listAvailableDates,
} from "@/lib/db/queries";
import {
  formatMonth,
  monthGrid,
  monthOf,
  shiftMonth,
  todayISO,
  weekdayNames,
} from "@/lib/format";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ publication: string }>;
  searchParams: Promise<{ m?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publication } = await params;
  const pub = getPublicationBySlug(publication);
  if (!pub) return { title: "Not found" };
  return {
    title: `${pub.name} — archive`,
    description: `Browse past editions of ${pub.name} by date.`,
  };
}

export default async function ArchivePage({ params, searchParams }: Props) {
  const { publication } = await params;
  const { m } = await searchParams;

  const pub = getPublicationBySlug(publication);
  if (!pub) notFound();

  const range = issueDateRange(publication);
  const lang = pub.language;

  if (!range) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-xl font-bold">{pub.name_local ?? pub.name}</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          ਅਜੇ ਕੋਈ ਅੰਕ ਪ੍ਰਕਾਸ਼ਿਤ ਨਹੀਂ ਹੋਇਆ।
        </p>
        <Link href="/" className="mt-6 inline-block text-sm underline">ਘਰ</Link>
      </main>
    );
  }

  // An unparseable or out-of-range ?m= lands on the newest month rather than
  // an empty grid, because that value turns up in shared links and bookmarks.
  const newest = monthOf(range.last);
  const oldest = monthOf(range.first);
  const month =
    m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && m >= oldest && m <= newest ? m : newest;

  const available = new Set(listAvailableDates(publication, month));
  const cells = monthGrid(month);
  const today = todayISO();

  const prev = month > oldest ? shiftMonth(month, -1) : null;
  const next = month < newest ? shiftMonth(month, 1) : null;
  const weekdays = weekdayNames(lang);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <nav className="mb-4 text-xs text-neutral-500">
        <Link href="/" className="underline">ਸਾਰੇ ਅਖ਼ਬਾਰ</Link>
        <span className="mx-1.5">/</span>
        <Link href={`/${publication}/`} className="underline">
          {pub.name_local ?? pub.name}
        </Link>
        <span className="mx-1.5">/</span>
        <span>ਪੁਰਾਣੇ ਅੰਕ</span>
      </nav>

      <h1 className="mb-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
        {pub.name_local ?? pub.name}
      </h1>
      <p className="mb-5 text-sm text-neutral-600 dark:text-neutral-400">
        {available.size > 0
          ? `${formatMonth(month, lang)} ਵਿੱਚ ${available.size} ਅੰਕ`
          : `${formatMonth(month, lang)} ਵਿੱਚ ਕੋਈ ਅੰਕ ਨਹੀਂ`}
      </p>

      <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
        <div className="mb-3 flex items-center justify-between gap-2">
          {prev ? (
            <Link href={`/${publication}/archive/?m=${prev}`} rel="prev"
              aria-label={`${formatMonth(prev, lang)}`}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
              ←
            </Link>
          ) : (
            <span aria-hidden className="rounded-lg border border-transparent px-3 py-1.5 text-sm opacity-30">←</span>
          )}

          <h2 className="text-base font-semibold">{formatMonth(month, lang)}</h2>

          {next ? (
            <Link href={`/${publication}/archive/?m=${next}`} rel="next"
              aria-label={`${formatMonth(next, lang)}`}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
              →
            </Link>
          ) : (
            <span aria-hidden className="rounded-lg border border-transparent px-3 py-1.5 text-sm opacity-30">→</span>
          )}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdays.map((d) => (
            <div key={d} className="pb-1 text-[11px] font-medium text-neutral-500">{d}</div>
          ))}

          {cells.map((date, i) => {
            if (!date) return <div key={`blank-${i}`} />;
            const day = Number(date.slice(-2));
            const isToday = date === today;

            if (!available.has(date)) {
              return (
                <div key={date}
                  className={`flex h-11 items-center justify-center rounded-lg text-sm tabular-nums text-neutral-400 dark:text-neutral-600 ${
                    isToday ? "ring-1 ring-neutral-300 dark:ring-neutral-700" : ""
                  }`}>
                  {day}
                </div>
              );
            }

            return (
              <Link key={date} href={`/${publication}/${date}/`}
                className={`flex h-11 items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold tabular-nums text-white hover:bg-blue-700 ${
                  isToday ? "ring-2 ring-blue-300 dark:ring-blue-500" : ""
                }`}>
                {day}
              </Link>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        ਨੀਲੀ ਤਰੀਕ ਉੱਤੇ ਕਲਿੱਕ ਕਰ ਕੇ ਉਸ ਦਿਨ ਦਾ ਅਖ਼ਬਾਰ ਪੜ੍ਹੋ।
      </p>
    </main>
  );
}
