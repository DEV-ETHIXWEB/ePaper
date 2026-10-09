import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import HeaderSearch from "./HeaderSearch";

/**
 * One masthead across the whole site.
 *
 * Navy rather than white: this is a newspaper, and the bar doubles as the
 * brand. White text on --color-brand measures 11.4:1, so it stays fixed in
 * both themes instead of being re-tinted.
 */
export default function SiteHeader() {
  return (
    <header className="bg-brand text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <Link href="/" className="flex items-baseline gap-2 font-bold">
          <span className="text-lg leading-tight">ਚੜ੍ਹਦੀਕਲਾ</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
            ePaper
          </span>
        </Link>

        <div className="order-3 w-full sm:order-none sm:ms-auto sm:w-auto sm:max-w-xs sm:flex-1">
          <HeaderSearch />
        </div>

        <nav className="flex items-center gap-1 sm:ms-0 ms-auto">
          <Link
            href="/"
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/15"
          >
            ਅਖ਼ਬਾਰ
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
