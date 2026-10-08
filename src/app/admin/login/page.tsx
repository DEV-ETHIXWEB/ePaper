import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-xl font-bold">ePaper newsroom</h1>
        <p className="mb-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
          Sign in to upload today&apos;s editions
        </p>
        <div className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
          {/* useSearchParams needs a boundary; it wraps no visible UI. */}
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
