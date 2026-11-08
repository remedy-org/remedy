"use client";

import { useLayoutEffect } from "react";
import { THEME_STORAGE_KEY } from "./theme";

/**
 * The pre-paint theme script's logic again, from React: a page Next renders as an error document (a notFound() under
 * /r/*) never runs the root layout's inline script, so without this a light-mode visitor would get the dark default.
 * Runs before paint; does nothing when the script already set the theme.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (root.dataset.theme) return;
    try {
      const t = localStorage.getItem(THEME_STORAGE_KEY);
      if (t === "light" || (t !== "dark" && matchMedia("(prefers-color-scheme: light)").matches)) root.dataset.theme = "light";
    } catch {
      // Storage blocked: the dark default stands.
    }
  }, []);
  return null;
}
