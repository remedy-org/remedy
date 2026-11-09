import type Lenis from "lenis";
import type { VirtualScrollData } from "lenis";
import { landing as glide, landingTime, warp, type Slow } from "./landing";

// Scroll stops for the wheel. A fast wheel or trackpad fling is taken, as soon as it reads as fast, to the next stop in
// its direction (stops.ts) and lands exactly there, on a glide long enough for the scrubbed transition on the way to be
// seen (landing.ts); the rest of that gesture (the trackpad's momentum, a free-spinning wheel) is absorbed there. The
// next beat takes a fresh gesture: a pause, a new swipe or a reversal (a notched wheel's flicks are each their own). A
// wheel spun on hard has made its point: the rest of that gesture scrolls freely (ESCAPE, SPIN) and comes to rest on the
// nearest whole frame. A hard fling whose momentum keeps pouring in skims past a story's inner beats (SKIM); section
// stops always catch. Going up, the page stops on the same finished beats as going down (stops.ts). Slow scrolling never
// meets a stop, and a short flick that would not have carried halfway to the next stop runs free, unless it would come
// to rest inside a pinned story; any gesture that goes quiet with the page bound for a transition half played inside one
// settles on its nearest finished beat (nudge); a wheel rolled on slowly, a notch at a time, settles once, from where the
// roll began. Only the wheel is gated: keys, anchor links,
// the scrollbar, find-in-page, focus moves, touch and screen readers scroll natively and cancel a landing at once.

/** The input rate is measured over this many ms. */
const WINDOW = 150;
/** px/s of wheel input over WINDOW that counts as a fling rather than reading (a steady hand is about 900). */
const FAST = 2000;
/** ms without a wheel event that ends a gesture, unless it resumes within TAIL_GAP ms as the same slowing tail. */
const QUIET = 140;
const TAIL_GAP = 400;
/** The same for a notched wheel, which has no momentum tail to wait out (notchQuiet): 60 to 80 ms. */
const NOTCH_QUIET: readonly [min: number, max: number] = [60, 80];
/**
 * ms the wheel must be quiet before a gesture the page took as the reader's own settles on a beat (nudge): QUIET for a
 * trackpad; sooner after a notched wheel's quick flick (its notches under ROLL_NOTCH ms apart), so a second flick 150 ms
 * on heads on from the first one's landing; later after a lone notch, or a roll of notches each ROLL_NOTCH to 150 ms
 * apart, so a slow roll is one move of the hand that settles once, where it stopped (each of its notches is a gesture of
 * its own: notchQuiet).
 */
const FLICK_QUIET = 100;
const ROLL_QUIET = 190;
const ROLL_NOTCH = 50;

/**
 * ms without a notch that end a notched wheel's gesture: half as long again as its usual gap between notches (the
 * median of `gaps`, the gesture's last few), held to 60 to 80 ms, and 80 before it has a gap of its own. A hand
 * re-flicking pauses 60 ms or more between flicks, so each flick is a gesture of its own and three quick flicks move
 * three stops; a wheel spun on sends its notches 10 to 40 ms apart, so a held spin stays one gesture.
 */
export function notchQuiet(gaps: readonly number[]) {
  if (!gaps.length) return NOTCH_QUIET[1];
  const usual = [...gaps].sort((x, y) => x - y)[gaps.length >> 1];
  return Math.min(NOTCH_QUIET[1], Math.max(NOTCH_QUIET[0], 1.5 * usual));
}
/**
 * A momentum tail has decayed under this share of the gesture's peak pace. Paces are px of input per PACE ms, so events
 * the browser merges on a busy frame, and uneven event timing, read the same as the even stream it would have sent.
 */
const TAIL = 0.6;
const PACE = 80;
/** ms a held gesture must run (since it was taken, or resumed after a stall), slow and not slowing, before it counts as
 * a hand scrolling on: two 200 ms windows of input are compared. */
const STEADY = 400;
/** A fling is taken to the next stop only within this many windows of the page; farther, it runs on. */
const REACH = 2;
/** ms of input held at FAST or more, after a landing has finished, that reads as a fresh fling rather than its tail (a
 * wheel spun on hard, a swipe laid straight on top of the last). */
const SUSTAIN = 250;
/** Stops one gesture may be landed on before input kept at FAST past the landing (SUSTAIN) runs free for the rest of
 * it: one, so only a fresh gesture's first fling stops. */
const ESCAPE = 1;
/** ms of input held at FAST or more, not slowing (a wheel spun on, never a trackpad's decaying tail), after which the
 * gesture runs free at once, landing or not; when it ends, the page comes to rest on a stop or a clean frame (settle). */
const SPIN = 600;
/** The same for a notched wheel, sooner: a power scroller spinning hard from the top met a page that held for 0.6 s while
 * the dolly played, and felt it resist. A notched wheel has no momentum tail to mistake for a spin; under 450 ms a
 * power fling of merged events (a trackpad's, whole px) would read as one. */
const NOTCH_SPIN = 450;
/** How far past where a free run would stop the nearest stop may be, in windows, for the run to come to rest on it. */
const SETTLE = 0.6;
/** How far short of where a free run would stop a stop it has just passed may be, in windows, for the run to come back
 * to rest on it when it is nearer than the stop ahead: the stops below the Problem sheet are about a window apart, so a
 * spin that ran 270px past Results' stop rested with its heading under the nav. */
const SETTLE_BACK = 0.3;
/** px under which a gesture the page took no stop for is a tremor and settles on the nearer beat (nudge). Any more is a
 * push: a trackpad's gentlest is about 36px, and it must move the story on a beat in its direction, never spring back. */
const TREMOR = 8;
/** px a free run with no stop near may move to rest on a clean frame (stops.ts fit): no line cut by the nav or the
 * screen's foot. */
const CLEAN = 120;
/** A notched wheel's quick flick is taken to the next stop this many windows away or nearer however short it is, as
 * Page Down is (keys.ts REACH): the stops below the Problem sheet are about a window apart, so three notches carried
 * about half the way and a flick ran free or glided to the stop by a few px of timing. */
const NOTCH_REACH = 1.25;
/** Input a held fling keeps putting in past the stop it was taken to, in windows, that carries it on past a story's
 * inner beat (a hard fling skims; a flick stops on each beat). Section stops always catch. */
const SKIM = 2;
/** A wheel's notches (|deltaY| this big or more, whole px): no momentum to play out, so its landings stay short. */
const NOTCH = 50;
/** Seconds a notched wheel's landing takes at most, so the page never drives on long after the hand has stopped; across
 * the hero's dolly, less still: a wheel spun hard from the top meets the dolly first, and a longer landing there read
 * as the page resisting the hand. */
const NOTCH_TIME = 1.1;
const NOTCH_DOLLY_TIME = 0.9;
/** The slow stretch's weight that marks the hero's dolly (stops.ts SLOW), and the weight a notched wheel crosses it at. */
const DOLLY_WEIGHT = 5;
const NOTCH_DOLLY = 3.5;
/** Seconds a trackpad's landing across the dolly takes at most: the dolly plays, and the page is at rest about a second
 * after. */
const DOLLY_TIME = 1.2;
/** Seconds a landing may take longer for each slow stretch on its way but the dolly (stops.ts SLOW): an exhibit check,
 * the sheet's loop closing or its cut. The rest of the way is as quick as it can be already, so the time a transition
 * holds comes from here: two checks in a notched wheel's 1.1 s glide played in about 0.25 s each. */
const SLOW_TIME = 0.15;
/** A stop closer than this many windows to where the gesture began is where the reader already is: it goes on past. */
const NEAR = 0.15;
/**
 * Seconds of momentum a fling still has in it at its current rate (a trackpad's tail decays over about 0.35 s), but
 * never more than the gesture has put in so far: a wheel's quick flick of three notches has no momentum to come.
 */
const MOMENTUM = 0.35;
/** A fling is taken to a stop only when its projected travel covers at least this share of the way there. */
const CARRY = 0.5;
/**
 * A stop the page would reach within this many seconds at its own speed is too close to land softly: it goes on. Short,
 * since the landing's brake sheds a hard fling's speed in about 50 ms: at 0.1 s a fling that Lenis had already sped up
 * passed the Problem sheet's cut (350px from the stop before it on a 1080px screen).
 */
const CATCH = 0.05;
/** Lenis's lerp (SmoothScroll.tsx LERP): each 60 Hz frame covers this share of the way left to its target. */
export const LERP = 0.16;
const LERP_STEP = 1 - Math.exp(-LERP);
/** px a native scroll may differ from where Lenis last put the page before it counts as someone else's. */
const DRIFT = 2;

type Dir = 1 | -1;
/** A held gesture: its direction, its peak pace, the low of its tail, and from when its paces count (taken, or resumed). */
type Hold = { dir: Dir; peak: number; low: number; rising: number; paced: number };
type Sample = { t: number; a: number };

/** The parts of Lenis the gate uses (a stand-in in the tests). */
export type GateLenis = Pick<Lenis, "animatedScroll" | "targetScroll" | "velocity" | "isScrolling" | "isStopped" | "scrollTo" | "on" | "stop" | "start">;

/** Keys that scroll (and Tab, which scrolls focus into view): each one takes the page from a landing. */
const KEYS = new Set([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End", "Tab"]);

/** True when the wheel is over something that scrolls on its own in that direction, or opts out of Lenis. */
function nested(event: Event, dir: Dir) {
  for (const node of event.composedPath()) {
    if (!(node instanceof HTMLElement) || node === document.body || node === document.documentElement) continue;
    if (node.hasAttribute("data-lenis-prevent") || node.hasAttribute("data-lenis-prevent-wheel") || node.hasAttribute("data-lenis-prevent-vertical")) return true;
    const oy = getComputedStyle(node).overflowY;
    if (oy !== "auto" && oy !== "scroll" && oy !== "overlay") continue;
    if (node.scrollHeight <= node.clientHeight) continue;
    if (dir > 0 ? node.scrollTop + node.clientHeight < node.scrollHeight - 1 : node.scrollTop > 0) return true;
  }
  return false;
}

/** The same-page link a click follows, as its hash; null for anything else. */
export function samePageHash(e: Event) {
  const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href*='#']") : null;
  return link && link.hash && link.origin === location.origin && link.pathname === location.pathname ? link.hash : null;
}

/** The stops in scrollY, sorted (going down, and going up when they differ), and the stretches between them a glide
 * crosses slowly (landing.ts warp). `fit` is the clean frame in [min, max] nearest a position (stops.ts Page fit). */
export type Course = {
  stops: number[];
  up?: number[];
  slow?: readonly Slow[];
  inner?: number[];
  /** Every finished beat a gesture the page took no stop for may settle on inside a pin: the stops and more (stops.ts
   * RESTS). The stops when it is missing. */
  rests?: number[];
  pins?: readonly (readonly [number, number])[];
  fit?: (y: number, range: { min: number; max: number }) => number | undefined;
};

export function createGate(read: () => Course) {
  let lenis: GateLenis | null = null;
  let samples: Sample[] = [];
  let lastT = -Infinity;
  let lastA = 0;
  let lastDir: Dir = 1;
  let stops: number[] = [];
  let upStops: number[] = [];
  let innerStops: number[] = [];
  let rests: number[] = [];
  let pins: readonly (readonly [number, number])[] = [];
  let slow: readonly Slow[] = [];
  let fit: Course["fit"];
  let hold: Hold | null = null;
  let landing: { to: number; dir: Dir } | null = null;
  /** The page has taken some of this gesture as the reader's own scroll since it last landed (nudge). */
  let loose = false;
  let quietTimer: ReturnType<typeof setTimeout> | undefined;
  /** Something else took the page during this gesture (a key, a link, the scrollbar): the rest of it is the reader's. */
  let yielded = false;
  /** Where the page was when this gesture began. */
  let origin = 0;
  /** This gesture began over something that scrolls on its own: only then may its input reach that inner scroller. */
  let startedInner = false;
  /** Every event of this gesture so far was a wheel's notch. */
  let notched = false;
  /** Since when input has run at FAST or more with the page held after a landing. */
  let fastSince: number | null = null;
  /** Landings this gesture has made, and whether it has escaped the stops (ESCAPE) for the rest of it. */
  let chained = 0;
  let free = false;
  /** ms of this gesture's input at FAST or more (SPIN), and its input in all, and at the moment it was last landed. */
  let fastRun = 0;
  let total = 0;
  let takenAt = 0;
  /** The wall clock at the last wheel event, for a free run's end (the scroll listener). */
  let lastWall = 0;
  /** This notched gesture's gaps between notches, ms. */
  let gaps: number[] = [];
  /** The page's own speed, px/ms, from Lenis's last two frames. */
  let speed = 0;
  let prev: { t: number; y: number } | null = null;

  const sum = (from: number, to: number) => samples.reduce((s, e) => (e.t > from && e.t <= to ? s + e.a : s), 0);
  const count = (from: number, to: number) => samples.reduce((n, e) => (e.t > from && e.t <= to ? n + 1 : n), 0);
  /** px/s of wheel input over the last WINDOW. */
  const rate = (now: number) => (sum(now - WINDOW, now) * 1000) / WINDOW;
  /** Input not slowing: the last 200 ms at least 85% of the 200 ms before (a wheel spun on; a momentum tail halves). */
  const steady = (now: number) => count(now - 400, now - 200) > 0 && sum(now - 200, now) >= 0.85 * sum(now - 400, now - 200);

  /** Whether two positions lie in the same pinned story, whose beats a fling always lands on, however far apart. */
  const story = (a: number, b: number) => pins.some(([p, q]) => Math.min(a, b) >= p - 1 && Math.max(a, b) <= q + 1);
  /** Whether a page at rest at `y` would hold a pinned story's transition half played: anywhere inside one but its ends. */
  const scrubbed = (y: number) => pins.some(([p, q]) => y > p + 1 && y < q - 1);

  /**
   * The next stop past `from` in the direction of travel that the page at `at` has not yet passed, or will not reach
   * within CATCH at `pace` px/s; within REACH, or anywhere in the same pinned story. Undefined when there is none: the
   * fling is free.
   */
  function ahead(from: number, at: number, dir: Dir, pace = 0) {
    const near = NEAR * innerHeight;
    const lead = Math.max(0, pace) * CATCH;
    const ok = (s: number) => (dir > 0 ? s > from + near && s > at + lead : s < from - near && s < at - lead);
    const next = dir > 0 ? stops.find(ok) : upStops.findLast(ok);
    return next !== undefined && (Math.abs(next - at) <= REACH * innerHeight || story(at, next)) ? next : undefined;
  }

  /** px/s the page is about to move at toward `dir`: Lenis's next lerp step, or the landing already under way. */
  function pageSpeed(l: GateLenis, dir: Dir) {
    return (landing ? speed * 1000 : (l.targetScroll - l.animatedScroll) * LERP_STEP * 60) * dir;
  }

  /** Whether this gesture would carry the page at least CARRY of the way to `to` on its own; inside a pinned story any
   * fling does, and so does one that would come to rest inside one, so a flick never rests on a beat half played. */
  function carries(l: GateLenis, to: number, dir: Dir, now: number) {
    if (story(l.animatedScroll, to) || (notched && Math.abs(to - l.animatedScroll) <= NOTCH_REACH * innerHeight)) return true;
    const aim = landing ? landing.to : l.targetScroll;
    const projected = (aim - l.animatedScroll) * dir + Math.min(rate(now) * MOMENTUM, sum(-Infinity, now));
    return projected >= CARRY * Math.abs(to - l.animatedScroll) || scrubbed(l.animatedScroll + dir * projected);
  }

  function land(l: GateLenis, to: number, dir: Dir, now: number) {
    // The landing curve runs along the way with its slow stretches weighted, so each pinned transition on it gets its
    // share of the time; it enters at the page's own speed. A notched wheel's landing is short (NOTCH_TIME): it has no
    // momentum, so a longer one drives on alone after the hand has stopped; across the dolly it is slowed less and shorter
    // still (NOTCH_DOLLY_TIME). Each other slow stretch on the way adds SLOW_TIME.
    const from = l.animatedScroll;
    const on = slow.filter(([a, b]) => Math.max(a, b) > Math.min(from, to) && Math.min(a, b) < Math.max(from, to));
    const dolly = on.some(([, , k]) => k >= DOLLY_WEIGHT);
    const way = warp(from, to, notched ? slow.map(([a, b, k]) => [a, b, k >= DOLLY_WEIGHT ? NOTCH_DOLLY : k] as const) : slow);
    const duration =
      Math.min(dolly ? (notched ? NOTCH_DOLLY_TIME : DOLLY_TIME) : notched ? NOTCH_TIME : Infinity, landingTime(way.length / innerHeight)) +
      SLOW_TIME * on.filter(([, , k]) => k < DOLLY_WEIGHT).length;
    const v = Math.max(0, pageSpeed(l, dir));
    const curve = glide(way.length < 1 ? 0 : (v * duration * way.entry) / way.length);
    landing = { to, dir };
    loose = false;
    fastSince = null;
    takenAt = total;
    chained++;
    hold = { dir, peak: sum(now - PACE, now), low: Infinity, rising: 0, paced: now };
    l.scrollTo(to, {
      duration,
      easing: (t) => way.at(curve(t)),
      onComplete: () => {
        if (landing?.to === to) landing = null;
      },
    });
  }

  /** A free run has ended: it comes to rest on the stop ahead nearest to where it would have stopped, when that is close,
   * and however far when it would stop inside a pinned story, where only a beat is a whole frame; or back on the stop it
   * has just passed (SETTLE_BACK), when that one is nearer. With no stop near, it rests on the clean frame nearest
   * (CLEAN), so a free run never leaves a line cut by the nav or the screen's foot. */
  function settle(l: GateLenis) {
    free = false;
    if (yielded) return;
    const dir = lastDir;
    const rest = l.targetScroll;
    const at = l.animatedScroll;
    const list = dir > 0 ? stops : upStops;
    let ahead: number | undefined;
    let back: number | undefined;
    for (const s of list) {
      if ((s - at) * dir > 1) {
        if (ahead === undefined || Math.abs(s - rest) < Math.abs(ahead - rest)) ahead = s;
      } else if ((rest - s) * dir <= SETTLE_BACK * innerHeight && (back === undefined || Math.abs(s - rest) < Math.abs(back - rest))) back = s;
    }
    if (ahead !== undefined && !(Math.abs(ahead - rest) <= SETTLE * innerHeight || scrubbed(rest))) ahead = undefined;
    const stop = back !== undefined && (ahead === undefined || Math.abs(back - rest) < Math.abs(ahead - rest)) ? back : ahead;
    const to = stop ?? fit?.(rest, { min: rest - CLEAN, max: rest + CLEAN });
    // A clean frame where the run rests already: Lenis finishes the run.
    if (to === undefined || (stop === undefined && Math.abs(to - rest) <= 1) || Math.abs(to - at) <= 1) return;
    land(l, to, to > at ? 1 : -1, performance.now());
  }

  /**
   * A gesture the page took no stop for has gone quiet. Inside a pinned story only a finished beat is a whole frame, so
   * when the page is bound for anywhere else in one it settles on the nearest beat (RESTS), measured from where it would
   * have come to rest. A push of TREMOR px or more lands on the beat ahead of where the gesture began, in its direction,
   * nearest where it would rest, so a gentle nudge or one notch moves the story on a beat and never lands against the
   * hand (a 36px push from the hero sprang back to 0). Outside the pinned stories slow scrolling stays the reader's.
   */
  function nudge(l: GateLenis) {
    loose = false;
    if (yielded) return;
    const dir = lastDir;
    const rest = l.targetScroll;
    const at = l.animatedScroll;
    if (!scrubbed(rest) || rests.some((s) => Math.abs(s - rest) <= 1)) return;
    let back: number | undefined;
    let ahead: number | undefined;
    for (const s of rests) {
      if ((s - rest) * dir > 0) {
        if (ahead === undefined || (s - ahead) * dir < 0) ahead = s;
      } else if (back === undefined || (s - back) * dir > 0) back = s;
    }
    let to: number | undefined;
    if ((rest - origin) * dir >= TREMOR) {
      for (const s of rests) {
        if ((s - origin) * dir > 1 && (to === undefined || Math.abs(s - rest) < Math.abs(to - rest))) to = s;
      }
    }
    if (to === undefined) to = ahead !== undefined && (back === undefined || Math.abs(ahead - rest) <= Math.abs(back - rest)) ? ahead : back;
    // Landed on even where the page is on it already: Lenis would ease on past it to where the gesture was bound.
    if (to !== undefined) land(l, to, to >= at ? 1 : -1, performance.now());
  }

  /** Whether this notched gesture is a quick flick: its notches under ROLL_NOTCH ms apart (a lone notch is not one). */
  const flicked = () => gaps.length > 0 && [...gaps].sort((x, y) => x - y)[gaps.length >> 1] < ROLL_NOTCH;
  /** ms of quiet before a gesture the page took as the reader's own settles (FLICK_QUIET, ROLL_QUIET). */
  const nudgeQuiet = () => (!notched ? QUIET : flicked() ? FLICK_QUIET : ROLL_QUIET);

  /** The wheel has been quiet with no landing under way: a free run (after QUIET ms), or a gesture the page took as the
   * reader's own (nudgeQuiet), comes to rest on a whole frame. */
  function quieted(l: GateLenis) {
    if (landing) return;
    const idle = performance.now() - lastWall;
    if (free) {
      if (idle > QUIET) settle(l);
    } else if (loose && idle > nudgeQuiet()) nudge(l);
  }

  /** The page takes this event as the reader's own scroll. */
  const pass = () => {
    loose = true;
    return true;
  };

  /** Whether a held gesture has become a new one: a fresh swipe out of the momentum tail, or a hand scrolling on. */
  function released(h: Hold, now: number) {
    const pace = sum(now - PACE, now);
    h.peak = Math.max(h.peak, pace);
    // After a stall the window is still refilling, which would read as a fresh swipe speeding up.
    if (now >= h.paced && pace < TAIL * h.peak) {
      if (pace > Math.max(40, 1.6 * h.low)) h.rising++;
      else h.rising = 0;
      h.low = Math.min(h.low, pace);
      if (h.rising >= 2) return true;
    } else if (now - 3 * PACE >= h.paced) {
      // A swipe laid on before the last one's momentum fell to its tail: three whole windows since the hold began, each
      // a quarter faster than the one before (a tail only ever slows, a held spin keeps its pace).
      const before = sum(now - 2 * PACE, now - PACE);
      const first = sum(now - 3 * PACE, now - 2 * PACE);
      if (pace > 40 && pace >= 1.25 * before && before >= 1.25 * first) return true;
    }
    if (now - h.paced < STEADY || rate(now) >= FAST) return false;
    // A hand scrolling on keeps its pace; a tail keeps slowing (to about half every 200 ms).
    const recent = sum(now - 200, now);
    return recent >= 80 && count(now - 400, now - 200) > 0 && recent >= 0.85 * sum(now - 400, now - 200);
  }

  const swallow = (event: Event) => {
    if (event.cancelable) event.preventDefault();
    return false;
  };

  /** Lenis's virtualScroll option: false (with the event's default prevented) when the gate takes the event. */
  function wheel({ deltaX, deltaY, event }: VirtualScrollData) {
    const l = lenis;
    if (!l || event.type !== "wheel" || !deltaY || Math.abs(deltaX) > Math.abs(deltaY)) return true;
    if ((event as WheelEvent).ctrlKey || (event as WheelEvent).shiftKey) return true;
    const now = event.timeStamp;
    const dir: Dir = deltaY > 0 ? 1 : -1;
    const a = Math.abs(deltaY);
    const notch = a >= NOTCH && Number.isInteger(deltaY);
    const gap = now - lastT;
    // A notched wheel's gesture ends sooner (notchQuiet): three quick flicks are three gestures, three stops.
    const quiet = notched && notch ? notchQuiet(gaps) : QUIET;
    if (gap >= quiet) {
      // A momentum tail can stall for a frame or two on a busy page; when it resumes, no larger, after input that was
      // still slowing down, it is the same gesture.
      const slowing = sum(lastT - 200, lastT) < 0.9 * sum(lastT - 400, lastT - 200);
      const tail = !notch && hold && dir === hold.dir && gap < TAIL_GAP && slowing && a <= 1.5 * lastA;
      // A spin running free that only paused for less than QUIET (a hand turning the wheel on, a busy frame) runs on.
      const spinning = free && dir === lastDir && gap <= QUIET;
      // A wheel rolled on a notch at a time, 80 to 150 ms apart, the page taking each notch as the reader's own and no
      // beat settled on yet: each notch is a gesture of its own, but the roll is one move of the hand, so it settles from
      // where the roll began (nudge) on the beat nearest where the hand stopped, never on the beat past where its last
      // notch began (a 10-notch roll from the open sheet glided 1.3 windows on to Fraud checks after the hand stopped).
      const rolling = notch && notched && !flicked() && loose && !landing && !free && dir === lastDir;
      if (!tail) {
        hold = null;
        samples = [];
        yielded = false;
        // Whether this gesture may scroll an inner scroller is decided once, where it began: a fling that began on the
        // page and lands with the pointer over the console never scrolls the console with its momentum.
        startedInner = nested(event, dir);
        notched = true;
        chained = 0;
        free = spinning;
        if (!spinning) fastRun = 0;
        total = 0;
        takenAt = 0;
        gaps = [];
      } else if (hold) {
        hold.paced = now + PACE;
        hold.low = Infinity;
        hold.rising = 0;
      }
      ({ stops, up: upStops = stops, slow = [], inner: innerStops = [], rests = stops, pins = [], fit } = read());
      if (!rolling) origin = l.animatedScroll;
    }
    if (dir !== lastDir) {
      samples = [];
      free = false;
      fastRun = 0;
    }
    lastT = now;
    lastA = a;
    lastDir = dir;
    lastWall = performance.now();
    if (notch && gap <= quiet && gaps.push(gap) > 8) gaps.shift();
    if (!notch) notched = false;
    // Lenis may have stopped moving the page before the wheel has been quiet long enough to tell (a tiny nudge).
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => lenis && quieted(lenis), Math.max(QUIET, nudgeQuiet()) + 20);
    samples.push({ t: now, a });
    while (samples[0].t < now - 500) samples.shift();
    total += a;
    const fast = rate(now) >= FAST;
    if (fast && gap <= 2 * PACE) fastRun += gap;
    if (yielded) return true;
    // A wheel held at FAST, not slowing, for SPIN ms is a spin across the page, not a fling to the next beat: it runs
    // free from here, landing or not, and comes to rest on a stop when it ends (settle).
    if (!free && fast && fastRun >= (notched ? NOTCH_SPIN : SPIN) && steady(now)) {
      free = true;
      hold = null;
      landing = null;
    }
    if (free) return true;

    // A reversal is always the reader's: Lenis takes it from wherever the page is.
    if ((hold && dir !== hold.dir) || (landing && dir !== landing.dir)) {
      hold = null;
      landing = null;
      return pass();
    }
    if (hold && released(hold, now)) hold = null;
    // Input kept at FAST for SUSTAIN ms once the landing has finished is a fresh fling (a wheel spun on, a swipe laid on
    // top of the last), not the landing's tail: it goes on to the next stop rather than leaving the page held.
    if (hold && !landing && fast) {
      fastSince ??= now;
      if (now - fastSince >= SUSTAIN) {
        hold = null;
        fastSince = null;
        // Spun on hard past its stop: the reader wants to be somewhere else, and the page goes with the wheel.
        if (chained >= ESCAPE) {
          free = true;
          return true;
        }
      }
    } else if (!fast) fastSince = null;
    const inner = startedInner && nested(event, dir);

    if (landing) {
      if (inner) return true;
      // A fresh fling while the page is still landing heads on from the stop it is landing on, however short: the hand
      // that starts a new gesture mid-landing means the next stop (a notched wheel's flick of two notches is one). With
      // no stop ahead within reach it runs on from there, so no flick is thrown away.
      if (!hold && (fast || (notched && samples.length >= 2))) {
        const next = ahead(landing.to, landing.to, dir);
        if (next === undefined) {
          landing = null;
          return pass();
        }
        land(l, next, dir, now);
      }
      // A hard fling's momentum, still pouring in well past the take, carries it on past a story's inner beat.
      else if (hold && innerStops.includes(landing.to) && total - takenAt >= SKIM * innerHeight) {
        const on = ahead(landing.to, landing.to, dir);
        if (on !== undefined) land(l, on, dir, now);
      }
      return swallow(event);
    }
    if (hold) return inner ? true : swallow(event);
    if (!fast) return startedInner ? true : pass();
    const next = ahead(origin, l.animatedScroll, dir, pageSpeed(l, dir));
    if (next === undefined || !carries(l, next, dir, now)) return startedInner ? true : pass();
    if (nested(event, dir)) return true;
    land(l, next, dir, now);
    return swallow(event);
  }

  /** Starts listening on a Lenis made with `wheel` as its virtualScroll option. Returns the cleanup. */
  function attach(l: GateLenis) {
    lenis = l;
    const cancel = () => {
      if (hold || landing) yielded = true;
      hold = null;
      loose = false;
      if (!landing) return;
      landing = null;
      // Hands the page back where it is: stop() and start() both reset Lenis's animation to the actual scroll. A Lenis
      // already stopped (the Menu sheet holds the page) has no landing running and stays stopped.
      if (l.isStopped) return;
      l.stop();
      l.start();
    };
    const offScroll = l.on("scroll", () => {
      const t = performance.now();
      const y = l.animatedScroll;
      if (prev && t > prev.t) speed = (y - prev.y) / (t - prev.t);
      prev = { t, y };
      // A native scroll that moved the page is the reader's. Lenis's own echo of a finished landing reports as native
      // too, without moving: that one must not drop the hold on the rest of the momentum.
      if (l.isScrolling === "native" && l.velocity !== 0) cancel();
      else if (!l.isScrolling) {
        landing = null;
        speed = 0;
      }
      // A free run, or a gesture the page took as the reader's own, whose wheel has gone quiet comes to rest on a whole
      // frame.
      quieted(l);
    });
    // While a landing runs Lenis ignores native scrolls and would write over them: find-in-page, a focus move or a
    // screen reader's scroll into view, an overlay scrollbar's drag. Any of them moving the page from where Lenis put
    // it takes over.
    const onWindowScroll = () => {
      if (landing && Math.abs(scrollY - l.animatedScroll) > DRIFT) cancel();
    };
    const onKey = (e: KeyboardEvent) => {
      if (KEYS.has(e.key)) cancel();
    };
    // The classic scrollbar, and same-page links (the nav's anchors, the skip links), by mouse or keyboard. A click
    // anywhere else never stops a landing half-played.
    const onPointer = (e: PointerEvent) => {
      if (e.clientX >= document.documentElement.clientWidth) cancel();
    };
    const onClick = (e: MouseEvent) => {
      if (samePageHash(e)) cancel();
    };
    addEventListener("scroll", onWindowScroll, { passive: true });
    addEventListener("keydown", onKey, { capture: true });
    addEventListener("pointerdown", onPointer, { capture: true });
    addEventListener("click", onClick, { capture: true });
    return () => {
      clearTimeout(quietTimer);
      offScroll();
      removeEventListener("scroll", onWindowScroll);
      removeEventListener("keydown", onKey, { capture: true });
      removeEventListener("pointerdown", onPointer, { capture: true });
      removeEventListener("click", onClick, { capture: true });
      lenis = null;
    };
  }

  return { wheel, attach };
}
