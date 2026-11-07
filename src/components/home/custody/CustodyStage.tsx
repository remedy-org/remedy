"use client";

import clsx from "clsx";
import { frame as motionFrame, motion, useMotionValueEvent, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { CHAPTERS, CLAIM } from "./claim";
import { CodeChapter, ChecksChapter, Compact, ConsentChapter, ConsoleChapter, PaidChapter, PhotoChapter, type Progress } from "./chapters";
import { ExhibitSlot } from "./ExhibitSlot";
import { ScreenBar } from "./frames";
import styles from "./custody.module.css";

// The pinned Chain of Custody on laptops (spec H2). Everything here is drawn from one timeline p (paced against the
// scroll in pace.ts). The laptop's screen hands over to a flat, unscaled screen layer: between 0.12 and 0.20 its
// clip-path grows from the laptop screen's measured rect to the screen's place on the grid, so no text is ever scaled,
// up or down. The rail takes columns 1 to 3 and the screen columns 4 to 12 of the page grid, like every section.

const HANDOFF = [0.12, 0.2] as const;
/** The consent screen wipes down over the laptop's own screen, top to bottom, like a page loading: no blank frame
 * and no double exposure between the two screens. */
const WIPE = 0.015;
/** Where each chapter starts on the screen, and the console after the payout. */
const STARTS = [0, 0.34, 0.48, 0.6, 0.8, 0.9];
/** Chapter changes are a cut, never a double exposure: the outgoing chapter fades out over OUT before its start,
 * the incoming one fades in over IN after it, so two chapters are never both above 0. */
const OUT = [0.012, 0.002] as const;
const IN = 0.01;
/** The rail's chapter list comes in once the hero copy has gone (it fades out by 0.16). */
const RAIL_IN = 0.17;

const inOut = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function share(p: number, i: number) {
  const a = STARTS[i];
  const b = STARTS[i + 1] ?? 2;
  // The first chapter is on the screen layer from the moment it takes over from the laptop's own screen, so the
  // growing clip always has the consent card in it: never an empty or black screen.
  const fin = i === 0 ? 1 : clamp01((p - a) / IN);
  const fout = clamp01((b - OUT[1] - p) / (OUT[0] - OUT[1]));
  return Math.min(fin, fout);
}

function Layer({ p, i, compact, children }: { p: Progress; i: number; compact: boolean; children: ReactNode }) {
  const opacity = useTransform(p, (v) => share(v, i));
  const y = useTransform(p, (v) => (i === 0 ? 0 : Math.round(8 * (1 - clamp01((v - STARTS[i]) / IN)))));
  const visibility = useTransform(opacity, (o) => (o > 0 ? "visible" : "hidden"));
  return (
    <motion.div data-layer={i} className={clsx("absolute inset-0 flex items-center justify-center px-8", compact ? "py-4" : "py-8")} style={{ opacity, y, visibility }}>
      <div className="w-full max-w-[66rem]">{children}</div>
    </motion.div>
  );
}

function RailItem({ p, i }: { p: Progress; i: number }) {
  const c = CHAPTERS[i];
  // Enters 0.16 to 0.21, once the backdrop has covered the page rail behind it, then 100% while its chapter is on
  // screen, else 35%.
  const opacity = useTransform(p, (v) => {
    const enter = clamp01((v - RAIL_IN - i * 0.008) / 0.02);
    const on = Math.max(share(v, i), i === 4 ? share(v, 5) : 0);
    return enter * (0.35 + 0.65 * on);
  });
  const x = useTransform(p, (v) => Math.round(-12 * (1 - clamp01((v - RAIL_IN - i * 0.008) / 0.02))));
  const lead = useTransform(p, (v) => Math.max(share(v, i), i === 4 ? share(v, 5) : 0));
  return (
    <motion.li className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] items-baseline py-2.5" style={{ opacity, x }}>
      <motion.span className="absolute inset-y-1.5 -left-4 w-0.5 rounded-full bg-accent" style={{ scaleY: lead, originY: 0.5 }} />
      <span className="font-mono text-micro text-faint">{c.n}</span>
      <span className="text-body font-medium">{c.title}</span>
    </motion.li>
  );
}

function RailCaption({ p, i }: { p: Progress; i: number }) {
  const opacity = useTransform(p, (v) => Math.max(share(v, i), i === 4 ? share(v, 5) : 0) * clamp01((v - RAIL_IN) / 0.03));
  return (
    <motion.p className="absolute inset-x-0 top-0 text-ui text-pretty text-text-2" style={{ opacity }}>
      {CHAPTERS[i].text}
    </motion.p>
  );
}

/**
 * The screen's clip: the laptop screen's live rect at 0.12, the screen's place on the grid (columns 4 to 12) at 0.20,
 * with the first WIPE of it opening from the top down. Written straight to the element, so scrolling never re-renders
 * React.
 */
function applyClip(el: HTMLElement | null, st: HTMLElement | null, v: number) {
  if (!el || !st) return;
  // Opacity as well as visibility: a chapter layer sets its own visibility, which would show through a hidden parent.
  if (v < HANDOFF[0]) {
    el.style.visibility = "hidden";
    el.style.opacity = "0";
    return;
  }
  el.style.visibility = "visible";
  el.style.opacity = "1";
  const S = st.getBoundingClientRect();
  const inner = el.querySelector("[data-screen-inner]")?.getBoundingClientRect();
  const end = inner
    ? { t: inner.top - S.top, r: S.right - inner.right, b: S.bottom - inner.bottom, l: inner.left - S.left, round: 16 }
    : { t: 16, r: 16, b: 16, l: 16, round: 16 };
  let box = end;
  if (v < HANDOFF[1]) {
    const lap = st.querySelector("[data-laptop-screen]")?.getBoundingClientRect();
    if (lap) {
      const k = inOut((v - HANDOFF[0]) / (HANDOFF[1] - HANDOFF[0]));
      const from = { t: lap.top - S.top, r: S.right - lap.right, b: S.bottom - lap.bottom, l: lap.left - S.left, round: 6 };
      box = { t: 0, r: 0, b: 0, l: 0, round: 0 };
      for (const key of Object.keys(end) as (keyof typeof end)[]) box[key] = from[key] + (end[key] - from[key]) * k;
      box.b += (1 - clamp01((v - HANDOFF[0]) / WIPE)) * (S.height - box.t - box.b);
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
  const [compact, setCompact] = useState(false);
  const [chapter, setChapter] = useState(0);

  useMotionValueEvent(p, "change", (v) => {
    // After Motion has written this frame's styles, so the laptop is measured where it is now, not a frame ago.
    motionFrame.postRender(() => applyClip(screen.current, stage.current, p.get()));
    let next = 0;
    STARTS.forEach((s, i) => {
      if (v >= s - OUT[1]) next = i;
    });
    setChapter(next);
  });

  // Short laptop screens (a stage under 800px, so a viewport under about 864px) get the chapters' compact layouts:
  // tighter gaps, a smaller photo and fewer rows. Type never shrinks, so mono text stays at 12px.
  useEffect(() => {
    const st = stage.current;
    if (!st) return;
    const fit = () => {
      applyClip(screen.current, st, p.get());
      setCompact(st.clientHeight < 800);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(st);
    return () => ro.disconnect();
  }, [stage, p]);

  const frame = useTransform(p, [HANDOFF[1] - 0.01, HANDOFF[1]], [0, 1]);
  const railHead = useTransform(p, [RAIL_IN, RAIL_IN + 0.03], [0, 1]);
  const bar = useTransform(p, [0.16, 0.19], [0, 1]);

  return (
    <>
      <div ref={screen} className={clsx(styles.screen, "invisible opacity-0")} aria-hidden="true">
        <motion.div className={clsx(styles.screenInner, "pointer-events-none rounded-frame shadow-card")} style={{ opacity: frame }} />
        <div className={styles.screenInner} data-screen-inner>
          <motion.div style={{ opacity: bar }}>
            <ScreenBar step={[1, 2, 3, 4, 4, 4][chapter]} console={chapter === 5} />
          </motion.div>
          <div className="relative min-h-0 flex-1">
            <Compact.Provider value={compact}>
              <Layer p={p} i={0} compact={compact}>
                <ConsentChapter />
              </Layer>
              <Layer p={p} i={1} compact={compact}>
                <CodeChapter p={p} />
              </Layer>
              {/* Chapters 03 to 05: the exhibit slot, where the 3D "Opened Exhibit" mounts (ExhibitSlot.tsx). */}
              <ExhibitSlot p={p} compact={compact} share={share}>
                <Layer p={p} i={2} compact={compact}>
                  <PhotoChapter p={p} />
                </Layer>
                <Layer p={p} i={3} compact={compact}>
                  <ChecksChapter p={p} />
                </Layer>
                <Layer p={p} i={4} compact={compact}>
                  <PaidChapter p={p} />
                </Layer>
              </ExhibitSlot>
              <Layer p={p} i={5} compact={compact}>
                <ConsoleChapter p={p} />
              </Layer>
            </Compact.Provider>
          </div>
        </div>
      </div>

      <div className={clsx(styles.rail, "pointer-events-none")}>
        <motion.div className="flex min-h-0 flex-1 flex-col" style={{ opacity: railHead }} aria-hidden="true">
          <span className="micro text-faint">Exhibit · Claim {CLAIM.id}</span>
          <ol className="mt-5">
            {CHAPTERS.map((c, i) => (
              <RailItem key={c.n} p={p} i={i} />
            ))}
          </ol>
          <div className="relative mt-8 flex-1">
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
    </>
  );
}
