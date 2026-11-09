import type { DemoSampleId } from "@/lib/demo/samples";

/**
 * The four demo claims in the order the homepage's Fraud checks draws them (home/Pipeline.tsx): stopped earliest first,
 * the genuine one, paid, last. /try lists them in this order too (its preview, the picker and the round's record), so
 * the four read the same wherever they are shown. Which one the picker opens on is the guided order's (DEMO_SAMPLES:
 * the genuine claim first, so the repost has a photo to repeat).
 */
export const FOUR_ORDER: readonly DemoSampleId[] = ["ai-no-session", "reposted", "wrong-code", "genuine"];

export const inFourOrder = <T extends { id: string }>(xs: readonly T[]) =>
  [...xs].sort((a, b) => FOUR_ORDER.indexOf(a.id as DemoSampleId) - FOUR_ORDER.indexOf(b.id as DemoSampleId));
