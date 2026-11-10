// The one calm glide every landing takes, a trackpad swipe's, a wheel notch's and a key's (gate.ts, keys.ts). Pure, so
// its shape is unit-tested (landing.test.ts).

/** The least share of a landing's time each of its ease in and ease out takes; the most is half (no cruise between). */
const EASE_MIN = 0.14;
const EASE_MAX = 0.5;
/** The ease a landing keeps when it crosses slow stretches: they are weighted only as far as leaves it this much, so the
 * page never speeds up sharply leaving one near the stop. */
const EASE_SOFT = 0.18;

/**
 * A calm landing's progress over its time t (0 to 1), entered at speed s0 (distance over duration, the page's own speed
 * when it was caught), easing for the share `ease` of its time at each end. Its speed rises on a half cosine from s0 to
 * a steady cruise, holds it, and falls on a half cosine to rest on the stop, so the page never sets off, changes pace or
 * stops with a jolt: from rest its acceleration starts at nothing too. With `ease` at a half it has no cruise and peaks
 * at twice its average speed; at the least, 1.16 times. Entered faster than it can carry onto the stop (over 1 / ease),
 * it is entered at that.
 */
export function calm(s0: number, ease = EASE_MAX) {
  const r = Math.min(EASE_MAX, Math.max(0.01, ease));
  const v0 = Math.min(1 / r, Math.max(0, s0));
  const vc = (1 - (v0 * r) / 2) / (1 - r);
  const ramp = (r * (v0 + vc)) / 2;
  return (t: number) => {
    const u = Math.min(1, Math.max(0, t));
    if (u < r) return v0 * u + (vc - v0) * (u / 2 - (r / (2 * Math.PI)) * Math.sin((Math.PI * u) / r));
    if (u <= 1 - r) return ramp + vc * (u - r);
    const w = u - (1 - r);
    return Math.min(1, ramp + vc * (1 - 2 * r) + vc * (w / 2 + (r / (2 * Math.PI)) * Math.sin((Math.PI * w) / r)));
  };
}

/**
 * A stretch of the page, [from, to] in scrollY, that a glide crosses `weight` times slower than the rest: a pinned
 * beat whose transition plays as the page scrolls (the hero's dolly, the sheet unfolding, the string being cut).
 */
export type Slow = readonly [from: number, to: number, weight: number];

/**
 * A glide's way from `from` to `to`, with its slow stretches. `length` is the way in px with each slow px counted
 * `weight` times; `at` maps progress along that weighted way (0 to 1) to progress along the page, so a landing curve
 * run on the weighted way gives each slow stretch its weight's worth of the time. Under a pinned stage the screen holds
 * still between beats, so the change of pace shows only as more time for the transition. `entry` is the weight where
 * the glide starts, to enter it at the page's own speed.
 */
export function warp(from: number, to: number, slow: readonly Slow[] = []) {
  const len = Math.abs(to - from);
  const dir = to >= from ? 1 : -1;
  const xs = new Set([0, len]);
  for (const [a, b] of slow)
    for (const y of [a, b]) {
      const x = (y - from) * dir;
      if (x > 0 && x < len) xs.add(x);
    }
  const knots = [...xs].sort((p, q) => p - q);
  const weightAt = (y: number) => slow.reduce((w, [a, b, k]) => (y > Math.min(a, b) && y < Math.max(a, b) ? Math.max(w, k) : w), 1);
  const pieces = knots.slice(1).map((x1, i) => ({ x0: knots[i], x1, w: weightAt(from + dir * ((knots[i] + x1) / 2)) }));
  const length = pieces.reduce((s, p) => s + (p.x1 - p.x0) * p.w, 0);
  return {
    length,
    entry: pieces[0]?.w ?? 1,
    at(u: number) {
      if (!length) return 1;
      let v = Math.min(1, Math.max(0, u)) * length;
      for (const p of pieces) {
        const span = (p.x1 - p.x0) * p.w;
        if (v <= span) return (p.x0 + v / p.w) / len;
        v -= span;
      }
      return 1;
    },
  };
}

/** A landing's top speed, px/s. The owner's Mac trackpad felt the exhibit's landings, up to 5,000 px/s, as "very fast",
 * and then 1,450 as "scrolling way faster than it should be": slow, smooth and calm (1,000, so the renderer's frame jitter
 * never reads over 1,100). */
export const CALM_PEAK = 1000;
/** Seconds a landing takes: CALM_MIN for a stop up to a screen away, CALM_PER more for each screen beyond, and longer
 * still when its way is too long to cover at CALM_PEAK easing gently; up to CALM_SLOW more when the way crosses slow
 * stretches, so their transitions play. */
const CALM_MIN = 1.3;
/** A story beat gets time for its camera move and incoming screen to finish before the reader moves on. */
export const STORY_MIN = 1.65;
const CALM_PER = 0.7;
const CALM_SLOW = 0.3;

/**
 * A landing from `from` to `to` on a screen `screen` px tall: how long it takes, its way (warp) with the slow stretches
 * weighted no more than its time allows at CALM_PEAK, and its ease (calm). Its time scales with the distance: a beat
 * under a screen away in 1.3 s, two screens in about 2.1 s, never so short that the page passes CALM_PEAK easing in and
 * out over EASE_MIN of it each; on a slow stretch the page goes slower still, as far as leaves it EASE_SOFT to ease
 * over, and the rest of the way is never sped up past CALM_PEAK to pay for it. Its ease is as long as CALM_PEAK leaves room for, half the time each way at most. `cap`
 * shortens it, but never under that floor.
 */
export function calmLanding(from: number, to: number, screen: number, slow: readonly Slow[] = [], cap = Infinity, minimum = CALM_MIN) {
  const landing = plan(from, to, screen, slow, cap, minimum);
  underWay = { to, until: performance.now() + landing.duration * 1000 };
  return landing;
}

/** The landing under way, for the page to read: its stop (scrollY) and when it lands (performance.now()). Recorded as
 * gate.ts and keys.ts plan each glide (calmLanding), and read only by Pipeline.tsx, which inks Fraud checks as a glide
 * heads for it (the curve's peak is under the speed that once said so); nothing in the glide reads it back. */
let underWay: { to: number; until: number } | null = null;
export const landingUnderWay = (): Readonly<{ to: number; until: number }> | null =>
  underWay && performance.now() < underWay.until ? underWay : null;

function plan(from: number, to: number, screen: number, slow: readonly Slow[], cap: number, minimum: number) {
  const px = Math.abs(to - from);
  const full = warp(from, to, slow);
  const soft = CALM_PEAK * (1 - EASE_SOFT);
  const base = minimum + (CALM_PER * Math.max(0, px - screen)) / screen;
  const want = full.length > px ? Math.max(base, Math.min(base + CALM_SLOW, full.length / soft)) : base;
  const duration = Math.max(px / (CALM_PEAK * (1 - EASE_MIN)), Math.min(cap, want));
  // The share of each slow stretch's extra weight this time has room for, easing over EASE_SOFT of it.
  const extra = full.length - px;
  const k = extra > 0 ? Math.min(1, Math.max(0, (soft * duration - px) / extra)) : 1;
  const way = k >= 1 ? full : warp(from, to, slow.map(([a, b, w]) => [a, b, 1 + (w - 1) * k] as const));
  const ease = Math.min(EASE_MAX, Math.max(EASE_MIN, 1 - way.length / (CALM_PEAK * Math.max(duration, 1e-6))));
  return { duration, way, ease };
}

/** The speed, as calm's s0, that a landing (calmLanding) is entered at when the page moves at `v` px/s toward its stop:
 * no more than CALM_PEAK. */
export function entry(v: number, landing: { duration: number; way: ReturnType<typeof warp> }) {
  const { duration, way } = landing;
  return way.length < 1 ? 0 : (Math.min(Math.max(0, v), CALM_PEAK) * duration * way.entry) / way.length;
}
