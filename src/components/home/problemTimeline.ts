// The Problem section's timeline (Problem.tsx). Every beat is a range of t, in vh of scroll from the moment the section's top
// enters the bottom of the viewport (t = 0). On a pinned laptop the section is SECTION_VH tall: it scrolls into place
// over t 0 to 100, holds from 100 to SECTION_VH, and its last OVERLAP_VH (a full screen) run under section B, which
// scrolls over the held sheet until it fills the screen. The page is no longer for it: the section's negative margin
// takes back the same OVERLAP_VH.
// problem.module.css mirrors SECTION_VH, OVERLAP_VH and the anchor offset (t = ANCHOR_AT).

export type Range = readonly [number, number];

export const SECTION_VH = 334;
/** Section B scrolls fully over the held sheet, so the sheet is never sliced by B's edge and carried off half-covered. */
export const OVERLAP_VH = 100;
/** Where the nav's "A Problem" link lands: the sheet open and card 3 landing on the half that just unfolded. */
export const ANCHOR_AT = 120;

export const T = {
  // Entrance: the sheet rises 6vh out of the desk's shade as soon as it is on screen, leaning back 14deg, tilted
  // -5.5deg, folded just under card 1 with its lower part tucked behind (so the headline is never covered). Cards 1
  // and 2 land on the part that shows while it rises. The lower part then swings down into view once its crease is
  // above the lower quarter of the screen, and settles flat as the pin takes hold.
  rise: [0, 90],
  shade: [4, 30],
  lean: [0, 96],
  tilt: [0, 100],
  card1: [50, 62],
  fig: [54, 64],
  card2: [62, 74],
  span1: [64, 74],
  hl: [74, 82],
  fold: [74, 114],
  // The read on the open sheet: card 3 lands as the lower half settles, then card 4, each before the string reaches
  // it; the return closes the loop and the ring circles 6-10%.
  card3: [108, 118],
  span2: [110, 119],
  card4: [120, 130],
  span3: [122, 131],
  ret: [131, 140],
  ring: [139, 148],
  // Citations print after the claims they back.
  sources: [146, 154],
  // The cut: the closed loop holds, a bold slash crosses the span, the string snaps and its ends recoil and fall.
  // The payoff's first line prints under the cut as it snaps, so the cut is never unexplained; then the lamp narrows
  // to a pool on it and the rest of the payoff prints. It then holds 50vh before B arrives.
  mark: [154, 162],
  snip: [161, 167],
  droop: [162, 184],
  payoff: [162, 184],
  dim: [168, 184],
  // B scrolls over the held sheet at reading speed; the sheet sinks over its first half (half the entrance).
  cover: [SECTION_VH - OVERLAP_VH, SECTION_VH],
  sink: [SECTION_VH - OVERLAP_VH, SECTION_VH - OVERLAP_VH / 2],
} as const satisfies Record<string, Range>;

/** The payoff's lead line prints over its first 10vh (with the snap), the rest over its last 12vh. */
export const PAYOFF_LEAD = 10;
export const PAYOFF_REST = 12;

/** The finished state: everything printed, the string cut, the payoff shown. */
export const REST = T.payoff[1];

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const seg = (t: number, [a, b]: Range) => clamp((t - a) / (b - a));

/** A CSS cubic-bezier as a function of x (Newton, then bisection), so scrubbed beats keep DESIGN.md's curves. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const fx = (s: number) => ((ax * s + bx) * s + cx) * s;
  const fy = (s: number) => ((ay * s + by) * s + cy) * s;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let s = x;
    for (let i = 0; i < 8; i++) {
      const d = (3 * ax * s + 2 * bx) * s + cx;
      if (Math.abs(d) < 1e-6) break;
      s -= (fx(s) - x) / d;
    }
    if (s < 0 || s > 1 || Math.abs(fx(s) - x) > 1e-4) {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 30; i++) {
        s = (lo + hi) / 2;
        if (fx(s) < x) lo = s;
        else hi = s;
      }
    }
    return fy(s);
  };
}

/** Entrances (--ease-out-expo); objects, lines and strings (--ease-out-quart); the hinge's turn (--ease-in-out-quart). */
export const outExpo = bezier(0.16, 1, 0.3, 1);
export const outQuart = bezier(0.165, 0.84, 0.44, 1);
export const inOutQuart = bezier(0.76, 0, 0.24, 1);

/** A stamp landing: 1.4 to 0.96 (4% past rest), then settling at 1. No bounce. */
export function stampScale(x: number) {
  const k = clamp(x);
  return k < 0.7 ? 1.4 - 0.44 * outQuart(k / 0.7) : 0.96 + 0.04 * outQuart((k - 0.7) / 0.3);
}

/**
 * The visible piece [from, to] of a path drawn with pathLength 1, as a dash and an offset. A gap-first pattern would
 * leave a round cap's dot at the path's start; a negative offset never does. Nothing to show returns null (hide it).
 */
export function dash(from: number, to: number): { array: string; offset: string } | null {
  if (to - from <= 0.002) return null;
  return { array: `${(to - from).toFixed(4)} 3`, offset: `${(-from).toFixed(4)}` };
}

/** Linear between knots [x, t], clamped at both ends. Knots are forced to rise in x so the map never runs backwards. */
export function piecewise(knots: readonly (readonly [number, number])[], x: number) {
  if (!knots.length) return REST;
  const k: [number, number][] = [];
  for (const [kx, kt] of knots) k.push([k.length ? Math.max(kx, k[k.length - 1][0] + 1) : kx, kt]);
  if (x <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    const [x0, t0] = k[i - 1];
    const [x1, t1] = k[i];
    if (x <= x1) return t0 + ((x - x0) / (x1 - x0)) * (t1 - t0);
  }
  return k[k.length - 1][1];
}
