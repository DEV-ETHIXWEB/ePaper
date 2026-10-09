"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: String(data.get("username") ?? ""),
          password: String(data.get("password") ?? ""),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "ਸਾਈਨ ਇਨ ਨਹੀਂ ਹੋ ਸਕਿਆ।");
        setBusy(false);
        return;
      }
      // Only internal destinations: a crafted link must not be able to bounce
      // someone off-site immediately after they sign in.
      const next = params.get("next");
      router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/admin/");
      router.refresh();
    } catch {
      setError("ਨੈੱਟਵਰਕ ਦੀ ਸਮੱਸਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।");
      setBusy(false);
    }
  };

  const field =
    "h-11 w-full rounded-lg border border-line bg-surface px-3.5 text-sm text-ink outline-none transition-colors focus:border-brand-ink";

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold text-ink">ਯੂਜ਼ਰਨੇਮ</span>
        <input
          name="username" type="text" autoComplete="username"
          required autoFocus autoCapitalize="none" spellCheck={false}
          className={field}
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-semibold text-ink">ਪਾਸਵਰਡ</span>
        <div className="relative">
          <input
            name="password" type={show ? "text" : "password"}
            autoComplete="current-password" required
            className={`${field} pe-12`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "ਪਾਸਵਰਡ ਲੁਕਾਓ" : "ਪਾਸਵਰਡ ਵੇਖੋ"}
            className="absolute end-1 top-1/2 grid h-9 w-10 -translate-y-1/2 place-items-center rounded-md text-ink-faint transition-colors hover:text-ink"
          >
            {show ? (
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" strokeLinecap="round" />
                <path d="M9.9 5.2A9.7 9.7 0 0 1 12 5c5 0 9 4.5 9 7a12 12 0 0 1-2.4 3.4M6.3 6.8C3.9 8.3 3 10.6 3 12c0 2.5 4 7 9 7a9.6 9.6 0 0 0 3.6-.7" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="2.6" />
              </svg>
            )}
          </button>
        </div>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </p>
      )}

      <button
        type="submit" disabled={busy}
        className="flex h-11 items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy && (
          <svg viewBox="0 0 24 24" className="size-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
            <circle cx="12" cy="12" r="9" className="opacity-25" />
            <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
          </svg>
        )}
        {busy ? "ਸਾਈਨ ਇਨ ਹੋ ਰਿਹਾ…" : "ਸਾਈਨ ਇਨ"}
      </button>
    </form>
  );
}
