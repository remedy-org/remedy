import type Lenis from "lenis";
import { calm, calmLanding, STORY_MIN } from "./landing";
import { samePageHash, type Course } from "./gate";

// The keyboard's paging on the homepage, on the wheel's own stops (stops.ts). A browser page is about 95% of the
// screen, so native paging landed between the stops: the Problem sheet mid-unfold, the loop closed skipped, a heading
// under the nav or a line cut at the foot. Space, Shift+Space, Page Down and Page Up go to the next stop in their
// direction instead, on the same calm glide as a fling's landing (the pinned transitions on the way crossed slowly), when
// that stop is near: within 1.25 screens, or anywhere when the page or the stop is inside a pinned stretch (the Chain of
// Custody's beats, the Problem sheet's), whose stops are paced for the keys. Farther, the browser pages as usual. A key
// press is deliberate, so besides the wheel's stops it stops on every finished beat the wheel may come to rest on
// (stops.ts RESTS): each of the exhibit's five checks at its hold, both ways, where the wheel's stops skip all but check
// 3 and a Page Down crossed the other four in a quarter of a second each. Keys that type or press (a field, a button, a
// tab) keep their own meaning.

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

/** Starts the pager on a Lenis. `read` gives the stops, the finished beats and the slow stretches as laid out now, `pins`
 * the pinned stretches. */
export function attachKeys(lenis: Pick<Lenis, "scrollTo" | "isStopped" | "animatedScroll" | "stop" | "start">, read: () => Course, pins: () => [number, number][]) {
  // Ordinary sections retain browser-like paging. Inside the story a physical key press finishes one readable beat.
  let aim: { to: number; until: number; dir: 1 | -1; story: boolean } | null = null;
  const release = () => { aim = null; };
  const cancel = () => {
    if (aim?.story && !lenis.isStopped) {
      lenis.stop();
      lenis.start();
    }
    release();
  };
  const onKey = (e: KeyboardEvent) => {
    const dir = pageDirection(e);
    if (!dir && ["ArrowDown", "ArrowUp", "Home", "End", "Tab"].includes(e.key)) cancel();
    if (!dir || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || lenis.isStopped) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest(EDITABLE) || target?.closest(OWN_KEYS) || (e.key === " " && target?.closest(PRESSABLE))) return cancel();
    // A focused scroller with room in that direction (the tour's report) pages itself.
    if (target && scrollsOn(target, dir)) return cancel();
    const now = performance.now();
    let pending = aim && now < aim.until ? aim : null;
    if (pending?.story && dir === pending.dir) {
      e.preventDefault();
      return;
    }
    if (pending?.story && dir !== pending.dir) {
      cancel();
      pending = null;
    }
    const { stops, rests = stops, slow = [] } = read();
    const from = pending && !pending.story ? pending.to : scrollY;
    const stretches = pins();
    const to = keyStop(rests, from, dir, REACH * innerHeight, stretches);
    if (to === null) return;
    const inStory = stretches.some(([a, b]) => (from >= a - EPS && from <= b + EPS) || (to >= a - EPS && to <= b + EPS));
    e.preventDefault();
    if (inStory && e.repeat) return;
    const { duration, way, ease } = calmLanding(lenis.animatedScroll, to, innerHeight, slow, Infinity, inStory ? STORY_MIN : undefined);
    const curve = calm(0, ease);
    const next = { to, until: now + duration * 1000 + 200, dir, story: inStory };
    aim = next;
    lenis.scrollTo(to, { duration, easing: (t) => way.at(curve(t)), onComplete: () => {
      if (aim === next) next.until = performance.now();
    } });
  };
  const onClick = (e: MouseEvent) => {
    if (samePageHash(e)) cancel();
  };
  // Capture, so the pin's own paging (custody/paging.ts, for when this one isn't running) never pages the same key.
  addEventListener("keydown", onKey, { capture: true });
  addEventListener("click", onClick, { capture: true });
  addEventListener("wheel", release, { passive: true });
  addEventListener("touchstart", release, { passive: true });
  return () => {
    removeEventListener("keydown", onKey, { capture: true });
    removeEventListener("click", onClick, { capture: true });
    removeEventListener("wheel", release);
    removeEventListener("touchstart", release);
  };
}
