"use client";

import { motion, useTransform } from "motion/react";
import type { ReactNode } from "react";
import type { Progress } from "./chapters";

/** Chapters 03 to 05 (Live photo, Five checks, Paid) on the timeline p: where the exhibit slot owns the screen. */
export const EXHIBIT_RANGE = [0.48, 0.9] as const;

/**
 * The mount point for the 3D "Opened Exhibit" (src/components/home/teardown/, built separately), inside the pinned
 * Chain of Custody. The contract for what mounts here:
 * - It fills this box: the screen layer's chapter well, grid columns 4 to 12 under the screen bar, unscaled.
 * - It draws from `p` alone (the paced timeline, 0 to 1 over the whole runway; its chapters run EXHIBIT_RANGE), so
 *   scrolling back and forth, a poster frame and a screenshot all agree.
 * - `visible` is its opacity: 0 outside chapters 03 to 05, 1 inside, cut (never crossfaded) against chapter 02 and
 *   the console, as the chapter layers are.
 * - Until it is warm, and wherever WebGL is missing, the 2D chapters (children) render instead. The static figures
 *   and the phone use those same chapters, so the 3D needs no second copy of the story.
 * The rail beside the screen keeps naming chapters 03 to 05 and their captions either way.
 */
export function ExhibitSlot({ p, share, children }: { p: Progress; compact: boolean; share: (v: number, i: number) => number; children: ReactNode }) {
  const visible = useTransform(p, (v) => Math.max(share(v, 2), share(v, 3), share(v, 4)));
  const visibility = useTransform(visible, (o) => (o > 0 ? "visible" : "hidden"));
  return (
    <motion.div data-exhibit-slot className="absolute inset-0" style={{ visibility }}>
      {children}
    </motion.div>
  );
}
