// The live scene's fallbacks, kept pure so they are unit-tested (watch.test.ts): which layers the stage shows, and
// when a GPU is too slow to keep the scene.

/** A frame slower than this (ms, the median of SAMPLES) steps the scene down a tier, then to the posters. */
export const SLOW_MS = 28;
const SAMPLES = 8;
/** Longer than this is a stall (a hidden tab, a long task), not the GPU: not counted. */
const STALL_MS = 120;

/**
 * Feed it, for each frame the scene drew, the time from that draw to the next frame the browser produced. It answers
 * true once the median of 8 such frames is over SLOW_MS. Only drawn frames count: the scene draws when p changes, so
 * the gaps between draws measure the scroll's pace (a wheel easing to a stop moves a pixel every 30 to 80 ms), not the
 * GPU's.
 */
export function createFrameWatch() {
  let gaps: number[] = [];
  return (ms: number) => {
    if (ms > STALL_MS) return false;
    gaps.push(ms);
    if (gaps.length < SAMPLES) return false;
    const median = [...gaps].sort((a, b) => a - b)[SAMPLES / 2];
    gaps = [];
    return median > SLOW_MS;
  };
}

/**
 * The stage's layers. The canvas exists only while the scene is live: once it has fallen back to the posters it is
 * gone, so its last frame can never sit over the current beat's still.
 */
export function stageLayers({ mode, failed, warm }: { mode: "live" | "poster"; failed: boolean; warm: boolean }) {
  const canvas = mode === "live" && !failed;
  return { canvas, canvasOn: canvas && warm, posters: !canvas || !warm };
}
