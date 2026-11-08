// The pinned Chain of Custody's chapters on its timeline p (pace.ts maps the scroll onto p): which one owns the stage.
// The changes between them are cuts that run in time once p crosses a start (gate.ts), never scrubbed fades, so a
// reader who stops scrolling at a change never rests on a ghost, a double exposure or an empty frame. Pure, so the
// boundaries are unit-tested (timeline.test.ts).

/** Where each chapter starts: 01 and 02 the claim screens, 03 to 05 the Opened Exhibit, then the console (06). */
export const STARTS = [0, 0.34, 0.48, 0.6, 0.8, 0.9];

/** Chapters 03 to 05 (Live photo, Five checks, Paid): where the Opened Exhibit owns the stage, as one layer. */
export const EXHIBIT_RANGE = [STARTS[2], STARTS[5]] as const;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The chapter on the stage at p: 0 and 1 the claim screens, 2 to 4 the exhibit, 5 the console. */
export function chapterAt(p: number) {
  let c = 0;
  STARTS.forEach((s, i) => {
    if (p >= s) c = i;
  });
  return c;
}

/** True while the Opened Exhibit owns the stage. */
export const inExhibit = (p: number) => p >= EXHIBIT_RANGE[0] && p < EXHIBIT_RANGE[1];
