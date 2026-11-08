"use client";

import { motion, useMotionValueEvent, useTransform } from "motion/react";
import { useState, type ReactNode } from "react";
import { OpenedExhibit } from "@/components/home/teardown";
import type { Progress } from "./chapters";
import { CHAPTERS } from "./claim";
import { useChapterGate } from "./gate";
import { EXHIBIT_RANGE } from "./timeline";

/** The exhibit mounts (and three.js starts loading) once chapter 02 is on screen, so the hero never pays for it. */
const ARM_AT = 0.3;

/**
 * The 3D "Opened Exhibit" (src/components/home/teardown/) inside the pinned Chain of Custody. It replaces the device
 * frame and the rail for chapters 03 to 05: a full-stage layer above both, on the page's own grid and gutters, so the
 * evidence gets the whole screen. It draws from `p` alone, so scrolling back and forth, a poster frame and a screenshot
 * all agree. It carries the pin's skip link in its own foot, since it covers the rail's. It comes and goes as a cut in
 * time (gate.ts): in over chapter 02 at full strength, out onto the console already in place under it.
 */
export function ExhibitSlot({ p, skip, onSeek }: { p: Progress; skip: ReactNode; onSeek: (t: number) => void }) {
  const [armed, setArmed] = useState(() => p.get() >= ARM_AT);
  useMotionValueEvent(p, "change", (v) => {
    if (v >= ARM_AT && !armed) setArmed(true);
  });
  const progress = useTransform(p, EXHIBIT_RANGE as unknown as number[], [0, 1], { clamp: true });
  const page = useChapterGate(p, (c) => c >= 2 && c <= 4);
  const visibility = useTransform(page, (o) => (o > 0 ? "visible" : "hidden"));
  return (
    <motion.div data-exhibit-slot className="absolute inset-0 z-[5] bg-bg" style={{ opacity: page, visibility }}>
      <div className="h-full w-full">
        {armed && (
          <OpenedExhibit progress={progress} skip={skip} chapters={CHAPTERS.length} onSeek={(q) => onSeek(EXHIBIT_RANGE[0] + q * (EXHIBIT_RANGE[1] - EXHIBIT_RANGE[0]))} />
        )}
      </div>
    </motion.div>
  );
}
