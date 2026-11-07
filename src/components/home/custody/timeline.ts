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
/** The exhibit's content fades in over this much p after its start, on its own opaque page (exhibitPage). */
export const EXHIBIT_IN = IN;
/** Its exit: the whole layer dissolves over this much p before its end, onto the console already in place. */
export const EXHIBIT_OUT = 0.004;
/**
 * The console is in place, at full strength, under the exhibit's opaque page before that page starts its exit
 * dissolve: the hand-off is exhibit to console, never through an empty frame.
 */
export const CONSOLE_AT = EXHIBIT_RANGE[1] - EXHIBIT_OUT - IN;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** A chapter's opacity on the screen layer (and its rail highlight). */
export function share(p: number, i: number) {
  const a = STARTS[i];
  const b = STARTS[i + 1] ?? 2;
  // The first chapter is on the screen layer from the moment it takes over from the laptop's own screen, so the
  // growing clip always has the consent card in it: never an empty or black screen.
  const fin = i === 0 ? 1 : clamp01((p - (i === 5 ? CONSOLE_AT : a)) / IN);
  const fout = clamp01((b - OUT[1] - p) / (OUT[0] - OUT[1]));
  return Math.min(fin, fout);
}

/**
 * The exhibit's content opacity: one layer from 0.48 to 0.9, so it never dips at the old chapter starts inside it
 * (0.6 and 0.8).
 */
export function exhibitShare(v: number) {
  return Math.min(clamp01((v - EXHIBIT_RANGE[0]) / EXHIBIT_IN), clamp01((EXHIBIT_RANGE[1] - v) / EXHIBIT_OUT));
}

/**
 * The exhibit's own page: opaque the moment it starts (a cut, so the rail and the empty screen frame never show through
 * its fade-in), then dissolving with the content at the exit, onto the console and the rail at full strength.
 */
export function exhibitPage(v: number) {
  return v < EXHIBIT_RANGE[0] ? 0 : clamp01((EXHIBIT_RANGE[1] - v) / EXHIBIT_OUT);
}
