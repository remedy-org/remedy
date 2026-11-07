"use client";

import clsx from "clsx";
import { frame as motionFrame, motion, useMotionValueEvent, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { CHAPTERS, CLAIM } from "./claim";
import { CodeChapter, ChecksChapter, ConsentChapter, ConsoleChapter, PaidChapter, PhotoChapter, type Progress } from "./chapters";
import { ScreenBar } from "./frames";
import styles from "./custody.module.css";

// The pinned Chain of Custody on laptops (spec H2). Everything here is drawn from one scroll progress p. The laptop's
// screen hands over to a flat, unscaled screen layer: between 0.12 and 0.20 its clip-path grows from the laptop
// screen's measured rect to the stage, so no text is ever scaled above its rest size.

const HANDOFF = [0.12, 0.2] as const;
/** Where each chapter starts on the screen, and the console after the payout. */
const STARTS = [0, 0.34, 0.48, 0.6, 0.8, 0.9];
const FADE = 0.006;
const RAIL_W = 296; // the rail (280) plus the 16px gutter: the screen's left inset

const inOut = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

function share(p: number, i: number) {
  const a = STARTS[i];
  const b = STARTS[i + 1] ?? 2;
  // The first chapter fades in once the screen has nearly filled the stage: until then the growing screen is blank.
  const fin = i === 0 ? Math.min(1, Math.max(0, (p - 0.165) / 0.035)) : Math.min(1, Math.max(0, (p - (a - FADE)) / (2 * FADE)));
  const fout = Math.min(1, Math.max(0, (b + FADE - p) / (2 * FADE)));
  return Math.min(fin, fout);
}

function Layer({ p, i, children }: { p: Progress; i: number; children: ReactNode }) {
  const opacity = useTransform(p, (v) => share(v, i));
  const y = useTransform(p, (v) => (i === 0 ? 0 : Math.round(8 * (1 - Math.min(1, Math.max(0, (v - STARTS[i] + FADE) / (4 * FADE)))))));
  const visibility = useTransform(opacity, (o) => (o > 0 ? "visible" : "hidden"));
  return (
    <motion.div className="absolute inset-0 flex items-center justify-center px-10 py-8 xl:px-14" style={{ opacity, y, visibility }}>
      <div className="w-full max-w-[66rem]">{children}</div>
    </motion.div>
  );
}

function RailItem({ p, i }: { p: Progress; i: number }) {
  const c = CHAPTERS[i];
  // Enters 0.10 to 0.20 as the exhibit labels let go of the laptop, then 100% while its chapter is on screen, else 35%.
  const opacity = useTransform(p, (v) => {
    const enter = Math.min(1, Math.max(0, (v - 0.1 - i * 0.012) / 0.05));
    const on = Math.max(share(v, i), i === 4 ? share(v, 5) : 0);
    return enter * (0.35 + 0.65 * on);
  });
  const x = useTransform(p, (v) => Math.round(-12 * (1 - Math.min(1, Math.max(0, (v - 0.1 - i * 0.012) / 0.05)))));
  const lead = useTransform(p, (v) => Math.max(share(v, i), i === 4 ? share(v, 5) : 0));
  return (
    <motion.li className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] items-baseline py-2.5" style={{ opacity, x }}>
      <motion.span className="absolute top-1/2 -left-8 h-px w-6 bg-accent" style={{ scaleX: lead, originX: 0 }} />
      <span className="font-mono text-micro text-accent-text">{c.n}</span>
      <span className="text-body font-medium">{c.title}</span>
    </motion.li>
  );
}

function RailCaption({ p, i }: { p: Progress; i: number }) {
  const opacity = useTransform(p, (v) => Math.max(share(v, i), i === 4 ? share(v, 5) : 0) * Math.min(1, Math.max(0, (v - 0.16) / 0.04)));
  return (
    <motion.p className="absolute inset-x-0 top-0 text-ui text-pretty text-muted" style={{ opacity }}>
      {CHAPTERS[i].text}
    </motion.p>
  );
}

/**
 * The screen's clip: the laptop screen's live rect at 0.12, the stage minus the rail at 0.20. Written straight to the
 * element, so scrolling never re-renders React.
 */
function applyClip(el: HTMLElement | null, st: HTMLElement | null, v: number) {
  if (!el || !st) return;
  if (v < HANDOFF[0]) {
    el.style.visibility = "hidden";
    return;
  }
  el.style.visibility = "visible";
  const S = st.getBoundingClientRect();
  const end = { t: 16, r: 16, b: 16, l: RAIL_W, round: 16 };
  let box = end;
  if (v < HANDOFF[1]) {
    const lap = st.querySelector("[data-laptop-screen]")?.getBoundingClientRect();
    if (lap) {
      const k = inOut((v - HANDOFF[0]) / (HANDOFF[1] - HANDOFF[0]));
      const from = { t: lap.top - S.top, r: S.right - lap.right, b: S.bottom - lap.bottom, l: lap.left - S.left, round: 6 };
      box = { t: 0, r: 0, b: 0, l: 0, round: 0 };
      for (const key of Object.keys(end) as (keyof typeof end)[]) box[key] = from[key] + (end[key] - from[key]) * k;
    }
  }
  el.style.clipPath = `inset(${box.t.toFixed(1)}px ${box.r.toFixed(1)}px ${box.b.toFixed(1)}px ${box.l.toFixed(1)}px round ${box.round.toFixed(1)}px)`;
}

export interface CustodyStageProps {
  p: Progress;
  stage: RefObject<HTMLDivElement | null>;
  skip: ReactNode;
}

export function CustodyStage({ p, stage, skip }: CustodyStageProps) {
  const screen = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [chapter, setChapter] = useState(0);

  useMotionValueEvent(p, "change", (v) => {
    // After Motion has written this frame's styles, so the laptop is measured where it is now, not a frame ago.
    motionFrame.postRender(() => applyClip(screen.current, stage.current, p.get()));
    let next = 0;
    STARTS.forEach((s, i) => {
      if (v >= s - FADE) next = i;
    });
    setChapter(next);
  });

  // Short laptop screens (under about 880px tall) get the chapters scaled down to fit: a plain 2D scale, never up.
  useEffect(() => {
    const st = stage.current;
    if (!st) return;
    const fit = () => {
      applyClip(screen.current, st, p.get());
      const h = st.clientHeight - 32 - 48 - 32;
      setScale(Math.min(1, Math.max(0.7, h / 720)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(st);
    return () => ro.disconnect();
  }, [stage, p]);

  const screenIn = useTransform(p, [HANDOFF[0], HANDOFF[0] + 0.015], [0, 1]);
  const frame = useTransform(p, [HANDOFF[1] - 0.01, HANDOFF[1]], [0, 1]);
  const thread = useTransform(p, [0.2, 0.9], [0, 1]);
  const railHead = useTransform(p, [0.1, 0.16], [0, 1]);
  const bar = useTransform(p, [0.16, 0.19], [0, 1]);

  return (
    <>
      <motion.div ref={screen} className={clsx(styles.screen, "invisible")} style={{ opacity: screenIn }} aria-hidden="true">
        <motion.div className="pointer-events-none absolute inset-[1rem_1rem_1rem_18.5rem] rounded-frame shadow-ring" style={{ opacity: frame }} />
        <div className={styles.screenInner}>
          <motion.div style={{ opacity: bar }}>
            <ScreenBar step={[1, 2, 3, 4, 4, 4][chapter]} console={chapter === 5} />
          </motion.div>
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0 origin-center" style={scale < 1 ? { transform: `scale(${scale})` } : undefined}>
              <Layer p={p} i={0}>
                <ConsentChapter />
              </Layer>
              <Layer p={p} i={1}>
                <CodeChapter p={p} />
              </Layer>
              <Layer p={p} i={2}>
                <PhotoChapter p={p} />
              </Layer>
              <Layer p={p} i={3}>
                <ChecksChapter p={p} />
              </Layer>
              <Layer p={p} i={4}>
                <PaidChapter p={p} />
              </Layer>
              <Layer p={p} i={5}>
                <ConsoleChapter p={p} />
              </Layer>
            </div>
          </div>
        </div>
      </motion.div>

      <div className={clsx(styles.rail, "pointer-events-none")}>
        <motion.div className="flex min-h-0 flex-1 flex-col" style={{ opacity: railHead }} aria-hidden="true">
          <span className="micro text-faint">Exhibit · Claim {CLAIM.id}</span>
          <ol className="mt-5">
            {CHAPTERS.map((c, i) => (
              <RailItem key={c.n} p={p} i={i} />
            ))}
          </ol>
          <div className="relative mt-6 flex-1 border-t border-line pt-5">
            <div className="relative">
              {CHAPTERS.map((c, i) => (
                <RailCaption key={c.n} p={p} i={i} />
              ))}
            </div>
          </div>
        </motion.div>
        <motion.div className="pointer-events-auto pt-4 focus-within:!opacity-100" style={{ opacity: railHead }}>
          {skip}
        </motion.div>
      </div>

      <motion.div className={styles.thread} style={{ opacity: railHead }} aria-hidden="true">
        <motion.span className={styles.threadFill} style={{ scaleY: thread }} />
      </motion.div>
    </>
  );
}
