"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Could not sign in.");
        setBusy(false);
        return;
      }
      // Only internal destinations: a crafted link must not be able to bounce
      // someone off-site immediately after they sign in.
      const next = params.get("next");
      router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/admin/");
      router.refresh();
    } catch {
      setError("Network problem. Try again.");
      setBusy(false);
    }
  };

  const field =
    "h-11 w-full rounded-lg border border-neutral-300 bg-white px-3.5 text-sm outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold">Username</span>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
          autoComplete="username" required className={field} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold">Password</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password" required className={field} />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy}
        className="h-11 rounded-lg bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
