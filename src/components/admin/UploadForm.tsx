"use client";

import { useRouter } from "next/navigation";
import { useCallback, useId, useRef, useState } from "react";
import { guessFromFilename, type PubLike } from "@/lib/filename";

type RowStatus =
  | { kind: "ready" }
  | { kind: "uploading"; percent: number }
  | { kind: "rendering" }
  | { kind: "done"; pages: number; mb: number; secs: number }
  | { kind: "error"; message: string };

interface Row {
  id: string;
  file: File;
  slug: string;
  date: string;
  /** How sure the filename guess was, so a weak one can be flagged. */
  confidence: number;
  status: RowStatus;
}

const MAX_BYTES = 300 * 1024 * 1024;

/**
 * The morning upload.
 *
 * The newsroom publishes seven or eight editions every day, and their export
 * names each file after the paper and the date. So this takes a whole morning's
 * worth at once and reads both fields off each filename, rather than making
 * someone set a dropdown and a date picker eight times over.
 *
 * Every guess is shown and editable, and a weak one is called out, because the
 * cost of a silent wrong guess is an edition filed under the wrong masthead.
 */
export default function UploadForm({
  publications,
  today,
}: {
  publications: PubLike[];
  today: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const patch = useCallback((id: string, next: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }, []);

  const add = useCallback(
    (files: FileList | File[]) => {
      const accepted: Row[] = [];
      for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith(".pdf")) continue;
        const guess = guessFromFilename(file.name, publications);
        accepted.push({
          id: `${file.name}-${file.size}-${file.lastModified}`,
          file,
          slug: guess.slug ?? "",
          date: guess.date ?? today,
          confidence: guess.confidence,
          status:
            file.size === 0
              ? { kind: "error", message: "ਫ਼ਾਈਲ ਖ਼ਾਲੀ ਹੈ" }
              : file.size > MAX_BYTES
                ? { kind: "error", message: "300 MB ਤੋਂ ਵੱਡੀ ਹੈ" }
                : { kind: "ready" },
        });
      }
      // Keyed by name, size and mtime, so dropping the same batch twice does
      // not queue every edition a second time.
      setRows((rs) => {
        const seen = new Set(rs.map((r) => r.id));
        return [...rs, ...accepted.filter((r) => !seen.has(r.id))];
      });
    },
    [publications, today],
  );

  /** One at a time. Rendering a 16 page edition is CPU bound, and firing
   *  eight at once would make them all slow and risk the request timeout. */
  const uploadAll = async () => {
    setRunning(true);
    for (const row of rows) {
      if (row.status.kind === "done") continue;
      if (!row.slug || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
      await uploadOne(row);
    }
    setRunning(false);
    router.refresh();
  };

  const uploadOne = (row: Row) =>
    new Promise<void>((resolve) => {
      const body = new FormData();
      body.append("publication", row.slug);
      body.append("date", row.date);
      body.append("file", row.file);

      // XMLHttpRequest rather than fetch: these files run to twenty megabytes
      // and fetch gives no upload progress, so a slow line would look frozen.
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/upload/");
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const percent = Math.round((e.loaded / e.total) * 100);
        patch(row.id, {
          status: percent >= 100 ? { kind: "rendering" } : { kind: "uploading", percent },
        });
      };
      xhr.onload = () => {
        let data: { pageCount?: number; megabytes?: number; seconds?: number; error?: string } = {};
        try { data = JSON.parse(xhr.responseText); } catch { /* handled below */ }
        patch(row.id, {
          status:
            xhr.status >= 200 && xhr.status < 300 && data.pageCount !== undefined
              ? { kind: "done", pages: data.pageCount, mb: data.megabytes ?? 0, secs: data.seconds ?? 0 }
              : { kind: "error", message: data.error ?? `ਅਸਫਲ (${xhr.status})` },
        });
        resolve();
      };
      xhr.onerror = () => {
        patch(row.id, { status: { kind: "error", message: "ਨੈੱਟਵਰਕ ਦੀ ਸਮੱਸਿਆ" } });
        resolve();
      };
      patch(row.id, { status: { kind: "uploading", percent: 0 } });
      xhr.send(body);
    });

  const pending = rows.filter(
    (r) => r.status.kind !== "done" && r.slug && /^\d{4}-\d{2}-\d{2}$/.test(r.date),
  );
  const blocked = rows.filter((r) => r.status.kind !== "done" && !r.slug);
  const doneCount = rows.filter((r) => r.status.kind === "done").length;

  const field =
    "h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-brand-ink";

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          add(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragOver ? "border-brand-ink bg-surface-soft" : "border-line"
        }`}
      >
        <input
          ref={inputRef} id={inputId} type="file" accept="application/pdf,.pdf" multiple
          className="sr-only"
          onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }}
        />
        <label
          htmlFor={inputId}
          className="inline-block cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          PDF ਚੁਣੋ
        </label>
        <p className="mt-2 text-sm text-ink-faint">
          ਜਾਂ ਸਾਰੀਆਂ PDF ਇੱਥੇ ਖਿੱਚ ਕੇ ਛੱਡੋ — ਇੱਕੋ ਵਾਰ ਕਈ ਚੱਲ ਜਾਣਗੀਆਂ
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          ਅਖ਼ਬਾਰ ਤੇ ਤਰੀਕ ਫ਼ਾਈਲ ਦੇ ਨਾਂ ਤੋਂ ਆਪੇ ਭਰ ਜਾਣਗੇ
        </p>
      </div>

      {rows.length > 0 && (
        <>
          <ul className="mt-4 grid gap-2">
            {rows.map((row) => (
              <li key={row.id}
                className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink" title={row.file.name}>
                    {row.file.name}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {(row.file.size / 1024 / 1024).toFixed(1)} MB
                    {!row.slug && " · ਅਖ਼ਬਾਰ ਚੁਣੋ"}
                    {row.slug && row.confidence < 0.7 && " · ਅੰਦਾਜ਼ਾ, ਜਾਂਚ ਲਵੋ"}
                  </p>
                </div>

                <select
                  value={row.slug} aria-label="ਅਖ਼ਬਾਰ"
                  disabled={running || row.status.kind === "done"}
                  onChange={(e) => patch(row.id, { slug: e.target.value })}
                  className={`${field} ${row.slug ? "" : "border-accent"}`}
                >
                  <option value="">— ਅਖ਼ਬਾਰ —</option>
                  {publications.map((p) => (
                    <option key={p.slug} value={p.slug}>{p.name_local ?? p.name}</option>
                  ))}
                </select>

                <input
                  type="date" value={row.date} aria-label="ਤਰੀਕ"
                  disabled={running || row.status.kind === "done"}
                  onChange={(e) => patch(row.id, { date: e.target.value })}
                  className={field}
                />

                <div className="min-w-36 text-sm">
                  {row.status.kind === "ready" && (
                    <button type="button" disabled={running}
                      onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}
                      className="text-xs text-ink-faint underline">ਹਟਾਓ</button>
                  )}
                  {row.status.kind === "uploading" && (
                    <div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-soft">
                        <div className="h-full bg-brand transition-[width]" style={{ width: `${row.status.percent}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-ink-faint tabular-nums">{row.status.percent}%</p>
                    </div>
                  )}
                  {row.status.kind === "rendering" && (
                    <p className="text-xs text-ink-faint">ਸਫ਼ੇ ਬਣ ਰਹੇ ਹਨ…</p>
                  )}
                  {row.status.kind === "done" && (
                    <p className="text-xs font-medium text-green-700 dark:text-green-400">
                      ✓ {row.status.pages} ਸਫ਼ੇ · {row.status.mb} MB · {row.status.secs}s
                    </p>
                  )}
                  {row.status.kind === "error" && (
                    <p className="text-xs font-medium text-accent-ink">{row.status.message}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button" onClick={uploadAll}
              disabled={running || pending.length === 0}
              className="h-11 rounded-lg bg-brand px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {running
                ? "ਚੱਲ ਰਿਹਾ ਹੈ…"
                : `${pending.length} ਅਖ਼ਬਾਰ ਪ੍ਰਕਾਸ਼ਿਤ ਕਰੋ`}
            </button>

            {!running && (
              <button type="button" onClick={() => setRows([])}
                className="text-sm text-ink-faint underline">ਸੂਚੀ ਖ਼ਾਲੀ ਕਰੋ</button>
            )}

            {blocked.length > 0 && (
              <p className="text-sm text-accent-ink">
                {blocked.length} ਫ਼ਾਈਲਾਂ ਲਈ ਅਖ਼ਬਾਰ ਚੁਣਨਾ ਬਾਕੀ ਹੈ
              </p>
            )}
            {doneCount > 0 && (
              <p className="text-sm text-ink-faint">{doneCount} ਹੋ ਗਈਆਂ</p>
            )}
          </div>
        </>
      )}

      <p className="mt-3 text-xs text-ink-faint">
        ਇੱਕੋ ਅਖ਼ਬਾਰ ਤੇ ਤਰੀਕ ਦੁਬਾਰਾ ਅਪਲੋਡ ਕਰਨ ਨਾਲ ਪੁਰਾਣਾ ਅੰਕ ਬਦਲ ਜਾਵੇਗਾ।
      </p>
    </section>
  );
}
