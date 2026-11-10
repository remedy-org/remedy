export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => value * value * (3 - 2 * value);
const REVEAL = 32;

/** Photo-top coordinates: follow the reading front, slow into the dock, then reveal the result after arrival.
 * The final scroll tail gives the last claim the same arrival/reveal sequence as the earlier refusals. */
export function claimAt(progress: number, origin: number, stop: number, finalStop: number) {
  const cursor = origin + clamp01(progress) * (Math.max(0, finalStop - origin) + REVEAL);
  const approach = Math.min(72, Math.max(0, stop - origin) * 0.6);
  const start = stop - approach;
  const t = approach > 0 ? clamp01((cursor - start) / approach) : 1;
  // Hermite: match the incoming velocity, then reach zero velocity at the dock without overshooting.
  const tip = Math.min(stop, cursor < start ? cursor : start + approach * (t + t * t - t * t * t));
  return {
    tip,
    travel: Math.max(0, tip - origin),
    outcome: smooth(clamp01((cursor - stop) / REVEAL)),
    dock: smooth(clamp01((cursor - stop + 16) / 16)),
  };
}

/** A trail fills only as the claim crosses it; future checks never draw ahead of the photo. */
export const trailAt = (tip: number, top: number, height: number) => height > 0 ? clamp01((tip - top) / height) : 0;
