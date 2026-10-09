import Link from "next/link";
import { listPublications, getLatestIssue, listPages } from "@/lib/db/queries";
import { storage } from "@/lib/storage";
import { formatDate, todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const store = storage();
  const today = todayISO();

  // A newspaper stand shows front pages, not a list of names. The thumbnail
  // is the one that already exists for the page strip, so this costs nothing
  // extra to serve.
  const cards = listPublications().map((p) => {
    const latest = getLatestIssue(p.slug);
    const first = latest ? listPages(latest.id)[0] : null;
    return {
      ...p,
      latest,
      cover: first ? store.url(`${first.storage_prefix}/thumb.webp`) : null,
    };
  });

  const live = cards.filter((c) => c.latest);
  const pending = cards.filter((c) => !c.latest);

  // Grouped by masthead family. Nine titles in one flat grid reads as a pile;
  // grouped, a reader sees three families and picks their region.
  const groups: { name: string; items: typeof live }[] = [];
  for (const card of live) {
    const name = card.group_name ?? "";
    const found = groups.find((g) => g.name === name);
    if (found) found.items.push(card);
    else groups.push({ name, items: [card] });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-7">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">ਅੱਜ ਦੇ ਅਖ਼ਬਾਰ</h1>
        <p className="mt-1 text-sm text-ink-faint">
          {formatDate(today)} · ਕੋਈ ਵੀ ਅਖ਼ਬਾਰ ਚੁਣੋ ਜਾਂ ਪੁਰਾਣੇ ਅੰਕ ਵੇਖੋ
        </p>
      </header>

      {live.length === 0 && pending.length === 0 && (
        <p className="rounded-xl border border-line p-8 text-center text-sm text-ink-faint">
          ਅਜੇ ਕੋਈ ਅਖ਼ਬਾਰ ਨਹੀਂ ਜੋੜਿਆ ਗਿਆ।
        </p>
      )}

      {groups.map((group) => (
        <section key={group.name} className="mb-9">
          {group.name && (
            <h2 className="mb-3 border-b border-line pb-1.5 text-sm font-bold text-ink-soft">
              {group.name}
            </h2>
          )}
          <ul className="grid gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {group.items.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/${p.slug}/`}
                  className="group block rounded-xl border border-line bg-surface p-3 transition-colors hover:border-brand-ink"
                >
                  <div className="page-frame mb-3 overflow-hidden rounded-lg border border-line">
                    {p.cover ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={p.cover}
                        alt=""
                        width={320} height={452}
                        loading="lazy"
                        className="block aspect-[320/452] w-full bg-white object-cover object-top transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="aspect-[320/452] w-full" />
                    )}
                  </div>

                  <h3 className="font-bold leading-snug text-ink">
                    {p.name_local ?? p.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-faint">{p.region ?? p.name}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs">
                    {p.latest!.publish_date === today && (
                      <span className="rounded bg-accent px-1.5 py-0.5 font-semibold text-white">
                        ਅੱਜ
                      </span>
                    )}
                    <span className="text-ink-soft">
                      {formatDate(p.latest!.publish_date, p.language)}
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {pending.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-ink-faint">
            ਅਜੇ ਕੋਈ ਅੰਕ ਨਹੀਂ
          </h2>
          <ul className="flex flex-wrap gap-2">
            {pending.map((p) => (
              <li key={p.id}
                className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-faint">
                {p.name_local ?? p.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
