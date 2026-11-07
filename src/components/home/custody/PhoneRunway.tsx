"use client";

import { useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { OpenedExhibit } from "@/components/home/teardown";
import { TOTAL_VH as EXHIBIT_VH } from "@/components/home/teardown/model";
import { useMedia } from "../HeroDevice";
import { CHAPTERS } from "./claim";
import { CodeChapter, Compact, ConsentChapter, useDone } from "./chapters";
import { PhoneFrame } from "./frames";
import styles from "./custody.module.css";

const STEP = [1, 2];
/** The phone's sequence ends at 05, Paid: it has no console beat (06 is the laptop's). */
const PHONE_CHAPTERS = 5;
/** Scroll per claim-screen chapter (01 and 02), in vh. */
const CHAPTER_VH = 72;
/** Below this chapter-well height (an iPhone SE, or Safari with its toolbars) the chapters use their compact forms. */
const COMPACT_BELOW = 600;

// Below 1024px (or under 700px tall), with motion allowed: chapters 01 and 02 in a sticky phone at 1:1, 72vh of scroll
// each, the chapter caption above it. Each shows its final state; changing chapter is a 240ms crossfade with a 6px rise.
// Chapters 03 to 05 are then the Opened Exhibit filling the stage (the pinned stills on phones, the 3D on tablets),
// scrubbed by the rest of the runway: 80% of its laptop length under 768px, as its own pin would be. No laptop and no
// dolly. On short phones the chapters drop their secondary parts so nothing is cut off at the frame's edge.
export function PhoneRunway({ skip }: { skip: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const well = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const small = useMedia("(max-width: 767px)");
  const exhibitVh = small ? Math.round(EXHIBIT_VH * 0.8) : EXHIBIT_VH;
  const split = (2 * CHAPTER_VH) / (2 * CHAPTER_VH + exhibitVh);
  const [at, setAt] = useState(0);
  const [compact, setCompact] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (v) => setAt(v < split ? Math.min(1, Math.floor((v / split) * 2)) : 2));
  const exhibitP = useTransform(scrollYProgress, [split, 1], [0, 1], { clamp: true });
  useEffect(() => {
    const el = well.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCompact(el.clientHeight < COMPACT_BELOW));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const done = useDone();
  const seek = (q: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (split + q * (1 - split)) * (el.offsetHeight - window.innerHeight), behavior: "instant" });
  };
  const c = CHAPTERS[Math.min(at, 1)];
  return (
    <div ref={ref} className={styles.phoneRunway} style={{ "--scroll": `${2 * CHAPTER_VH + exhibitVh}vh` } as CSSProperties} data-runway>
      <div className={styles.phoneStage}>
        <div className="flex w-80 max-w-full items-baseline justify-between gap-4 px-1" aria-hidden="true">
          <span key={c.n} className={`micro text-accent-text ${styles.chapterIn}`}>
            {c.n} · {c.title}
          </span>
          <span className="font-mono text-micro text-faint tabular-nums">
            {c.n} / {String(PHONE_CHAPTERS).padStart(2, "0")}
          </span>
        </div>
        <PhoneFrame step={STEP[Math.min(at, 1)]} className="flex min-h-0 flex-1 flex-col">
          <div ref={well} className="relative min-h-0 flex-1">
            <div key={Math.min(at, 1)} className={`absolute inset-0 overflow-hidden p-4 ${styles.chapterIn}`} aria-hidden="true">
              <Compact.Provider value={compact}>{at === 0 ? <ConsentChapter /> : <CodeChapter p={done} />}</Compact.Provider>
            </div>
          </div>
        </PhoneFrame>
        {skip}
        {/* Mounted from chapter 02 on, so the exhibit's stills are loading before it cuts in. */}
        {at >= 1 && (
          <div className="absolute inset-0 z-[5] bg-bg" style={{ visibility: at >= 2 ? "visible" : "hidden" }}>
            <OpenedExhibit progress={exhibitP} onSeek={seek} skip={skip} chapters={PHONE_CHAPTERS} />
          </div>
        )}
      </div>
    </div>
  );
}
