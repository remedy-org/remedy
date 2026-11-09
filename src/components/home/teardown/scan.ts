// Check 1's scan: a white line sweeping down the photo on the owner's phone, as the claim page's own camera checks its
// capture. The phone is drawn by the scene (scene/parts.ts); the line is drawn over it in the DOM (OpenedExhibit.tsx),
// on the photo's projected corners, so it is a crisp 1.5px line clipped to the photo however small the phone is, and it
// runs on a clock while the phone is up: a reader resting on the live check sees it working, and scrolling through it
// does too. No three.js here, and no DOM: pure, so it is unit-tested (scan.test.ts).

/** A point on the stage, CSS px. */
export type Pt = readonly [x: number, y: number];

/** One sweep, top to bottom, and the pause before the next (ms). */
export const SWEEP_MS = 1900;
export const PAUSE_MS = 450;
/** The glow above the line, as a share of the photo's height. */
export const TRAIL = 0.16;
/** The share of a sweep the line brightens in over at the top and dims out over at the foot. */
const EDGE = 0.07;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

/**
 * Where the line is `ms` after the phone came up: `s` from the photo's top (0) to its foot (1), and its strength (0 to
 * 1), which eases in and out at the ends of each sweep, so it never pops on at the photo's edge. Null in the pause.
 */
export function scanAt(ms: number): { s: number; alpha: number } | null {
  const t = ((ms % (SWEEP_MS + PAUSE_MS)) + SWEEP_MS + PAUSE_MS) % (SWEEP_MS + PAUSE_MS);
  if (t >= SWEEP_MS) return null;
  // Eased like a camera's own scan: quick off the top edge, slowing a touch into the foot.
  const k = t / SWEEP_MS;
  const s = 1 - (1 - k) ** 1.6;
  return { s, alpha: smooth(clamp01(Math.min(k / EDGE, (1 - k) / EDGE))) };
}

/**
 * The point (u, v) of the photo, u across from its left edge and v down from its top (0 to 1), on the stage: the
 * projective map of the unit square onto the photo's four projected corners (top left, top right, bottom right, bottom
 * left), so the line lies in the photo's plane even with the phone tilted away (Heckbert's square-to-quad mapping).
 */
export function quadPoint(q: readonly Pt[], u: number, v: number): Pt {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  let a: number, b: number, d: number, e: number, g: number, h: number;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    [a, b, d, e, g, h] = [x1 - x0, x3 - x0, y1 - y0, y3 - y0, 0, 0];
  } else {
    const dx1 = x1 - x2;
    const dx2 = x3 - x2;
    const dy1 = y1 - y2;
    const dy2 = y3 - y2;
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    h = (dx1 * sy - sx * dy1) / den;
    a = x1 - x0 + g * x1;
    b = x3 - x0 + h * x3;
    d = y1 - y0 + g * y1;
    e = y3 - y0 + h * y3;
  }
  const w = g * u + h * v + 1;
  return [(a * u + b * v + x0) / w, (d * u + e * v + y0) / w];
}

/**
 * The line and its glow at sweep position s on the photo `q`: the line's two ends on the photo's side edges, and the
 * glow's quad from the line up TRAIL of the photo, cut at the photo's top edge, so nothing spills off the photo.
 */
export function scanGeometry(q: readonly Pt[], s: number) {
  const top = Math.max(0, s - TRAIL);
  const l = quadPoint(q, 0, s);
  const r = quadPoint(q, 1, s);
  const tl = quadPoint(q, 0, top);
  const tr = quadPoint(q, 1, top);
  return { line: [l, r] as const, glow: [tl, tr, r, l] as const, from: quadPoint(q, 0.5, s - TRAIL), to: quadPoint(q, 0.5, s) };
}
