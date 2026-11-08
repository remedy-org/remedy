"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/** Dispatched on window by the homepage's Menu sheet: { locked: true } while it is open, so the page under it holds still. */
export const SCROLL_LOCK_EVENT = "remedy:scroll-lock";

/**
 * Inertial wheel scrolling on the homepage (Lenis, about 5 KB): the wheel eases into place instead of jumping, so the
 * pinned Chain of Custody reads as a steady scrub. Native scrolling stays in charge of everything else: keyboard
 * (arrows, Page Down, Space), anchor jumps, the skip link, touch and find-in-page. Off under reduced motion. Inner
 * scrollers (the console preview, tables) keep their own wheel (allowNestedScroll). It stops while the Menu sheet is
 * open: Lenis scrolls the window itself, so the sheet's overflow: hidden on <html> alone would not hold the page.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.1, smoothWheel: true, allowNestedScroll: true, stopInertiaOnNavigate: true });
    const lock = (e: Event) => ((e as CustomEvent<{ locked: boolean }>).detail.locked ? lenis.stop() : lenis.start());
    window.addEventListener(SCROLL_LOCK_EVENT, lock);
    return () => {
      window.removeEventListener(SCROLL_LOCK_EVENT, lock);
      lenis.destroy();
    };
  }, []);
  return null;
}
