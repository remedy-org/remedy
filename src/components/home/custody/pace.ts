// The pinned Chain of Custody's pacing. Every move on the stage is written against the sequence's own timeline p (0 to
// 1: the dolly, then chapters 01 to 05, then the console; claim.ts and CustodyStage hold the thresholds). The scroll s
// through the runway maps onto p piecewise, so each beat gets its own share of the scroll instead of p's share: about
// 80 to 100vh of wheel per beat (BRIEF decision 4), so nothing flies past. Change the budget here, never the thresholds.

import { TOTAL_VH as EXHIBIT_VH } from "../teardown/model";

/** The beats, as [where the beat starts on p, the vh of scroll it gets]. */
const BEATS: [p: number, vh: number][] = [
  [0, 16], // the hero at rest, before the dolly starts
  [0.04, 64], // the dolly: the laptop's screen becomes the stage
  [0.2, 80], // 01 Log in with PayPal
  [0.34, 80], // 02 One-time code
  // 03 to 05: the Opened Exhibit, one linear stretch, so its own seven beats (teardown/model.ts) keep the share of
  // the scroll they were designed for: 70 to 85vh each, the code check and the payout longest.
  [0.48, EXHIBIT_VH],
  [0.9, 60], // the console
];

/** Scroll distance through the pinned runway, in vh: the runway is this plus one stage tall (custody.module.css). */
export const SCROLL_VH = BEATS.reduce((sum, [, vh]) => sum + vh, 0);

/** Knots for useTransform(s, PACE.scroll, PACE.p): raw scroll progress to timeline progress. */
export const PACE = (() => {
  const scroll = [0];
  const p = [0];
  let at = 0;
  BEATS.forEach(([, vh], i) => {
    at += vh;
    scroll.push(at / SCROLL_VH);
    p.push(BEATS[i + 1]?.[0] ?? 1);
  });
  return { scroll, p };
})();

/** Where on the raw scroll (0 to 1) the timeline reaches `t`: for anchors into the sequence. */
export function scrollAt(t: number) {
  for (let i = 1; i < PACE.p.length; i++) {
    if (t <= PACE.p[i]) {
      const k = (t - PACE.p[i - 1]) / (PACE.p[i] - PACE.p[i - 1]);
      return PACE.scroll[i - 1] + k * (PACE.scroll[i] - PACE.scroll[i - 1]);
    }
  }
  return 1;
}
