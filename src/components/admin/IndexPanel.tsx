"use client";

import { useState } from "react";

type Stats = Record<string, number>;

const LABELS: Record<string, string> = {
  pending: "ਉਡੀਕ ਵਿੱਚ",
  working: "ਚੱਲ ਰਿਹਾ",
  indexed: "ਹੋ ਗਿਆ",
  skipped: "ਛੱਡਿਆ",
  failed: "ਅਸਫਲ",
};

/**
 * Shows whether the archive is actually searchable.
 *
 * Text indexing happens behind publishing, so without this the newsroom has no
 * way to tell a page that is merely waiting from one that failed and will
 * never be found.
 */
export default function IndexPanel({ initial }: { initial: Stats }) {
  const [stats, setStats] = useState<Stats>(initial);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const res = await fetch("/api/admin/reindex/", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setStats(data.stats ?? {});
      setRunning(Boolean(data.running));
    } catch {
      /* a failed poll is not worth surfacing */
    }
  };

  const requeue = async (all: boolean) => {
    setBusy(true);
    try {
      await fetch(`/api/admin/reindex/${all ? "?all=1" : ""}`, { method: "POST" });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const done = stats.indexed ?? 0;

  return (
    <section className="mt-8 rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-bold text-ink">ਖੋਜ ਸੂਚੀ</h2>
        {running && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            ਚੱਲ ਰਿਹਾ ਹੈ
          </span>
        )}
        <div className="ms-auto flex gap-3">
          <button type="button" onClick={refresh} className="text-xs text-ink-soft underline">
            ਤਾਜ਼ਾ ਕਰੋ
          </button>
          <button type="button" onClick={() => requeue(false)} disabled={busy}
            className="text-xs text-ink-soft underline disabled:opacity-50">
            ਅਸਫਲ ਦੁਬਾਰਾ
          </button>
          <button type="button" onClick={() => requeue(true)} disabled={busy}
            className="text-xs text-ink-soft underline disabled:opacity-50">
            ਸਭ ਦੁਬਾਰਾ
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-ink-faint">
        {total} ਵਿੱਚੋਂ {done} ਅੰਕ ਖੋਜੇ ਜਾ ਸਕਦੇ ਹਨ
      </p>

      <ul className="mt-3 flex flex-wrap gap-2">
        {Object.entries(stats).map(([k, n]) => (
          <li key={k} className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft">
            {LABELS[k] ?? k}: <span className="tabular-nums font-medium">{n}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-ink-faint">
        ਅਖ਼ਬਾਰ ਪਹਿਲਾਂ ਪੜ੍ਹਨ ਲਈ ਤਿਆਰ ਹੁੰਦਾ ਹੈ, ਖੋਜ ਕੁਝ ਮਿੰਟਾਂ ਬਾਅਦ ਚਾਲੂ ਹੁੰਦੀ ਹੈ।
      </p>
    </section>
  );
}
