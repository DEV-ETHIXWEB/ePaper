"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const MIN_QUERY = 3;

function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get("q") ?? "";

  return (
    <form
      role="search"
      action="/search/"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("q");
        const term = input instanceof HTMLInputElement ? input.value.trim() : "";
        // Shorter than this the trigram index cannot answer, so the form does
        // not navigate to a page that could only say "too short".
        if (term.length < MIN_QUERY) return;
        router.push(`/search/?q=${encodeURIComponent(term)}`);
      }}
      className="relative"
    >
      <svg
        viewBox="0 0 24 24" aria-hidden
        className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-white/60"
        fill="none" stroke="currentColor" strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        // Uncontrolled, keyed by the active query. Remounting on navigation is
        // what keeps the box in step with the URL; holding it in state and
        // syncing from an effect would set state during render instead.
        key={active}
        type="search"
        name="q"
        defaultValue={active}
        placeholder="ਖ਼ਬਰ ਖੋਜੋ…"
        aria-label="ਖ਼ਬਰ ਖੋਜੋ"
        className="h-9 w-full rounded-lg border border-white/25 bg-white/10 ps-8 pe-3 text-sm text-white placeholder:text-white/60 outline-none transition-colors focus:border-white/60 focus:bg-white/20"
      />
    </form>
  );
}

export default function HeaderSearch() {
  // useSearchParams needs a Suspense boundary; the fallback matches the
  // input's height so the masthead does not jump as it hydrates.
  return (
    <Suspense fallback={<div className="h-9" />}>
      <SearchBox />
    </Suspense>
  );
}
