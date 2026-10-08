"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface Pub { slug: string; name: string; name_local: string | null }

type State =
  | { kind: "idle" }
  | { kind: "uploading"; name: string }
  | { kind: "done"; pages: number; mb: number; secs: number }
  | { kind: "error"; message: string };

export default function UploadForm({
  publications,
  today,
}: {
  publications: Pub[];
  today: string;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(publications[0]?.slug ?? "");
  const [date, setDate] = useState(today);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setState({ kind: "error", message: "Please choose a PDF file." });
      return;
    }
    setFile(f);
    setState({ kind: "idle" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setState({ kind: "uploading", name: file.name });

    const body = new FormData();
    body.set("publication", slug);
    body.set("date", date);
    body.set("file", file);

    try {
      const res = await fetch("/api/admin/upload/", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "Upload failed." });
        return;
      }
      setState({ kind: "done", pages: data.pageCount, mb: data.megabytes, secs: data.seconds });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setState({ kind: "error", message: "Network problem during upload." });
    }
  };

  const field =
    "h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900";
  const busy = state.kind === "uploading";

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">Publication</span>
          <select value={slug} onChange={(e) => setSlug(e.target.value)} className={field} disabled={busy}>
            {publications.map((p) => (
              <option key={p.slug} value={p.slug}>{p.name_local ?? p.name}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">Edition date</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)}
            className={field} disabled={busy} />
        </label>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files[0] ?? null); }}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragOver ? "border-blue-600 bg-blue-50 dark:bg-blue-950" : "border-neutral-300 dark:border-neutral-700"
        }`}
      >
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" disabled={busy}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white dark:file:bg-neutral-100 dark:file:text-neutral-900" />
        <p className="mt-2 text-xs text-neutral-500">
          {file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : "or drop the PDF here"}
        </p>
      </div>

      {state.kind === "error" && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {state.message}
        </p>
      )}
      {state.kind === "done" && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950 dark:text-green-200">
          Published {state.pages} pages in {state.secs}s ({state.mb} MB stored).
        </p>
      )}
      {busy && (
        <p role="status" className="rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900">
          Converting {state.name}… this takes a few seconds per page. Keep this tab open.
        </p>
      )}

      <button type="submit" disabled={!file || busy}
        className="h-11 rounded-lg bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
        {busy ? "Working…" : "Upload and publish"}
      </button>

      <p className="text-xs text-neutral-500">
        Uploading the same publication and date again replaces that edition.
      </p>
    </form>
  );
}
