"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { THEME_STORAGE_KEY } from "./theme";

/** Apply the saved app preference on navigation without letting marketing overwrite it. */
export function ThemeSync() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    const root = document.documentElement;
    let theme = "dark";
    try {
      if (pathname !== "/" && localStorage.getItem(THEME_STORAGE_KEY) === "light") theme = "light";
    } catch {
      // Storage blocked: the dark default stands.
    }
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#faf9fc" : "#000000");
  }, [pathname]);
  return null;
}
