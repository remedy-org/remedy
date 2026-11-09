// The glide a fling lands on its stop with (gate.ts). Pure, so its shape is unit-tested (landing.test.ts).

/** How fast a landing sheds the extra speed it was caught with: an e-fold every 3.5% of the landing (about 50 ms). */
const TAU = 0.035;
const TAU_ = TAU * (1 - Math.exp(-1 / TAU));

/**
 * A landing's progress over its time t (0 to 1), entered at speed s0 (distance over duration, the page's own speed when
 * it was caught): a short brake from that speed, then a glide whose speed falls evenly to rest on the stop. The catch
 * never jolts and from rest it eases in.
 */
export function landing(s0: number) {
  // Up to 16 times the landing's average speed: the glide after the brake stays forward-moving up to about 28.
  const v = Math.min(16, Math.max(0, s0));
  const glide = (1 - v * TAU_) / (0.5 - TAU_);
  const brake = v - glide;
  return (t: number) => brake * TAU * (1 - Math.exp(-t / TAU)) + glide * (t - (t * t) / 2);
}

/**
 * A trackpad's landing, and a key's: progress over its time t (0 to 1), entered at speed s0 (distance over duration).
 * From rest it eases in and out (smoothstep, its peak 1.5 times its average speed), so the page never sets off at full
 * speed; entered moving, it carries on at the page's own speed and slows to rest, never a jolt. A speed over 3, which
 * this curve would carry past the stop, takes the brake (landing).
 */
export function calm(s0: number) {
  const v = Math.max(0, s0);
  if (v > 3) return landing(v);
  return (t: number) => v * (t * t * t - 2 * t * t + t) + (3 * t * t - 2 * t * t * t);
}

/**
 * Seconds for a landing `d` windows long (slow stretches counted at their weight, warp): a close stop in 0.9 s, a beat
 * of the exhibit (about 0.7 of a window) in about 1.2 s, a long way in 1.4 s at most, so the page is at rest soon after
 * the hand and never drives on alone.
 */
export const landingTime = (d: number) => Math.min(1.4, Math.max(0.9, 0.8 + 0.6 * d));

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

/** A trackpad landing's top speed, px/s. The owner's Mac trackpad felt the exhibit's landings, up to 5,000 px/s, as
 * "very fast"; a calm glide from rest peaks at 1.5 times its average speed, so a landing takes at least 1.5 times its
 * way over this. */
export const CALM_PEAK = 1450;
/** Seconds a trackpad landing takes: CALM_MIN for a stop under a screen away, CALM_PER more a screen beyond that, CALM_MAX
 * at two screens; up to CALM_SLOW more when the way crosses slow stretches, so their transitions play. */
const CALM_MIN = 0.95;
const CALM_PER = 0.65;
const CALM_MAX = 1.6;
const CALM_SLOW = 0.3;

/**
 * A trackpad landing from `from` to `to` on a screen `screen` px tall: how long it takes, and its way (warp) with the
 * slow stretches weighted no more than its time allows at CALM_PEAK. Its time scales with the distance and never lets the
 * calm curve from rest pass CALM_PEAK anywhere: on a slow stretch the page goes slower still, and the rest of the way is
 * never sped up past CALM_PEAK to pay for it (an exhibit landing over two checks at 3x peaked at 5,000 px/s). `cap`
 * shortens it, but never under that floor.
 */
export function calmLanding(from: number, to: number, screen: number, slow: readonly Slow[] = [], cap = Infinity) {
  const px = Math.abs(to - from);
  const full = warp(from, to, slow);
  const base = Math.min(CALM_MAX, Math.max(CALM_MIN, CALM_MIN + (CALM_PER * (px - screen)) / screen));
  const want = Math.max(base, Math.min(base + CALM_SLOW, (1.5 * full.length) / CALM_PEAK));
  const duration = Math.max((1.5 * px) / CALM_PEAK, Math.min(cap, want));
  // The share of each slow stretch's extra weight this time has room for.
  const extra = full.length - px;
  const k = extra > 0 ? Math.min(1, Math.max(0, ((CALM_PEAK * duration) / 1.5 - px) / extra)) : 1;
  const way = k >= 1 ? full : warp(from, to, slow.map(([a, b, w]) => [a, b, 1 + (w - 1) * k] as const));
  return { duration, way };
}
