"use client";

import clsx from "clsx";
import { frame as motionFrame, motion, useMotionValueEvent, useTransform } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { BEATS as EXHIBIT_BEATS, holdOf } from "../teardown/model";
import { CHAPTERS, CONSENT_AT, SHOT_AT } from "./claim";
import { CodeChapter, Compact, ConsentChapter, ConsoleChapter, type Progress } from "./chapters";
import { ExhibitSlot } from "./ExhibitSlot";
import { useBeatPaging } from "./paging";
import { scrollAt } from "./pace";
import { ScreenBar } from "./frames";
import { CUT_IN, ENTER, IN_OUT, LEAVE, useChapterGate, useGate } from "./gate";
import { EXHIBIT_RANGE, chapterAt, clamp01, inExhibit } from "./timeline";
import styles from "./custody.module.css";

// The pinned Chain of Custody on laptops (spec H2). Everything here is drawn from one timeline p (paced against the
// scroll in pace.ts). The laptop dollies in until its screen's glass covers chapter 01's consent card (0.04 to 0.12,
// HeroRunway), then hands over to a flat, unscaled screen layer: between 0.12 and 0.17 its clip-path grows from the laptop screen's measured rect to the screen's place on the grid, so no text is ever scaled,
// up or down. The rail takes columns 1 to 3 and the screen columns 4 to 12 of the page grid, like every section.

export const HANDOFF = [0.12, 0.17] as const;
/** The rail's chapter list comes in as the hero copy goes (the dolly's first quarter), so the left of the screen is
 * never empty while the laptop moves into the window: just after the copy leaves (HeroRunway DOLLY[0] + 0.005). */
const RAIL_IN = 0.045;
/** The screen's own frame and bar come in with the consent screen: the glass already spans the window's width and top,
 * so the clip only grows down and never slices them. */
const ON_GRID = HANDOFF[0];

const inOut = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

function Layer({ p, i, compact, fill, children }: { p: Progress; i: number; compact: boolean; fill?: boolean; children: ReactNode }) {
  // A cut in time at the chapter's start (gate.ts), rising 8px as it comes in: never a scrubbed fade a reader can stop in.
  const opacity = useChapterGate(p, (c) => c === i);
  const y = useTransform(opacity, (o) => (i === 0 ? 0 : 8 * (1 - o)));
  const visibility = useTransform(opacity, (o) => (o > 0 ? "visible" : "hidden"));
  return (
    // A claim screen sits in the middle of the frame at every size (one rule: top-aligned, a laptop screen left its lower
    // half empty, a tall one its upper); the console fills it.
    <motion.div
      data-layer={i}
      // The console's queue starts 24px under its bar, as the tour's does under its ledger, never a well of empty ground.
      className={clsx("absolute inset-0 flex justify-center px-8", compact || fill ? "pt-6 pb-4" : "pt-12 pb-8", fill ? "items-start" : "items-center")}
      style={{ opacity, y, visibility }}
    >
      <div className={clsx("w-full max-w-[66rem]", fill && "h-full")}>{children}</div>
    </motion.div>
  );
}

/** The rail items come in one after another, this far apart (seconds). */
const RAIL_STAGGER = 0.05;

function RailItem({ p, i }: { p: Progress; i: number }) {
  const c = CHAPTERS[i];
  // Enters in turn once p passes RAIL_IN, in time (the whole list in about half a second), then 100% while its chapter
  // is on screen, else 35%. Item 06 is the console, the screen's layer 5.
  const enter = useGate(p, (v) => v >= RAIL_IN, { ...ENTER, delay: i * RAIL_STAGGER }, LEAVE);
  const on = useOn(p, i);
  const opacity = useTransform(() => enter.get() * (0.35 + 0.65 * on.get()));
  const x = useTransform(enter, (k) => -12 * (1 - k));
  // The amber edge marks the chapter on screen, full height beside its name as soon as it is on (in time, with the
  // chapter's own cut, never scrubbed): a mark, not a meter, so it never rests as a stub. Chapters 03 to 05 are under
  // the exhibit; 06's edge marks the console.
  return (
    <motion.li className="relative py-2.5" style={{ opacity, x }}>
      <motion.span className="absolute inset-y-1.5 -left-4 w-0.5 rounded-full bg-accent" style={{ scaleY: on, originY: 0 }} />
      <span className="text-body font-medium">{c.title}</span>
    </motion.li>
  );
}

/** Whether chapter i is the one on the rail: 01 only once its screen has taken over from the laptop (HANDOFF), so the
 * rail never names the login while the laptop still shows the hero's finished claim. */
function useOn(p: Progress, i: number) {
  const chapter = useChapterGate(p, (n) => n === i);
  const first = useGate(p, (v) => v >= HANDOFF[0] && chapterAt(v) === 0, CUT_IN, LEAVE);
  return i === 0 ? first : chapter;
}

function RailCaption({ p, i }: { p: Progress; i: number }) {
  const on = useOn(p, i);
  const enter = useGate(p, (v) => v >= RAIL_IN);
  const opacity = useTransform(() => on.get() * enter.get());
  return (
    <motion.p className="absolute inset-x-0 top-0 text-ui text-pretty text-text-2" style={{ opacity }}>
      {CHAPTERS[i].text}
    </motion.p>
  );
}

/**
 * The screen's clip: the laptop screen's live rect at 0.12, the screen's place on the grid (columns 4 to 12) at 0.17.
 * The layer itself comes in over the laptop's own screen in time as p passes 0.12 (CustodyStage), so no stop rests
 * on the two screens half over each other. Only the consent card shows while the clip grows (chapter 01's other column
 * comes in once it has reached the grid, ConsentChapter), so no text is ever sliced by its edge. Written straight to
 * the element, so scrolling never re-renders React.
 */
function applyClip(el: HTMLElement | null, st: HTMLElement | null, v: number) {
  if (!el || !st || v < HANDOFF[0]) return;
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
      // Once the laptop has gone from under it (0.13 to 0.15), the clip lets go of the consent card's edges, so a stop
      // mid-growth shows the card whole, never its top or a side sliced off.
      const card = el.querySelector("[data-dolly-target]")?.getBoundingClientRect();
      const c = clamp01((v - 0.13) / 0.02);
      if (card && c > 0) {
        const m = 16;
        const keep = { t: card.top - S.top - m, r: S.right - card.right - m, b: S.bottom - card.bottom - m, l: card.left - S.left - m };
        for (const key of ["t", "r", "b", "l"] as const) box[key] += (Math.min(box[key], keep[key]) - box[key]) * c;
      }
    }
  }
  el.style.clipPath = `inset(${box.t.toFixed(1)}px ${box.r.toFixed(1)}px ${box.b.toFixed(1)}px ${box.l.toFixed(1)}px round ${box.round.toFixed(1)}px)`;
}

/** The exhibit's beats a stop rests on: the live photo, check 3 (the three checks that need no AI play on the way to
 * it) and the paid receipt (checks 4 and 5, the model's, play on the way to it). */
const EXHIBIT_STOPS = ["intro", "acct", "paid"] as const;

/**
 * Where Space and Page Down stop on the timeline: the hero, chapter 01 as the dolly lands (its lines light in time, so
 * the dolly's landing ends on the settled screen, never drifting on through a stretch of scroll to light them), 02 once
 * every line is lit, three of the exhibit's beats at their holds (EXHIBIT_STOPS), and the console: six beats, each a
 * finished frame, rather than ten that read alike.
 */
export const PAGE_STOPS = [
  0,
  CONSENT_AT[2] + 0.015,
  SHOT_AT[2] + 0.012,
  ...EXHIBIT_BEATS.filter((b) => (EXHIBIT_STOPS as readonly string[]).includes(b.id)).map((b) => EXHIBIT_RANGE[0] + holdOf(b.id) * (EXHIBIT_RANGE[1] - EXHIBIT_RANGE[0])),
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
  // The page-wide pager (scroll/keys.ts) pages these same beats wherever it runs, and from the console steps out of the
  // pin onto the Problem sheet open; this one is the pin's own, for when it doesn't.
  useBeatPaging(() => stage.current?.parentElement, PAGE_STOPS);

  useMotionValueEvent(p, "change", (v) => {
    // After Motion has written this frame's styles, so the laptop is measured where it is now, not a frame ago.
    motionFrame.postRender(() => applyClip(screen.current, stage.current, p.get()));
    setChapter(chapterAt(v));
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

  // Chapter 06's window is as tall as its queue, never a half-empty table on a tall screen (custody.module.css
  // .screen[data-fit]): its bar, the layer's padding, the queue's tabs, header and foot, and every claim's row at full
  // height (RM-0442's opens into place as the chapter plays). Read from the layout, so the compact rows and the fonts
  // count; the clip follows the window.
  useLayoutEffect(() => {
    const el = screen.current;
    const st = stage.current;
    const inner = el?.querySelector<HTMLElement>("[data-screen-inner]");
    const layer = el?.querySelector<HTMLElement>('[data-layer="5"]');
    const queue = layer?.querySelector<HTMLElement>("[data-console-queue]");
    const rows = queue?.querySelector<HTMLElement>("[data-console-rows]");
    const bar = inner?.firstElementChild as HTMLElement | null | undefined;
    if (!el || !layer || !queue || !rows || !bar) return;
    const fit = () => {
      const h = (e: Element | undefined) => e?.getBoundingClientRect().height ?? 0;
      const row = h(rows.children[1]);
      const fixed = [...queue.children].reduce((sum, c) => (c === rows ? sum : sum + h(c)), 0);
      const pad = parseFloat(getComputedStyle(layer).paddingTop) + parseFloat(getComputedStyle(layer).paddingBottom);
      // A pixel over, so subpixel rounding never wraps the last row out of sight.
      el.style.setProperty("--fit-h", `${Math.ceil(h(bar) + pad + fixed + rows.children.length * row) + 1}px`);
      applyClip(el, st, p.get());
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(bar);
    ro.observe(queue);
    return () => ro.disconnect();
  }, [chapter, compact, stage, p]);

  // As p passes 0.12, in time, the laptop's own screen dissolves straight into the consent screen: the layer and its
  // content come in together (200ms and 240ms), so the screen never shows a frame of bare ground between the two UIs.
  // Back, both leave in 160ms. Opacity and pointer events as well as visibility: a chapter
  // layer sets its own visibility, which would show through a hidden parent and catch the hero's clicks and pointer
  // (the laptop's tilt) while invisible.
  const handIn = useGate(p, (v) => v >= HANDOFF[0], { ...ENTER, duration: 0.2 }, { ...LEAVE, duration: 0.16 });
  const content = useGate(p, (v) => v >= HANDOFF[0], { ...ENTER, duration: 0.24 }, { ...LEAVE, duration: 0.16 });
  const screenStyle = {
    opacity: handIn,
    visibility: useTransform(handIn, (o) => (o > 0 ? "visible" : "hidden")),
    pointerEvents: useTransform(handIn, (o) => (o > 0.5 ? "auto" : "none")),
  };
  // The screen's frame and app bar come in with the clip on the grid, so the growing clip never slices the bar's words.
  // They and the rail leave while the exhibit covers the stage, and come back after it has gone, so its cuts in and
  // out pass through the bare ground, never the exhibit's headline over the rail's list.
  const frame = useGate(p, (v) => v >= ON_GRID && !inExhibit(v), CUT_IN, LEAVE);
  const railHead = useGate(p, (v) => v >= RAIL_IN && !inExhibit(v), CUT_IN, LEAVE);
  // The rail's skip link hides while the exhibit covers it: the exhibit carries the same link in its own foot. Past the
  // console it has nothing left to skip, so it fades out as the pin releases, never left alone on the stage.
  const skipVisibility = useTransform(p, (v) => (inExhibit(v) ? "hidden" : "visible"));
  const skipOpacity = useGate(p, (v) => v >= RAIL_IN && v < 0.97, ENTER, { duration: 0.24, ease: IN_OUT });

  return (
    <>
      <motion.div ref={screen} className={styles.screen} style={screenStyle} data-fit={chapter === 5 || undefined} aria-hidden="true">
        {/* The window's edge: a definite hairline with its soft shadow, so its corners never float alone. */}
        <motion.div className={clsx(styles.screenInner, "pointer-events-none rounded-frame shadow-card ring-1 ring-line")} style={{ opacity: frame }} />
        <div className={styles.screenInner} data-screen-inner>
          <motion.div style={{ opacity: frame }}>
            <ScreenBar console={chapter === 5} />
          </motion.div>
          <motion.div className="relative min-h-0 flex-1" style={{ opacity: content }}>
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
          </motion.div>
        </div>
      </motion.div>

      <div className={clsx(styles.rail, "pointer-events-none")}>
        <motion.div className="flex min-h-0 flex-1 flex-col" style={{ opacity: railHead }} aria-hidden="true">
          <span className="eyebrow text-muted">How it works</span>
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
