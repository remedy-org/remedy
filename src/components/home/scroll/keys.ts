import type Lenis from "lenis";
import { landing, landingTime, warp } from "./landing";
import type { Course } from "./gate";

// The keyboard's paging on the homepage, on the wheel's own stops (stops.ts). A browser page is about 95% of the
// screen, so native paging landed between the stops: the Problem sheet mid-unfold, the loop closed skipped, a heading
// under the nav or a line cut at the foot. Space, Shift+Space, Page Down and Page Up go to the next stop in their
// direction instead, gliding there as a fling's landing does (the pinned transitions on the way crossed slowly), when
// that stop is near: within 1.25 screens, or anywhere when the page or the stop is inside a pinned stretch (the Chain of
// Custody's beats, the Problem sheet's), whose stops are paced for the keys. Farther, the browser pages as usual. Keys
// that type or press (a field, a button, a tab) keep their own meaning.

/** How far a key may take the page to a stop, in screens, outside a pinned stretch. */
const REACH = 1.25;
/** A stop this close to the page is where it already is. */
const EPS = 4;

const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";
/** Widgets that page their own way (AG Grid's Page Down moves its focus) or hold the page (a dialog). */
const OWN_KEYS = "[role='grid'], [role='treegrid'], [role='listbox'], [role='menu'], [role='dialog']";
/** Space presses these, so it is theirs. */
const PRESSABLE = "button, summary, [role='button'], [role='checkbox'], [role='switch'], [role='tab'], [role='menuitem']";

/** The key's direction, or 0 for a key that doesn't page. */
export function pageDirection(e: Pick<KeyboardEvent, "key" | "shiftKey">): 1 | -1 | 0 {
  if (e.key === "PageDown") return 1;
  if (e.key === "PageUp") return -1;
  if (e.key === " ") return e.shiftKey ? -1 : 1;
  return 0;
}

/**
 * The stop a key goes to from `at`: the next one in `dir`, when it is within `reach` px or either end lies in one of the
 * `pins` ([from, to] in scrollY); null when the browser should page as usual. Stops are sorted.
 */
export function keyStop(stops: readonly number[], at: number, dir: 1 | -1, reach: number, pins: readonly (readonly [number, number])[] = []) {
  const next = dir > 0 ? stops.find((s) => s > at + EPS) : stops.findLast((s) => s < at - EPS);
  if (next === undefined) return null;
  const inPin = (y: number) => pins.some(([a, b]) => y >= a - EPS && y <= b + EPS);
  return Math.abs(next - at) <= reach || inPin(at) || inPin(next) ? next : null;
}

/** Whether `el` or an ancestor scrolls on its own, with room left in `dir`. */
function scrollsOn(el: Element, dir: 1 | -1) {
  for (let n: Element | null = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    if (!(n instanceof HTMLElement)) continue;
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) {
      if (dir > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true;
    }
  }
  return false;
}

/** Starts the pager on a Lenis. `read` gives the stops and slow stretches as laid out now, `pins` the pinned stretches. */
export function attachKeys(lenis: Pick<Lenis, "scrollTo" | "isStopped" | "animatedScroll">, read: () => Course, pins: () => [number, number][]) {
  // A held key, or presses quicker than the glide, step on from the stop last aimed at.
  let aim: { to: number; until: number } | null = null;
  const onKey = (e: KeyboardEvent) => {
    const dir = pageDirection(e);
    if (!dir || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || lenis.isStopped) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest(EDITABLE) || target?.closest(OWN_KEYS) || (e.key === " " && target?.closest(PRESSABLE))) return;
    // A focused scroller with room in that direction (the tour's report) pages itself.
    if (target && scrollsOn(target, dir)) return;
    const { stops, slow = [] } = read();
    const from = aim && performance.now() < aim.until ? aim.to : scrollY;
    const to = keyStop(stops, from, dir, REACH * innerHeight, pins());
    if (to === null) return;
    e.preventDefault();
    const way = warp(lenis.animatedScroll, to, slow);
    const duration = landingTime(way.length / innerHeight);
    const curve = landing(0);
    aim = { to, until: performance.now() + duration * 1000 + 200 };
    lenis.scrollTo(to, { duration, easing: (t) => way.at(curve(t)) });
  };
  // Capture, so the pin's own paging (custody/paging.ts, for when this one isn't running) never pages the same key.
  addEventListener("keydown", onKey, { capture: true });
  return () => removeEventListener("keydown", onKey, { capture: true });
}
