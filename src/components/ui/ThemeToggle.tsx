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
    if (theme === "light") localStorage.setItem(THEME_STORAGE_KEY, "light");
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
}

/** Switches the app between the dark brand theme and the light theme. Not for the homepage (dark only). */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, read, () => "dark" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => apply(next)}
      className={clsx("inline-flex min-h-11 items-center rounded-control px-2 text-ui text-muted hover:text-text", className)}
      aria-label={`Switch to ${next} theme`}
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
