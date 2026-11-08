import type Lenis from "lenis";
import type { VirtualScrollData } from "lenis";
import { landing as glide, landingTime, warp, type Slow } from "./landing";

// Scroll stops for the wheel. A fast wheel or trackpad fling is taken, as soon as it reads as fast, to the next stop in
// its direction (stops.ts) and lands exactly there, on a glide long enough for the scrubbed transition on the way to be
// seen (landing.ts); the rest of that gesture (the trackpad's momentum, a free-spinning wheel) is absorbed there. The
// next beat takes a fresh gesture: a pause, a new swipe or a reversal. A wheel spun on hard after its landing has made
// its point: the rest of that gesture scrolls freely (ESCAPE). Going up, the pinned stories' inner
// beats are not stops (stops.ts), since a story scrubbed backwards shows nothing new. Slow scrolling never meets a stop,
// and a short flick that would not have carried halfway to the next stop runs free. Only the wheel is gated: keys, anchor links,
// the scrollbar, find-in-page, focus moves, touch and screen readers scroll natively and cancel a landing at once.

/** The input rate is measured over this many ms. */
const WINDOW = 150;
/** px/s of wheel input over WINDOW that counts as a fling rather than reading (a steady hand is about 900). */
const FAST = 2000;
/** ms without a wheel event that ends a gesture, unless it resumes within TAIL_GAP ms as the same slowing tail. */
const QUIET = 140;
const TAIL_GAP = 400;
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
/** A wheel's notches (|deltaY| this big or more, whole px): no momentum to play out, so its landings stay short. */
const NOTCH = 50;
/** Seconds a notched wheel's landing takes at most (the hero's dolly excepted), so the page never drives on long after
 * the hand has stopped. */
const NOTCH_TIME = 1.1;
/** The slow stretch's weight that marks the hero's dolly (stops.ts SLOW), and the weight a notched wheel crosses it at. */
const DOLLY_WEIGHT = 5;
const NOTCH_DOLLY = 3.5;
/** Seconds a landing across the dolly takes at most: the dolly plays, and the page is at rest about a second after. */
const DOLLY_TIME = 1.2;
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
/** Lenis's lerp, 0.1 (SmoothScroll.tsx): each 60 Hz frame covers this share of the way left to its target. */
const LERP_STEP = 1 - Math.exp(-0.1);
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
 * crosses slowly (landing.ts warp). */
export type Course = { stops: number[]; up?: number[]; slow?: readonly Slow[] };

export function createGate(read: () => Course) {
  let lenis: GateLenis | null = null;
  let samples: Sample[] = [];
  let lastT = -Infinity;
  let lastA = 0;
  let lastDir: Dir = 1;
  let stops: number[] = [];
  let upStops: number[] = [];
  let slow: readonly Slow[] = [];
  let hold: Hold | null = null;
  let landing: { to: number; dir: Dir } | null = null;
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
  /** The page's own speed, px/ms, from Lenis's last two frames. */
  let speed = 0;
  let prev: { t: number; y: number } | null = null;

  const sum = (from: number, to: number) => samples.reduce((s, e) => (e.t > from && e.t <= to ? s + e.a : s), 0);
  const count = (from: number, to: number) => samples.reduce((n, e) => (e.t > from && e.t <= to ? n + 1 : n), 0);
  /** px/s of wheel input over the last WINDOW. */
  const rate = (now: number) => (sum(now - WINDOW, now) * 1000) / WINDOW;

  /**
   * The next stop past `from` in the direction of travel that the page at `at` has not yet passed, or will not reach
   * within CATCH at `pace` px/s; within REACH. Undefined when there is none: the fling is free.
   */
  function ahead(from: number, at: number, dir: Dir, pace = 0) {
    const near = NEAR * innerHeight;
    const lead = Math.max(0, pace) * CATCH;
    const ok = (s: number) => (dir > 0 ? s > from + near && s > at + lead : s < from - near && s < at - lead);
    const next = dir > 0 ? stops.find(ok) : upStops.findLast(ok);
    return next !== undefined && Math.abs(next - at) <= REACH * innerHeight ? next : undefined;
  }

  /** px/s the page is about to move at toward `dir`: Lenis's next lerp step, or the landing already under way. */
  function pageSpeed(l: GateLenis, dir: Dir) {
    return (landing ? speed * 1000 : (l.targetScroll - l.animatedScroll) * LERP_STEP * 60) * dir;
  }

  /** Whether this gesture would carry the page at least CARRY of the way to `to` on its own. */
  function carries(l: GateLenis, to: number, dir: Dir, now: number) {
    const aim = landing ? landing.to : l.targetScroll;
    const projected = (aim - l.animatedScroll) * dir + Math.min(rate(now) * MOMENTUM, sum(-Infinity, now));
    return projected >= CARRY * Math.abs(to - l.animatedScroll);
  }

  function land(l: GateLenis, to: number, dir: Dir, now: number) {
    // The landing curve runs along the way with its slow stretches weighted, so each pinned transition on it gets its
    // share of the time; it enters at the page's own speed. A notched wheel's landing is short (NOTCH_TIME): it has no
    // momentum, so a longer one drives on alone after the hand has stopped; across the dolly it is slowed less instead.
    const from = l.animatedScroll;
    const dolly = slow.some(([a, b, k]) => k >= DOLLY_WEIGHT && Math.max(a, b) > Math.min(from, to) && Math.min(a, b) < Math.max(from, to));
    const way = warp(from, to, notched ? slow.map(([a, b, k]) => [a, b, k >= DOLLY_WEIGHT ? NOTCH_DOLLY : k] as const) : slow);
    const duration = Math.min(dolly ? DOLLY_TIME : notched ? NOTCH_TIME : Infinity, landingTime(way.length / innerHeight));
    const v = Math.max(0, pageSpeed(l, dir));
    const curve = glide(way.length < 1 ? 0 : (v * duration * way.entry) / way.length);
    landing = { to, dir };
    fastSince = null;
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
    if (now - lastT > QUIET) {
      // A momentum tail can stall for a frame or two on a busy page; when it resumes, no larger, after input that was
      // still slowing down, it is the same gesture.
      const slowing = sum(lastT - 200, lastT) < 0.9 * sum(lastT - 400, lastT - 200);
      const tail = hold && dir === hold.dir && now - lastT < TAIL_GAP && slowing && a <= 1.5 * lastA;
      if (!tail) {
        hold = null;
        samples = [];
        yielded = false;
        // Whether this gesture may scroll an inner scroller is decided once, where it began: a fling that began on the
        // page and lands with the pointer over the console never scrolls the console with its momentum.
        startedInner = nested(event, dir);
        notched = true;
        chained = 0;
        free = false;
      } else if (hold) {
        hold.paced = now + PACE;
        hold.low = Infinity;
        hold.rising = 0;
      }
      ({ stops, up: upStops = stops, slow = [] } = read());
      origin = l.animatedScroll;
    }
    if (dir !== lastDir) {
      samples = [];
      free = false;
    }
    lastT = now;
    lastA = a;
    lastDir = dir;
    if (a < NOTCH || !Number.isInteger(deltaY)) notched = false;
    samples.push({ t: now, a });
    while (samples[0].t < now - 500) samples.shift();
    if (yielded || free) return true;

    // A reversal is always the reader's: Lenis takes it from wherever the page is.
    if ((hold && dir !== hold.dir) || (landing && dir !== landing.dir)) {
      hold = null;
      landing = null;
      return true;
    }
    if (hold && released(hold, now)) hold = null;
    const fast = rate(now) >= FAST;
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
      // A fresh fling while the page is still landing heads on from the stop it is landing on.
      const next = !hold && fast ? ahead(landing.to, landing.to, dir) : undefined;
      if (next !== undefined && carries(l, next, dir, now)) land(l, next, dir, now);
      return swallow(event);
    }
    if (hold) return inner ? true : swallow(event);
    if (!fast) return true;
    const next = ahead(origin, l.animatedScroll, dir, pageSpeed(l, dir));
    if (next === undefined || !carries(l, next, dir, now) || nested(event, dir)) return true;
    land(l, next, dir, now);
    return swallow(event);
  }

  /** Starts listening on a Lenis made with `wheel` as its virtualScroll option. Returns the cleanup. */
  function attach(l: GateLenis) {
    lenis = l;
    const cancel = () => {
      if (hold || landing) yielded = true;
      hold = null;
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
