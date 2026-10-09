import type { Metadata } from "next";
import { Inter, Noto_Sans_Gurmukhi, Noto_Sans_Devanagari } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

const latin = Inter({
  variable: "--font-latin",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Gurmukhi and Devanagari are loaded, not left to a system fallback.
 *
 * Android ships a usable Gurmukhi face but Windows often does not, and the
 * fallback there renders tofu or a face with the matras misplaced. This
 * audience reads Punjabi on both.
 */
const gurmukhi = Noto_Sans_Gurmukhi({
  variable: "--font-gurmukhi",
  subsets: ["gurmukhi"],
  display: "swap",
  weight: ["400", "600", "700"],
});

/* Bharat Desh Hamara is a Hindi title, so Devanagari is part of the stack. */
const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  display: "swap",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "ਚੜ੍ਹਦੀਕਲਾ ਈ-ਪੇਪਰ",
    template: "%s · ਚੜ੍ਹਦੀਕਲਾ ਈ-ਪੇਪਰ",
  },
  description: "ਚੜ੍ਹਦੀਕਲਾ ਗਰੁੱਪ ਦੇ ਸਾਰੇ ਅਖ਼ਬਾਰ ਆਨਲਾਈਨ ਪੜ੍ਹੋ। Read every Charhdikala Group newspaper online.",
};

/**
 * `data-theme` is set before paint by the inline script so a reader who chose
 * light mode never sees a dark flash, and vice versa. It has to be inline and
 * synchronous: anything deferred runs after the first paint, which is the
 * flash itself.
 */
const THEME_INIT = `
try {
  var t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pa"
      suppressHydrationWarning
      className={`${latin.variable} ${gurmukhi.variable} ${devanagari.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
        >
          ਮੁੱਖ ਸਮੱਗਰੀ ਤੇ ਜਾਓ
        </a>
        <SiteHeader />
        <div id="main" className="flex-1">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
