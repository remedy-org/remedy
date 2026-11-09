"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

/** Prints the report. While it prints, the page is in the light theme, so the sheet's ink is dark on the white paper in a
 * dark room too; afterwards the reader's theme comes back. */
export function PrintButton() {
  useEffect(() => {
    const root = document.documentElement;
    let was: string | undefined | null = null;
    const light = () => {
      if (was !== null) return;
      was = root.dataset.theme;
      root.dataset.theme = "light";
    };
    const back = () => {
      if (was === null) return;
      if (was === undefined) delete root.dataset.theme;
      else root.dataset.theme = was;
      was = null;
    };
    const print = window.matchMedia("print");
    const change = (e: MediaQueryListEvent) => (e.matches ? light() : back());
    window.addEventListener("beforeprint", light);
    window.addEventListener("afterprint", back);
    print.addEventListener("change", change);
    return () => {
      window.removeEventListener("beforeprint", light);
      window.removeEventListener("afterprint", back);
      print.removeEventListener("change", change);
      back();
    };
  }, []);
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      Print or save as PDF
    </Button>
  );
}
