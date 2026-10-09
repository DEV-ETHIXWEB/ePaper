import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "ਸਾਈਨ ਇਨ",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-brand text-white">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M4 5h11a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2V5Z" strokeLinejoin="round" />
            <path d="M17 9h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" strokeLinejoin="round" />
            <path d="M7 8h5M7 11h5M7 14h3" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-ink">ਨਿਊਜ਼ਰੂਮ</h1>
        <p className="mt-1 text-sm text-ink-faint">
          ਅੱਜ ਦੇ ਅਖ਼ਬਾਰ ਅਪਲੋਡ ਕਰਨ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        {/* useSearchParams needs a boundary; it wraps no visible UI. */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>

      <p className="mt-5 text-center text-xs text-ink-faint">
        ਇਹ ਸਫ਼ਾ ਸਿਰਫ਼ ਸਟਾਫ਼ ਲਈ ਹੈ। Staff access only.
      </p>
    </main>
  );
}
