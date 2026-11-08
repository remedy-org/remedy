"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { createGate, samePageHash } from "./scroll/gate";
import { alignAnchor, resolveCourse } from "./scroll/stops";

/** Dispatched on window by the homepage's Menu sheet: { locked: true } while it is open, so the page under it holds still. */
export const SCROLL_LOCK_EVENT = "remedy:scroll-lock";

/**
 * Inertial wheel scrolling on the homepage (Lenis, about 5 KB): the wheel eases into place instead of jumping, so the
 * pinned Chain of Custody reads as a steady scrub. A fast fling stops at each main beat on the way (scroll/stops.ts),
 * lands it whole and holds there, so the next beat takes a fresh gesture (scroll/gate.ts); slow scrolling passes freely.
 * Native scrolling stays in charge of everything else and never meets a stop: keyboard (arrows, Page Down, Space),
 * anchor jumps (which land on the same frames as the stops), the skip link, touch and find-in-page. Off under reduced
 * motion. Inner scrollers (the console preview, the report) keep their own wheel. It stops while the Menu sheet is open:
 * Lenis scrolls the window itself, so the sheet's overflow: hidden on <html> alone would not hold the page.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const gate = createGate(resolveCourse);
    const lenis = new Lenis({ autoRaf: true, lerp: 0.1, smoothWheel: true, allowNestedScroll: true, stopInertiaOnNavigate: true, virtualScroll: gate.wheel });
    const detach = gate.attach(lenis);
    const lock = (e: Event) => ((e as CustomEvent<{ locked: boolean }>).detail.locked ? lenis.stop() : lenis.start());
    const onClick = (e: MouseEvent) => {
      const hash = samePageHash(e);
      if (hash) alignAnchor(hash);
    };
    window.addEventListener(SCROLL_LOCK_EVENT, lock);
    window.addEventListener("click", onClick, { capture: true });
    return () => {
      window.removeEventListener(SCROLL_LOCK_EVENT, lock);
      window.removeEventListener("click", onClick, { capture: true });
      detach();
      lenis.destroy();
    };
  }, []);
  return null;
}
