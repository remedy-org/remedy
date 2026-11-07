"use client";

import { useEffect, useRef } from "react";

// Keyboard paging through a pinned runway. A browser page (Space, Page Down) is about 95vh, but a beat inside the pin
// gets 56 to 85vh of scroll, so native paging skipped whole beats (check 2, the paid receipt). While the pin is on
// screen, Space, Shift+Space, Page Down and Page Up go to the next or previous beat's stop instead; before the first
// stop and past the last one the browser pages as usual, so the keys still lead into and out of the pin.

/** The next stop after `at` (dir 1) or the one before it (dir -1), or null when there is none. Stops are sorted. */
export function nextStop(stops: readonly number[], at: number, dir: 1 | -1, eps = 0.002): number | null {
  if (dir === 1) return stops.find((s) => s > at + eps) ?? null;
  for (let i = stops.length - 1; i >= 0; i--) if (stops[i] < at - eps) return stops[i];
  return null;
}

/** Keys that page, with their direction. */
function direction(e: KeyboardEvent): 1 | -1 | 0 {
  if (e.key === "PageDown") return 1;
  if (e.key === "PageUp") return -1;
  if (e.key === " ") return e.shiftKey ? -1 : 1;
  return 0;
}

const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";
/** Space presses these, so it is theirs. */
const PRESSABLE = "button, summary, [role='button'], [role='checkbox'], [role='switch'], [role='tab'], [role='menuitem']";

/**
 * Pages `runway` beat by beat. `stops` are where each beat is best read, as fractions (0 to 1) of the runway's scroll
 * travel. A held key or quick presses step from the stop last aimed at, not from wherever the smooth scroll is.
 */
export function useBeatPaging(runway: () => HTMLElement | null | undefined, stops: readonly number[]) {
  const aim = useRef<{ at: number; t: number } | null>(null);
  const get = useRef(runway);
  useEffect(() => {
    get.current = runway;
  });
  const key = stops.join(",");
  useEffect(() => {
    const list = key.split(",").map(Number);
    const onKey = (e: KeyboardEvent) => {
      const dir = direction(e);
      if (!dir || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(EDITABLE) || (e.key === " " && target?.closest(PRESSABLE))) return;
      const el = get.current();
      if (!el) return;
      const r = el.getBoundingClientRect();
      const travel = el.offsetHeight - innerHeight;
      // Only while the pin holds the screen: its stage sticks under the 4rem nav.
      const nav = 4 * parseFloat(getComputedStyle(document.documentElement).fontSize);
      if (travel <= 0 || r.top > nav + 1 || r.bottom < innerHeight - 1) return;
      const now = Math.max(0, -r.top / travel);
      const last = aim.current;
      const from = last && performance.now() - last.t < 900 ? last.at : now;
      const to = nextStop(list, from, dir);
      if (to === null) return;
      e.preventDefault();
      aim.current = { at: to, t: performance.now() };
      scrollTo({ top: r.top + scrollY + to * travel, behavior: "smooth" });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [key]);
}
