// The pinned Chain of Custody's layers on its timeline p (pace.ts maps the scroll onto p): when each chapter's screen,
// the Opened Exhibit and the console are on. Pure, so the hand-offs are unit-tested (timeline.test.ts).

/** Where each chapter starts on the screen, and the console after the payout. */
export const STARTS = [0, 0.34, 0.48, 0.6, 0.8, 0.9];
/** Chapter changes are a cut, never a double exposure: the outgoing chapter fades out over OUT before its start,
 * the incoming one fades in over IN after it, so two chapters are never both above 0. */
export const OUT = [0.012, 0.002] as const;
export const IN = 0.01;

/** Chapters 03 to 05 (Live photo, Five checks, Paid): where the Opened Exhibit owns the stage, as one layer. */
export const EXHIBIT_RANGE = [STARTS[2], STARTS[5]] as const;
/** The exhibit's entrance: page and content dissolve in together over this much p, over chapter 02 at full strength. */
export const EXHIBIT_IN = 0.006;
/**
 * Its exit, at half the entrance's length per part: the content leaves first onto the exhibit's own page, then the page
 * dissolves onto the console already in place under it, so no frame has the two layers' text on top of each other.
 */
export const EXHIBIT_OUT = EXHIBIT_IN / 2;
/**
 * The console is in place, at full strength, under the exhibit's opaque page before that page starts its exit
 * dissolve: the hand-off is exhibit to console, never through an empty frame.
 */
export const CONSOLE_AT = EXHIBIT_RANGE[1] - 2 * EXHIBIT_OUT - IN;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** The site's entrance curve, cubic-bezier(0.16, 1, 0.3, 1), near enough (an expo out). */
const enter = (x: number) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x));

/** A chapter's opacity on the screen layer (and its rail highlight). */
export function share(p: number, i: number) {
  const a = STARTS[i];
  const b = STARTS[i + 1] ?? 2;
  // The first chapter is on the screen layer from the moment it takes over from the laptop's own screen, so the
  // growing clip always has the consent card in it: never an empty or black screen.
  const fin = i === 0 ? 1 : clamp01((p - (i === 5 ? CONSOLE_AT : a)) / IN);
  // Chapter 02 stays at full strength under the exhibit's entrance, until the exhibit is opaque over it.
  if (i === 1) return p < EXHIBIT_RANGE[0] + EXHIBIT_IN ? fin : 0;
  const fout = clamp01((b - OUT[1] - p) / (OUT[0] - OUT[1]));
  return Math.min(fin, fout);
}

/** The exhibit's own page: dissolving in over chapter 02 (never an empty frame first), then out onto the console. */
export function exhibitPage(v: number) {
  return Math.min(enter(clamp01((v - EXHIBIT_RANGE[0]) / EXHIBIT_IN)), clamp01((EXHIBIT_RANGE[1] - v) / EXHIBIT_OUT));
}

/**
 * The exhibit's content opacity, overall: in with its page, one layer from 0.48 to 0.9, so it never dips at the old
 * chapter starts inside it (0.6 and 0.8), and out just before its page.
 */
export function exhibitShare(v: number) {
  return Math.min(exhibitPage(v), clamp01((EXHIBIT_RANGE[1] - EXHIBIT_OUT - v) / EXHIBIT_OUT));
}
