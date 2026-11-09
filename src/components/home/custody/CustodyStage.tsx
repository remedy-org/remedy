"use client";

import clsx from "clsx";
import { frame as motionFrame, motion, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { ClaimRow } from "@/app/console/_lib/view";
import { Receipt } from "@/components/home/teardown";
import { BEATS as EXHIBIT_BEATS, holdOf } from "../teardown/model";
import { ARRIVAL, EXHIBIT_LIFT, LAND, arrivalAt, cardAt, consoleAt, consoleParts, exhibitOutAt, frameAt, lookAt, railBackAt, turnAt, type Box } from "./arrival";
import { CHAPTERS, CLAIM, CONSENT_AT, SHOT_AT } from "./claim";
import { CodeChapter, Compact, ConsentChapter, ConsoleChapter, QueueRow, type Progress } from "./chapters";
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

function Layer({ p, i, compact, fill, gate, children }: { p: Progress; i: number; compact: boolean; fill?: boolean; gate?: MotionValue<number>; children: ReactNode }) {
  // A cut in time at the chapter's start (gate.ts), rising 8px as it comes in: never a scrubbed fade a reader can stop in.
  // `gate` overrides it, without the rise: the console's content comes in round the arriving card, which must find its
  // slot where it will rest.
  const cut = useChapterGate(p, (c) => c === i);
  const opacity = gate ?? cut;
  const y = useTransform(opacity, (o) => (i === 0 || gate ? 0 : 8 * (1 - o)));
  const visibility = useTransform(opacity, (o) => (o > 0 ? "visible" : "hidden"));
  return (
    // A claim screen sits in the middle of the window under the bar (at its top it left the lower 40% of the frame
    // empty above "Skip to Fraud checks"), from its top when it has no room to spare; the console fills it.
    <motion.div
      data-layer={i}
      // The console's queue starts 24px under its bar, as the tour's does under its ledger, never a well of empty ground.
      className={clsx("absolute inset-0 flex items-start justify-center px-8", compact || fill ? "pt-6 pb-4" : "pt-12 pb-8")}
      style={{ opacity, y, visibility }}
    >
      <div className={clsx("w-full max-w-[66rem]", fill ? "h-full" : "my-auto")}>{children}</div>
    </motion.div>
  );
}

/** ms after chapter 06 has gone that its window takes the stage's full height again: its console's cut out is over. */
const UNFIT_AFTER = 260;

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

/**
 * Chapter 06's arrival (arrival.ts), written straight to the elements as the clip is, so scrolling never re-renders
 * React. From the console's cut (ARRIVAL[0]) to the row landing (LAND), the card stands in for the exhibit's receipt (hidden
 * meanwhile): it starts as that receipt, in its place and look, folds into RM-0442's row where it lay, and glides to the
 * row's slot at the top of the queue, settling flat; the window's edge (`ghost`) is drawn out round it from its fold on,
 * and stays as the window's edge through the chapter. Back up, the card holds the receipt until the exhibit is whole
 * over the stage again (its 500ms cut in), so the receipt never blinks.
 */
function paintArrival(refs: Record<"stage" | "card" | "ghost", RefObject<HTMLDivElement | null>>, v: number, exhibit: number) {
  const st = refs.stage.current;
  const el = refs.card.current;
  const fr = refs.ghost.current;
  if (!st || !el || !fr) return;
  const S = st.getBoundingClientRect();
  const rel = (e: Element | null): Box | null => {
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.left - S.left, y: r.top - S.top, w: r.width, h: r.height };
  };
  const receipt = st.querySelector<HTMLElement>("[data-exhibit-slot] [data-receipt]");
  const win = rel(st.querySelector("[data-screen-inner]"));
  if (!win) return;
  const slot = rel(st.querySelector('[data-layer="5"] [data-arriving]')) ?? win;
  // Where the receipt lay before the exhibit lifted away round it, so the card holds still while the exhibit goes.
  const lay = rel(receipt);
  const r0 = lay ? { ...lay, y: lay.y + EXHIBIT_LIFT * exhibitOutAt(v) } : slot;
  const k = arrivalAt(v);
  const c = chapterAt(v);
  const on = !!receipt && ((v >= ARRIVAL[0] && v < LAND) || (c === 4 && exhibit < 1));
  // The exhibit's own receipt is hidden while the card stands in for it, and through chapter 06 (the exhibit may still be
  // dissolving out after a fast jump past the landing, and the receipt has gone into the queue).
  if (receipt) receipt.style.visibility = on || c === 5 ? "hidden" : "";
  const box = cardAt(k, r0, slot, win);
  const f = c === 5 ? frameAt(k, box, win) : null;
  fr.style.visibility = f ? "visible" : "hidden";
  if (f) {
    fr.style.transform = `translate(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px)`;
    fr.style.width = `${f.w.toFixed(1)}px`;
    fr.style.height = `${f.h.toFixed(1)}px`;
  }
  el.style.visibility = on ? "visible" : "hidden";
  if (!on) return;
  // In the dark room the cream receipt turns to the dark card over a long stretch of scroll (arrival.ts TURN); light is
  // data-theme="light" on <html> or the nearest themed subtree, dark the default.
  const dark = st.closest("[data-theme]")?.getAttribute("data-theme") !== "light";
  const look = lookAt(k, dark ? turnAt(v) : undefined);
  el.style.transform = `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;
  el.style.width = `${box.w.toFixed(1)}px`;
  el.style.height = `${box.h.toFixed(1)}px`;
  // Its ground: none at first (the receipt's own paper, perforated edge and all), then the receipt's paper turning to the
  // console's surface, lifted on a hairline and a soft shadow, then flat: the row's own ground with the queue's flash
  // (ConsoleChapter's, 8% at LAND), so the card's last frame and the row's first are one.
  const lift = look.lift;
  const ground = el.querySelector<HTMLElement>("[data-card-ground]");
  if (ground) {
    ground.style.backgroundColor = `color-mix(in oklab, var(--paper) ${(look.paper * 100).toFixed(1)}%, var(--surface))`;
    ground.style.opacity = (look.ground * lift).toFixed(3);
  }
  const tint = el.querySelector<HTMLElement>("[data-card-tint]");
  if (tint) tint.style.opacity = (1 - lift).toFixed(3);
  const edge = look.ground * lift;
  el.style.boxShadow = `0 0 0 1px color-mix(in oklch, var(--line) ${(edge * 100).toFixed(1)}%, transparent), 0 14px 32px -18px oklch(0 0 0 / ${(0.5 * edge).toFixed(3)})`;
  el.style.borderRadius = `${(6 * lift).toFixed(2)}px`;
  // The receipt stays where it lay while the card folds round it, cropped to the card from top and bottom alike; its own
  // shadow shows only on the first frames, while it is still the receipt whole.
  const rc = el.querySelector<HTMLElement>("[data-card-receipt]");
  if (rc) {
    const crop = Math.max(0, (r0.h - box.h) / 2);
    const m = 64 * (1 - Math.min(1, k / 0.04));
    rc.style.width = `${r0.w.toFixed(1)}px`;
    rc.style.transform = `translate(${(box.w - r0.w).toFixed(1)}px, ${((box.h - r0.h) / 2).toFixed(1)}px)`;
    rc.style.clipPath = `inset(${(crop - m).toFixed(1)}px ${-m}px ${(crop - m).toFixed(1)}px ${-m}px)`;
    rc.style.opacity = look.receipt.toFixed(3);
    // Once the card's ground is up under it (the receipt's own paper, to the shade), the receipt gives up its paper and
    // shadow to the card: its words dim on the card's one ground as it turns to the console's surface, never a lighter
    // receipt-shaped patch on a darker card.
    const folding = look.ground >= 1;
    const paper = rc.querySelector<HTMLElement>(".bg-paper");
    const lifted = rc.querySelector<HTMLElement>(".paper-lifted");
    if (paper) paper.style.background = folding ? "transparent" : "";
    if (lifted) lifted.style.filter = folding ? "none" : "";
    // "inherit", never "visible": a visible child would show through the card once it is hidden.
    rc.style.visibility = look.receipt > 0 ? "inherit" : "hidden";
  }
  // The row at its own width from the card's left edge, the part past the card's right edge cut until it has widened.
  const row = el.querySelector<HTMLElement>("[data-card-row]");
  if (row) {
    row.style.width = `${slot.w.toFixed(1)}px`;
    row.style.transform = `translateY(${((box.h - slot.h) / 2).toFixed(1)}px)`;
    row.style.clipPath = `inset(0 ${Math.max(0, slot.w - box.w).toFixed(1)}px 0 0)`;
    row.style.opacity = look.row.toFixed(3);
    row.style.visibility = look.row > 0 ? "inherit" : "hidden";
  }
}

export interface CustodyStageProps {
  p: Progress;
  stage: RefObject<HTMLDivElement | null>;
  skip: ReactNode;
  /** Chapter 06's queue, as /console draws it. */
  consoleRows: ClaimRow[];
}

export function CustodyStage({ p, stage, skip, consoleRows }: CustodyStageProps) {
  const screen = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [chapter, setChapter] = useState(0);
  // The page-wide pager (scroll/keys.ts) pages these same beats wherever it runs, and from the console steps out of the
  // pin onto the Problem sheet open; this one is the pin's own, for when it doesn't.
  useBeatPaging(() => stage.current?.parentElement, PAGE_STOPS);
  // The exhibit's layer (ExhibitSlot): in over chapter 02 as a cut in time, out onto the console scrubbed, fading and
  // lifting away past the paid stop (arrival.ts EXHIBIT_OUT) while chapter 06's card stands in for its receipt. Held
  // here, so the arrival knows when the exhibit is back whole over the stage and its own receipt can take over again.
  const exhibitIn = useChapterGate(p, (c) => c >= 2, { duration: 0.28, ease: IN_OUT });
  const exhibitOut = useTransform(p, exhibitOutAt);
  const exhibitOn = useTransform(() => exhibitIn.get() * (1 - exhibitOut.get()));
  const arriving = consoleRows.find((r) => r.id === CLAIM.id);
  /** The console's parts, in the order they come in (arrival.ts consoleAt): its bar is the first. */
  const parts = consoleParts(consoleRows.filter((r) => r.id !== CLAIM.id).length);
  const paint = useCallback(() => paintArrival({ stage, card, ghost }, p.get(), exhibitOn.get()), [stage, p, exhibitOn]);

  useMotionValueEvent(p, "change", (v) => {
    // After Motion has written this frame's styles, so the laptop is measured where it is now, not a frame ago.
    motionFrame.postRender(() => {
      applyClip(screen.current, stage.current, p.get());
      paint();
    });
    setChapter(chapterAt(v));
  });
  useMotionValueEvent(exhibitOn, "change", () => motionFrame.postRender(paint));

  // Short laptop screens (a stage under 800px, so a viewport under about 864px) get the chapters' compact layouts:
  // tighter gaps, a smaller photo and fewer rows. Type never shrinks, so mono text stays at 12px.
  useEffect(() => {
    const st = stage.current;
    if (!st) return;
    const fit = () => {
      applyClip(screen.current, st, p.get());
      paint();
      setCompact(st.clientHeight < 800);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(st);
    return () => ro.disconnect();
  }, [stage, p, paint]);

  // Chapter 06's window is as tall as its queue, never a half-empty table on a tall screen (custody.module.css
  // .screen[data-fit]): its bar, the layer's padding, the queue's tabs, header and foot, and every claim's row at full
  // height (RM-0442's slot is open from the start, arrival.ts). Read from the layout, so the compact rows and the fonts
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
      paint();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(bar);
    ro.observe(queue);
    return () => ro.disconnect();
  }, [chapter, compact, stage, p, paint]);

  // The fitted window (data-fit) comes with chapter 06 and goes only once its console has cut out (LEAVE, 180ms), so
  // going back up the console never shows in the full-height window for a frame. Written straight to the element, as
  // the clip is, so React never puts it back.
  useEffect(() => {
    const el = screen.current;
    if (!el) return;
    const set = (on: boolean) => {
      el.toggleAttribute("data-fit", on);
      applyClip(el, stage.current, p.get());
      paint();
    };
    if (chapter === 5) {
      set(true);
      return;
    }
    const t = window.setTimeout(() => set(false), UNFIT_AFTER);
    return () => window.clearTimeout(t);
  }, [chapter, stage, p, paint]);

  // As p passes 0.12, in time, the laptop's own screen hands over to the consent screen in two halves: the layer's
  // ground covers the laptop's checks list in 110ms, and only then does the consent screen's content rise in (140ms), so
  // no frame shows the two UIs' words printed over each other (together, the checks list ran half see-through over the
  // headline and the brass button). Back, the content goes first (80ms), then the ground (80ms). Opacity and pointer
  // events as well as visibility: a chapter layer sets its own visibility, which would show through a hidden parent and
  // catch the hero's clicks and pointer (the laptop's tilt) while invisible.
  const handIn = useGate(p, (v) => v >= HANDOFF[0], { ...ENTER, duration: 0.11 }, { ...LEAVE, duration: 0.08, delay: 0.08 });
  const content = useGate(p, (v) => v >= HANDOFF[0], { ...ENTER, duration: 0.14, delay: 0.11 }, { ...LEAVE, duration: 0.08 });
  const screenStyle = {
    opacity: handIn,
    visibility: useTransform(handIn, (o) => (o > 0 ? "visible" : "hidden")),
    pointerEvents: useTransform(handIn, (o) => (o > 0.5 ? "auto" : "none")),
  };
  // The screen's frame and app bar come in with the clip on the grid, so the growing clip never slices the bar's words.
  // They and the rail leave, in time, while the exhibit covers the stage, so their cuts pass through the bare ground,
  // never the exhibit's headline over the rail's list. Chapter 06's are scrubbed (arrival.ts), so the paid claim's way
  // into the console is one move, played at the reader's pace both ways: the rail comes back once the exhibit's heading
  // has all but gone (RAIL_BACK); the window's edge is the arrival's frame, drawn out round the arriving card; and its
  // bar is the first of the console's parts to come in once that frame is all but drawn (CONSOLE_IN).
  const frame = useGate(p, (v) => v >= ON_GRID && v < EXHIBIT_RANGE[0], CUT_IN, LEAVE);
  const bar = useTransform(() => (p.get() >= ARRIVAL[0] ? consoleAt(p.get(), 0, parts) : frame.get()));
  const consoleLayer = useTransform(p, (v): number => (v >= ARRIVAL[0] ? 1 : 0));
  const railGate = useGate(p, (v) => v >= RAIL_IN && v < EXHIBIT_RANGE[0], CUT_IN, LEAVE);
  const railHead = useTransform(() => (p.get() >= EXHIBIT_RANGE[1] ? railBackAt(p.get()) : railGate.get()));
  // The rail's skip link hides while the exhibit covers it: the exhibit carries the same link in its own foot. Past the
  // console it has nothing left to skip, so it fades out as the pin releases, never left alone on the stage.
  const skipVisibility = useTransform(p, (v) => (inExhibit(v) ? "hidden" : "visible"));
  const skipGate = useGate(p, (v) => v >= RAIL_IN && v < 0.97, ENTER, { duration: 0.24, ease: IN_OUT });
  const skipOpacity = useTransform(() => skipGate.get() * (p.get() >= EXHIBIT_RANGE[1] ? railBackAt(p.get()) : 1));

  return (
    <>
      <motion.div ref={screen} className={styles.screen} style={screenStyle} aria-hidden="true">
        {/* The window's edge: a definite hairline with its soft shadow, so its corners never float alone. */}
        <motion.div className={clsx(styles.screenInner, "pointer-events-none rounded-frame shadow-card ring-1 ring-line")} style={{ opacity: frame }} />
        <div className={styles.screenInner} data-screen-inner>
          <motion.div style={{ opacity: bar }}>
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
              <Layer p={p} i={5} compact={compact} fill gate={consoleLayer}>
                <ConsoleChapter p={p} rows={consoleRows} />
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

      <ExhibitSlot p={p} page={exhibitOn} out={exhibitOut} skip={skip} onSeek={(t) => seekTo(stage.current, t)} />

      {/* Chapter 06's arrival (arrival.ts, paintArrival): the console window's edge, drawn out round the card... */}
      <div ref={ghost} aria-hidden="true" className="pointer-events-none absolute top-0 left-0 z-[6] rounded-frame shadow-card ring-1 ring-line" style={{ visibility: "hidden" }} />
      {/* ...and the card: the paid receipt, folding into RM-0442's row and gliding into its slot. Always mounted (hidden),
          so its receipt's stamp has landed long before the card first shows it. */}
      <div ref={card} aria-hidden="true" className="pointer-events-none absolute top-0 left-0 z-[7]" style={{ visibility: "hidden" }}>
        <div data-card-ground className="absolute inset-0 rounded-[inherit] opacity-0" />
        <div data-card-tint className="absolute inset-0 rounded-[inherit] bg-[color-mix(in_oklch,var(--text)_8%,transparent)] opacity-0" />
        <div data-card-receipt className="absolute top-0 left-0">
          <Receipt stamped />
        </div>
        {arriving && (
          <div data-card-row className="claims-grid absolute top-0 left-0 @container">
            <QueueRow row={arriving} />
          </div>
        )}
      </div>
    </>
  );
}
