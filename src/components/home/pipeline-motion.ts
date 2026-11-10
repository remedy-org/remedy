export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** One moving claim follows the shared reading front until its own check stops it. */
export function claimAt(progress: number, origin: number, stop: number, finalStop: number) {
  const cursor = origin + clamp01(progress) * Math.max(0, finalStop - origin);
  const tip = Math.min(cursor, stop);
  return { tip, travel: Math.max(0, tip - origin), outcome: clamp01((cursor - stop + 24) / 24) };
}

/** A trail fills only as the claim crosses it; future checks never draw ahead of the photo. */
export const trailAt = (tip: number, top: number, height: number) => height > 0 ? clamp01((tip - top) / height) : 0;
