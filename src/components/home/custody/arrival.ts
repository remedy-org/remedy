// Chapter 06's arrival: the paid claim travels from the owner's side into the recall team's console. Over the console
// beat's first half (ARRIVAL, scrubbed like the dolly: a continuous move, so it plays back as the reader scrolls back)
// the exhibit's paid receipt folds into RM-0442's claim row, held where the receipt lay; the row glides to its slot at
// the top of the queue while the console's window draws itself out round it; the window's content comes in at
// CONSOLE_IN, in time; and the row settles flat into the queue, where the counts tick as it lands (LAND). Pure, so the
// geometry is unit-tested (arrival.test.ts).

import { STARTS, clamp01 } from "./timeline";

/** The arrival's stretch of the timeline: from the console's cut (chapter 06's start) to the row landing. The console
 * stop (0.96, CustodyStage PAGE_STOPS) rests after it, on the finished queue. */
export const ARRIVAL = [STARTS[5], 0.948] as const;

/** Where the console's content (bar, ledger, tabs, the other claims) comes in, in time: once the window is whole. */
export const CONSOLE_IN = ARRIVAL[0] + 0.8 * (ARRIVAL[1] - ARRIVAL[0]);

/** Where RM-0442's row lands in its slot and the queue's counts tick. */
export const LAND = ARRIVAL[1];

/** How far through the arrival p is, 0 to 1. */
export const arrivalAt = (p: number) => clamp01((p - ARRIVAL[0]) / (ARRIVAL[1] - ARRIVAL[0]));

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ramp = (k: number, a: number, b: number) => clamp01((k - a) / (b - a));
/** Smoothstep: eased at both ends, its peak speed only 1.5x the average, so a slow trackpad stroke moves the card as
 * evenly through the middle of each move as at its ends (an in-out cubic peaks at 3x). */
const inOut = (t: number) => t * t * (3 - 2 * t);
const mix = (a: Box, b: Box, t: number): Box => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });

/** The fold (the receipt to a row-tall card where it lay), then the glide (the card to its slot). */
export const FOLD = [0, 0.35] as const;
export const GLIDE = [0.35, 0.8] as const;

/**
 * The card's box at k, in stage px: the receipt's box r0 at 0; folded by FOLD's end into a card the row's size, its
 * right edge and middle held where the receipt's were, so the receipt never moves while it folds, but never past the
 * console window's columns `win` (so on a narrow laptop it never folds out over the rail's words); at the slot r1 by
 * GLIDE's end, and held there.
 */
export function cardAt(k: number, r0: Box, r1: Box, win: Box): Box {
  const x = Math.min(Math.max(r0.x + r0.w - r1.w, win.x), win.x + win.w - r1.w);
  const folded: Box = { x, y: r0.y + r0.h / 2 - r1.h / 2, w: r1.w, h: r1.h };
  return mix(mix(r0, folded, inOut(ramp(k, ...FOLD))), r1, inOut(ramp(k, ...GLIDE)));
}

/** The console window's frame at k: none until the card has folded, then drawn out from the card's box to the window's
 * as the card glides, whole by GLIDE's end. */
export function frameAt(k: number, card: Box, win: Box): Box | null {
  const t = inOut(ramp(k, ...GLIDE));
  return t <= 0 ? null : mix(card, win, t);
}

/**
 * The card's look at k, each 0 to 1. `receipt`: the receipt's own paper and words, gone as it folds. `paper`: the card's
 * ground, the receipt's paper turning to the console's surface. `row`: RM-0442's row, in once the card is all but
 * folded. `lift`: the card's ground, edge and shadow, settling flat into the queue as it lands. `ground`: the card's
 * ground coming up under the receipt's perforated edge, so its first frame is the receipt exactly.
 */
export function lookAt(k: number) {
  return {
    receipt: 1 - ramp(k, 0.04, 0.18),
    ground: ramp(k, 0, 0.06),
    paper: 1 - ramp(k, 0.06, 0.26),
    row: ramp(k, 0.2, 0.34),
    lift: 1 - ramp(k, 0.82, 1),
  };
}
