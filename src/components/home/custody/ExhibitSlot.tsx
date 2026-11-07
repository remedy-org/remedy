"use client";

import { motion, useMotionValueEvent, useTransform } from "motion/react";
import { useState } from "react";
import { OpenedExhibit } from "@/components/home/teardown";
import type { Progress } from "./chapters";

/** Chapters 03 to 05 (Live photo, Five checks, Paid) on the timeline p: where the Opened Exhibit owns the stage. */
export const EXHIBIT_RANGE = [0.48, 0.9] as const;
/** The exhibit mounts (and three.js starts loading) once chapter 02 is on screen, so the hero never pays for it. */
const ARM_AT = 0.3;

/**
 * The 3D "Opened Exhibit" (src/components/home/teardown/) inside the pinned Chain of Custody. It replaces the device
 * frame and the rail for chapters 03 to 05: a full-stage layer above both, on the page's own grid and gutters, so the
 * evidence gets the whole screen. It draws from `p` alone, so scrolling back and forth, a poster frame and a screenshot
 * all agree. `visible` cuts it in and out like a chapter layer (never a long crossfade).
 */
export function ExhibitSlot({ p, visible, onSeek }: { p: Progress; visible: (v: number) => number; onSeek: (t: number) => void }) {
  const [armed, setArmed] = useState(() => p.get() >= ARM_AT);
  useMotionValueEvent(p, "change", (v) => {
    if (v >= ARM_AT && !armed) setArmed(true);
  });
  const progress = useTransform(p, EXHIBIT_RANGE as unknown as number[], [0, 1], { clamp: true });
  const opacity = useTransform(p, visible);
  const visibility = useTransform(opacity, (o) => (o > 0 ? "visible" : "hidden"));
  return (
    <motion.div data-exhibit-slot className="absolute inset-0 z-[5] bg-bg" style={{ opacity, visibility }}>
      {armed && <OpenedExhibit progress={progress} onSeek={(q) => onSeek(EXHIBIT_RANGE[0] + q * (EXHIBIT_RANGE[1] - EXHIBIT_RANGE[0]))} />}
    </motion.div>
  );
}
