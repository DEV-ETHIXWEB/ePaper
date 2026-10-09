"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/admin/logout/", { method: "POST" }).catch(() => {});
        router.push("/admin/login/");
        router.refresh();
      }}
      className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium disabled:opacity-60 border-line"
    >
      {busy ? "…" : "Sign out"}
    </button>
  );
}
