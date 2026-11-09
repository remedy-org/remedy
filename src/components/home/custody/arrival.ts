// Chapter 06's arrival: the paid claim travels from the owner's side into the recall team's console, as one move, all
// of it scrubbed like the dolly (so a slow scroll plays it at the reader's pace and scrolling back plays it backwards).
// Past the paid stop the exhibit fades and lifts away round its receipt (EXHIBIT_OUT), and the rail comes back once its
// heading has gone (RAIL_BACK); over the console beat's first half (ARRIVAL) the receipt folds into RM-0442's claim row,
// held where the receipt lay; the row glides to its slot at the top of the queue while the console's window draws
// itself out round it; the window's bar, its ledger, tabs and header and the other claims' rows come in one after
// another, top to bottom, once the window is drawn (CONSOLE_IN); and the row settles flat into the queue, where the
// counts tick as it lands (LAND). Pure, so the geometry and the order are unit-tested (arrival.test.ts).

import { STARTS, clamp01 } from "./timeline";

/** The arrival's stretch of the timeline: from the console's cut (chapter 06's start) to the row landing. The console
 * stop (0.96, CustodyStage PAGE_STOPS) rests after it, on the finished queue. */
export const ARRIVAL = [STARTS[5], 0.955] as const;

/** The exhibit's way out, past the paid stop (0.8777, CustodyStage PAGE_STOPS): it fades and lifts away while the card
 * stands in for its receipt, gone just after the console's cut, as the receipt starts to fold. */
export const EXHIBIT_OUT = [0.884, 0.906] as const;
/** How far the exhibit lifts as it goes (px). Its receipt is the card by then, which stays where the receipt lay. */
export const EXHIBIT_LIFT = 16;

/** The rail (How it works, its chapters and the skip link) back, once the exhibit's heading has all but gone. */
export const RAIL_BACK = [0.904, 0.922] as const;

/** Where the console's bar and content come in, one part after another (consoleAt): once its window is all but drawn
 * (GLIDE's end), and all of it before the row lands. */
export const CONSOLE_IN = [0.935, 0.953] as const;

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

/** The fold (the receipt to a row-tall card where it lay), then the glide (the card to its slot). The glide ends with
 * the window's frame whole, before its content comes in (CONSOLE_IN). */
export const FOLD = [0, 0.32] as const;
export const GLIDE = [0.32, 0.7] as const;

/** How far the exhibit is on its way out at p, 0 to 1. */
export const exhibitOutAt = (p: number) => inOut(ramp(p, ...EXHIBIT_OUT));

/** How far the rail is back at p, 0 to 1 (1 once the console beat is under way). */
export const railBackAt = (p: number) => inOut(ramp(p, ...RAIL_BACK));

/** The console's parts in the order they come in: its bar, its ledger, its tabs, the queue's header, then each of the
 * claims under RM-0442's slot. */
export const consoleParts = (rows: number) => 4 + rows;
/** How long each part takes to come in, in p (about 40px of scroll at 900px tall). */
const PART = 0.007;

/** The strength (0 to 1) of the console's part i of n at p: each in its turn across CONSOLE_IN, eased, rising as it
 * comes in, so the window fills top to bottom rather than appearing in one step. */
export function consoleAt(p: number, i: number, n: number) {
  const step = n > 1 ? (CONSOLE_IN[1] - CONSOLE_IN[0] - PART) / (n - 1) : 0;
  const a = CONSOLE_IN[0] + i * step;
  return inOut(ramp(p, a, a + PART));
}

/** How much of its widening, from the receipt's width to the row's, the card does as it folds; the rest as it glides,
 * so its leading edge travels at an even, calm pace through both (all of it in the fold moved that edge about 7px per
 * pixel of scroll). */
export const FOLD_WIDEN = 0.4;

/**
 * The card's box at k, in stage px: the receipt's box r0 at 0; folded by FOLD's end to the row's height and part way to
 * its width, its right edge and middle held where the receipt's were, so the receipt never moves while it folds, but
 * never past the console window's columns `win` (so on a narrow laptop it never folds out over the rail's words); at
 * the slot r1 by GLIDE's end, and held there.
 */
export function cardAt(k: number, r0: Box, r1: Box, win: Box): Box {
  const w = r0.w + FOLD_WIDEN * Math.max(0, r1.w - r0.w);
  const x = Math.min(Math.max(r0.x + r0.w - w, win.x), win.x + win.w - w);
  const folded: Box = { x, y: r0.y + r0.h / 2 - r1.h / 2, w, h: r1.h };
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
 * ground coming up under the receipt's perforated edge, so its first frame is the receipt exactly. The receipt's words
 * dim with its paper and the row's come in as they go, the one straight after the other, so the card is never an
 * empty box for more than a frame and its words are never two sets printed over each other.
 */
export function lookAt(k: number) {
  return {
    receipt: 1 - ramp(k, 0.03, 0.12),
    ground: ramp(k, 0, 0.03),
    paper: 1 - ramp(k, 0.03, 0.12),
    row: ramp(k, 0.12, 0.2),
    lift: 1 - ramp(k, 0.82, 1),
  };
}
