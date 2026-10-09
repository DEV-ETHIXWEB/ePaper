"use client";

import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

function current(): Theme {
  if (typeof document === "undefined") return "light";
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Subscribing to the DOM attribute rather than holding the theme in state.
 *
 * The theme is written by the inline script in the document head before React
 * exists, so component state would start out disagreeing with the page. Reading
 * it through useSyncExternalStore keeps the two in step and avoids the
 * set-state-in-an-effect pattern that causes a flash on hydration.
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

export default function ThemeToggle() {
  // The server cannot know the reader's theme, so it renders the light icon
  // and the first client pass corrects it.
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);

  const toggle = useCallback(() => {
    const next: Theme = current() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* Private mode: the choice simply does not persist. */
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "ਚਿੱਟਾ ਰੰਗ" : "ਕਾਲਾ ਰੰਗ"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className="grid size-9 place-items-center rounded-lg text-white/90 transition-colors hover:bg-white/15"
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
