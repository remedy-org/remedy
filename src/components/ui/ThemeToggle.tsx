"use client";

import clsx from "clsx";
import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, type Theme } from "./theme";

const read = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function apply(theme: Theme) {
  if (theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  try {
    // Both choices are stored: "dark" must outlast a system that prefers light.
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
}

/** The theme <html data-theme> shows now, kept in step with the toggle; "dark" on the server. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "dark" as Theme);
}

/**
 * A 36px icon button (44px hit area) that switches the app between the dark brand theme and the light theme. The
 * glyph is a half-lit disc that turns over with the theme; its angle follows <html data-theme> in CSS, so it is right
 * from the first paint.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => apply(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={clsx(
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-control text-muted",
        "transition-[background-color,color,transform] duration-160 ease-snap hover:bg-surface-2 hover:text-text active:translate-y-px",
        "after:absolute after:-inset-1 after:content-['']",
        className,
      )}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        <circle cx="9" cy="9" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M9 2.75a6.25 6.25 0 0 1 0 12.5z"
          fill="currentColor"
          className="origin-center transition-[rotate] duration-[360ms] ease-out-expo in-data-[theme=light]:rotate-180"
        />
      </svg>
    </button>
  );
}
