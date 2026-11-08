"use client";

import clsx from "clsx";
import { frame as motionFrame, motion, useMotionValueEvent, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { BEATS as EXHIBIT_BEATS, holdOf } from "../teardown/model";
import { CHAPTERS, CLAIM, CONSENT_AT, SHOT_AT } from "./claim";
import { CodeChapter, Compact, ConsentChapter, ConsoleChapter, type Progress } from "./chapters";
import { ExhibitSlot } from "./ExhibitSlot";
import { useBeatPaging } from "./paging";
import { scrollAt } from "./pace";
import { ScreenBar } from "./frames";
import { CONSOLE_AT, EXHIBIT_RANGE, IN, OUT, STARTS, clamp01, exhibitPage, share } from "./timeline";
import styles from "./custody.module.css";

// The pinned Chain of Custody on laptops (spec H2). Everything here is drawn from one timeline p (paced against the
// scroll in pace.ts). The laptop's screen hands over to a flat, unscaled screen layer: between 0.12 and 0.20 its
// clip-path grows from the laptop screen's measured rect to the screen's place on the grid, so no text is ever scaled,
// up or down. The rail takes columns 1 to 3 and the screen columns 4 to 12 of the page grid, like every section.

const HANDOFF = [0.12, 0.2] as const;
/** The consent screen dissolves in over the laptop's own screen, inside that screen's rect (state to state), before the
 * clip starts to grow: never a hard edge wiping across the laptop's photo. */
const DISSOLVE = 0.012;
/** The state-to-state curve, cubic-bezier(0.65, 0, 0.35, 1). */
const inOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
/** The rail's chapter list comes in once the hero copy has gone (it fades out by 0.16). */
const RAIL_IN = 0.17;

const inOut = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

function Layer({ p, i, compact, fill, children }: { p: Progress; i: number; compact: boolean; fill?: boolean; children: ReactNode }) {
  const opacity = useTransform(p, (v) => share(v, i));
  const y = useTransform(p, (v) => (i === 0 ? 0 : Math.round(8 * (1 - clamp01((v - (i === 5 ? CONSOLE_AT : STARTS[i])) / IN)))));
  const visibility = useTransform(opacity, (o) => (o > 0 ? "visible" : "hidden"));
  return (
    // Top-aligned under the app bar, as a page loads: centred, a tall frame left an empty band under the bar.
    <motion.div data-layer={i} className={clsx("absolute inset-0 flex items-start justify-center px-8", compact ? "pt-6 pb-4" : "pt-12 pb-8")} style={{ opacity, y, visibility }}>
      <div className={clsx("w-full max-w-[66rem]", fill && "h-full")}>{children}</div>
    </motion.div>
  );
}

/** Where each rail item's entrance starts after RAIL_IN, and how long it takes: the last one has settled by 0.205, ahead
 * of the #how anchor (0.215), so a jump there never lands mid-entrance. */
const RAIL_STAGGER = 0.004;
const RAIL_ENTER = 0.015;

function RailItem({ p, i }: { p: Progress; i: number }) {
  const c = CHAPTERS[i];
  // Enters 0.17 to 0.205, once the backdrop has covered the page rail behind it, then 100% while its chapter is on
  // screen, else 35%. Item 06 is the console, the screen's layer 5.
  const enter = (v: number) => clamp01((v - RAIL_IN - i * RAIL_STAGGER) / RAIL_ENTER);
  const opacity = useTransform(p, (v) => enter(v) * (0.35 + 0.65 * share(v, i)));
  const x = useTransform(p, (v) => Math.round(-12 * (1 - enter(v))));
  // The amber edge marks the chapter on screen, and for 01 and 02 fills down from a quarter through the chapter's
  // beat (01 from the end of the dolly), so a long hold always shows progress. Chapters 03 to 05 are under the exhibit;
  // 06's edge marks the console.
  const lead = useTransform(p, (v) => {
    const on = share(v, i);
    if (i >= 2) return on;
    const from = i === 0 ? HANDOFF[1] : STARTS[i];
    return on * (0.25 + 0.75 * clamp01((v - from) / (STARTS[i + 1] - OUT[0] - from)));
  });
  return (
    <motion.li className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] items-baseline py-2.5" style={{ opacity, x }}>
      <motion.span className="absolute inset-y-1.5 -left-4 w-0.5 rounded-full bg-accent" style={{ scaleY: lead, originY: 0 }} />
      <span className="font-mono text-micro text-faint">{c.n}</span>
      <span className="text-body font-medium">{c.title}</span>
    </motion.li>
  );
}

function RailCaption({ p, i }: { p: Progress; i: number }) {
  const opacity = useTransform(p, (v) => share(v, i) * clamp01((v - RAIL_IN) / 0.03));
  return (
    <motion.p className="absolute inset-x-0 top-0 text-ui text-pretty text-text-2" style={{ opacity }}>
      {CHAPTERS[i].text}
    </motion.p>
  );
}

/**
 * The screen's clip: the laptop screen's live rect at 0.12, the screen's place on the grid (columns 4 to 12) at 0.20,
 * the layer dissolving in over the first DISSOLVE of it. Only the consent card shows while the clip grows (chapter
 * 01's other column comes in once it has reached the grid, ConsentChapter), so no text is ever sliced by its edge.
 * Written straight to the element, so scrolling never re-renders React.
 */
function applyClip(el: HTMLElement | null, st: HTMLElement | null, v: number) {
  if (!el || !st) return;
  // Opacity and pointer events as well as visibility: a chapter layer sets its own visibility, which would show through
  // a hidden parent and catch the hero's clicks and pointer (its Replay and the laptop's tilt) while invisible.
  if (v < HANDOFF[0]) {
    el.style.visibility = "hidden";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    return;
  }
  el.style.visibility = "visible";
  el.style.opacity = inOutCubic(clamp01((v - HANDOFF[0]) / DISSOLVE)).toFixed(3);
  el.style.pointerEvents = "auto";
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
    }
  }
  el.style.clipPath = `inset(${box.t.toFixed(1)}px ${box.r.toFixed(1)}px ${box.b.toFixed(1)}px ${box.l.toFixed(1)}px round ${box.round.toFixed(1)}px)`;
}

/**
 * Where Space and Page Down stop on the timeline: the hero, chapter 01 and 02 once every line is lit, each of the
 * exhibit's seven beats (its live photo, the five checks, the paid receipt) at its hold, and the console.
 */
const PAGE_STOPS = [
  0,
  CONSENT_AT[2] + 0.014,
  SHOT_AT[2] + 0.012,
  ...EXHIBIT_BEATS.map((b) => EXHIBIT_RANGE[0] + holdOf(b.id) * (EXHIBIT_RANGE[1] - EXHIBIT_RANGE[0])),
  0.96,
].map(scrollAt);

/** Scrolls the runway (the stage's parent) so the timeline reads t: for the exhibit's check buttons. */
function seekTo(st: HTMLElement | null, t: number) {
  const runway = st?.parentElement;
  if (!runway) return;
  const top = runway.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: top + scrollAt(t) * (runway.offsetHeight - window.innerHeight), behavior: "instant" });
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
  useBeatPaging(
    () => stage.current?.parentElement,
    PAGE_STOPS,
    () => stage.current?.parentElement?.nextElementSibling as HTMLElement | null,
  );

  useMotionValueEvent(p, "change", (v) => {
    // After Motion has written this frame's styles, so the laptop is measured where it is now, not a frame ago.
    motionFrame.postRender(() => applyClip(screen.current, stage.current, p.get()));
    let next = 0;
    STARTS.forEach((s, i) => {
      if (v >= (i === 5 ? CONSOLE_AT : s - OUT[1])) next = i;
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
  // The rail's skip link hides while the exhibit covers it: the exhibit carries the same link in its own foot. Past the
  // console it has nothing left to skip, so it fades out as the pin releases, never left alone on the stage.
  const skipVisibility = useTransform(p, (v) => (exhibitPage(v) > 0 ? "hidden" : "visible"));
  const skipOpacity = useTransform(p, (v) => clamp01((v - RAIL_IN) / 0.03) * (1 - clamp01((v - 0.97) / 0.03)));

  return (
    <>
      <div ref={screen} className={clsx(styles.screen, "pointer-events-none invisible opacity-0")} aria-hidden="true">
        <motion.div className={clsx(styles.screenInner, "pointer-events-none rounded-frame shadow-card")} style={{ opacity: frame }} />
        <div className={styles.screenInner} data-screen-inner>
          <motion.div style={{ opacity: bar }}>
            <ScreenBar step={[1, 2, 3, 4, 4, 4][chapter]} console={chapter === 5} />
          </motion.div>
          <div className="relative min-h-0 flex-1">
            <Compact.Provider value={compact}>
              <Layer p={p} i={0} compact={compact}>
                <ConsentChapter p={p} />
              </Layer>
              <Layer p={p} i={1} compact={compact}>
                <CodeChapter p={p} />
              </Layer>
              {/* Chapters 03 to 05 are the Opened Exhibit, a full-stage layer above the screen and the rail (below). */}
              <Layer p={p} i={5} compact={compact} fill>
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
        <motion.div className="pointer-events-auto pt-4 focus-within:!opacity-100" style={{ opacity: skipOpacity, visibility: skipVisibility }}>
          {skip}
        </motion.div>
      </div>

      <ExhibitSlot p={p} skip={skip} onSeek={(t) => seekTo(stage.current, t)} />
    </>
  );
}
