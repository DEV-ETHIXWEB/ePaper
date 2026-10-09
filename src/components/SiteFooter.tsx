import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-line bg-surface-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} Charhdikala Group · ਸਾਰੇ ਹੱਕ ਰਾਖਵੇਂ
        </p>
        <nav className="flex gap-4">
          <Link href="/" className="hover:text-ink-soft">ਅਖ਼ਬਾਰ</Link>
          <Link href="/search/" className="hover:text-ink-soft">ਖੋਜ</Link>
        </nav>
      </div>
    </footer>
  );
}
