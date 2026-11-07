"use client";

import { useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CHAPTERS } from "./claim";
import { CodeChapter, ChecksChapter, Compact, ConsentChapter, PaidChapter, PhotoChapter, useDone } from "./chapters";
import { PhoneFrame } from "./frames";
import styles from "./custody.module.css";

const STEP = [1, 2, 3, 4, 4];
/** Below this chapter-well height (an iPhone SE, or Safari with its toolbars) the chapters use their compact forms. */
const COMPACT_BELOW = 600;

// Below 1024px (or under 700px tall), with motion allowed: the same five chapters in a sticky phone at 1:1 over a
// 240vh runway, the chapter caption above it. Each chapter shows its final state; changing chapter is a 240ms
// crossfade with a 6px rise. No laptop and no dolly. On short phones the chapters drop their secondary parts (the
// consent marks and steps, the code's instructions, the model's quotes) so nothing is cut off at the frame's edge.
export function PhoneRunway({ skip }: { skip: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const well = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [at, setAt] = useState(0);
  const [compact, setCompact] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (v) => setAt(Math.min(4, Math.floor(v * 5))));
  useEffect(() => {
    const el = well.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCompact(el.clientHeight < COMPACT_BELOW));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const done = useDone();
  const chapter = [<ConsentChapter key="01" />, <CodeChapter key="02" p={done} />, <PhotoChapter key="03" p={done} />, <ChecksChapter key="04" p={done} />, <PaidChapter key="05" p={done} />][at];
  const c = CHAPTERS[at];
  return (
    <div ref={ref} className={styles.phoneRunway} data-runway>
      <div className={styles.phoneStage}>
        <div className="flex w-80 max-w-full items-baseline justify-between gap-4 px-1" aria-hidden="true">
          <span key={c.n} className={`micro text-accent-text ${styles.chapterIn}`}>
            {c.n} · {c.title}
          </span>
          <span className="font-mono text-micro text-faint tabular-nums">{c.n} / 05</span>
        </div>
        <PhoneFrame step={STEP[at]} className="flex min-h-0 flex-1 flex-col">
          <div ref={well} className="relative min-h-0 flex-1">
            <div key={at} className={`absolute inset-0 overflow-hidden p-4 ${styles.chapterIn}`} aria-hidden="true">
              <Compact.Provider value={compact}>{chapter}</Compact.Provider>
            </div>
          </div>
        </PhoneFrame>
        {skip}
      </div>
    </div>
  );
}
