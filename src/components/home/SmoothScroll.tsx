"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/**
 * Inertial wheel scrolling on the homepage (Lenis, about 5 KB): the wheel eases into place instead of jumping, so the
 * pinned Chain of Custody reads as a steady scrub. Native scrolling stays in charge of everything else: keyboard
 * (arrows, Page Down, Space), anchor jumps, the skip link, touch and find-in-page. Off under reduced motion. Inner
 * scrollers (the console preview, tables) keep their own wheel (allowNestedScroll).
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.1, smoothWheel: true, allowNestedScroll: true, stopInertiaOnNavigate: true });
    return () => lenis.destroy();
  }, []);
  return null;
}
