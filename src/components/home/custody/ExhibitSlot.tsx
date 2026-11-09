"use client";

import { motion, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { useState, type ReactNode } from "react";
import { OpenedExhibit } from "@/components/home/teardown";
import type { Progress } from "./chapters";
import { CHAPTERS } from "./claim";
import { EXHIBIT_LIFT } from "./arrival";
import { EXHIBIT_RANGE } from "./timeline";

/** The exhibit mounts (and three.js starts loading) once chapter 02 is on screen, so the hero never pays for it. */
const ARM_AT = 0.3;

/**
 * The 3D "Opened Exhibit" (src/components/home/teardown/) inside the pinned Chain of Custody. It replaces the device
 * frame and the rail for chapters 03 to 05: a full-stage layer above both, on the page's own grid and gutters, so the
 * evidence gets the whole screen. It draws from `p` alone, so scrolling back and forth, a poster frame and a screenshot
 * all agree. It carries the pin's skip link in its own foot, since it covers the rail's. It comes in as a cut in time
 * (gate.ts, `page`, which CustodyStage owns), over chapter 02 at full strength, and goes onto the console scrubbed
 * (`out`, arrival.ts EXHIBIT_OUT), fading and lifting away, while its paid receipt, handed to chapter 06's arrival
 * card, stays on the stage and folds into the claim's row, so the receipt never simply vanishes.
 */
export function ExhibitSlot({ p, page, out, skip, onSeek }: { p: Progress; page: MotionValue<number>; out: MotionValue<number>; skip: ReactNode; onSeek: (t: number) => void }) {
  const [armed, setArmed] = useState(() => p.get() >= ARM_AT);
  useMotionValueEvent(p, "change", (v) => {
    if (v >= ARM_AT && !armed) setArmed(true);
  });
  const progress = useTransform(p, EXHIBIT_RANGE as unknown as number[], [0, 1], { clamp: true });
  const visibility = useTransform(page, (o) => (o > 0 ? "visible" : "hidden"));
  const y = useTransform(out, (o) => -EXHIBIT_LIFT * o);
  return (
    <motion.div data-exhibit-slot className="absolute inset-0 z-[5] bg-bg" style={{ opacity: page, visibility, y }}>
      <div className="h-full w-full">
        {armed && (
          <OpenedExhibit progress={progress} skip={skip} chapters={CHAPTERS.length} onSeek={(q) => onSeek(EXHIBIT_RANGE[0] + q * (EXHIBIT_RANGE[1] - EXHIBIT_RANGE[0]))} />
        )}
      </div>
    </motion.div>
  );
}
