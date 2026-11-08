"use client";

import clsx from "clsx";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { formatCents, ledgerOf } from "@/app/console/_lib/view";
import type { InsightsData } from "@/app/console/insights/facts";
import type { PreviewRow } from "@/components/console/ClaimsGridPreview";
import { ClaimsGridPreviewLazy } from "@/components/console/ClaimsGridPreviewLazy";
import { EvidenceStill } from "@/components/console/EvidenceStill";
import { formatCount } from "@/components/console/format";
import { GridStill } from "@/components/console/GridStill";
import { TABS, type Tab } from "@/components/console/StatusTabs";
import { InsightsPreviewLazy, loadInsightsPreview, STUDIO_ON_HOME, type StudioFilter } from "@/components/insights/InsightsPreviewLazy";
import { spokenTime } from "@/components/insights/report";
import { ConsoleFrame, type FramePage } from "./ConsoleFrame";
import styles from "./tour.module.css";
import { PayoutsNote } from "./PayoutsNote";
import { TOUR } from "./tour-copy";
import { nextTab, stateAt, STEPS, type Step } from "./tour-state";

/*
 * The homepage's "For companies" tour (DESIGN.md, Screens §6), laptops only (1024px and up; phones get the stacked
 * story in ConsoleStory.tsx). Four tabs over one fixed console frame, a real view on each step:
 *   01 the claims queue, the real AG Grid on the recall's 40 claims, where the newest paid claim arrives on entering
 *      view however a visitor gets there (a row insert, its checks filling, then its verdict and payout). The real grid
 *      takes the still's place as soon as it has drawn, so a visitor may filter it by status, sort it, hover its checks,
 *      and click a held claim to open its evidence (step 02) from the first click;
 *   02 the same grid with a held claim selected and its evidence laid over the grid's right-hand columns;
 *   03 Insights: real AG Studio, drawn out of sight once a visitor shows intent (a pointer over its step, focus or a
 *      pick), so a page that is only scrolled past never loads it (the still stands in until then). A visitor may
 *      hover its charts and cross-filter it, and clear the filter from the frame;
 *   04 the CPSC report draft, the section's one paper object, read by scrolling it.
 * The grid scrolls inside the frame only once a visitor has clicked or focused it, the report also once the pointer
 * rests on it with the page still: a wheel passing over the frame keeps moving the page.
 * Nothing autoplays except 01's arrival; every other moment plays when its tab is picked. The frame never changes
 * height, and the grid never changes width: no step reflows its columns. tour-state.ts holds what each step shows;
 * reduced motion shows every step's final state at once.
 */

const ENTER = 0.35;
const LEAVE = 0.25;
// On 02 the held claim's row is selected at once and its evidence docks a beat later, so the panel reads as the row's.
const OPEN_AFTER = 180;
// In at +600ms, its checks back at +1400ms (the bars fill over 480ms), the verdict at +2000ms.
const ARRIVE = { interim: 600, checked: 1400, final: 2000, done: 3100 };
const STUDIO_FROM = 1024;
// How long the page must have been still before a pointer resting on the report hands it the wheel.
const IDLE = 150;
const STUDIO_WAIT = 8000;
// Studio's canvas rows are 16px, inside 14px of canvas padding and 6px around each panel (InsightsPreview.tsx): its
// cards sit on the frame's 20px inset with 12px between them, where the still draws its own.
const STUDIO_ROW = 16;
const STUDIO_PAD = 28;
// The nav's height, and the air the nav jump leaves under it.
const NAV = 64;
const AIR = 16;
// The space between the steps and the frame.
const GAP = 20;
// The frame's tallest (tour.module.css .stage), and the least it takes to keep the heading in view with it.
const FRAME_MAX = 680;
const FIT_MIN = 560;

const PAGE = { claims: "Claims", insights: "Insights", report: "Report" } as const;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Arrival = "before" | "interim" | "checked" | "final";

export interface ConsoleTourProps {
  /** The grid's rows, all 40 (the open claim's carries its evidence), memo-stable: the grid is driven through its API. */
  rows: PreviewRow[];
  /** The rows the server-drawn still shows until the grid has drawn: the first of `rows`. */
  stillRows: number;
  /** Each step's sentence under its name (tour-copy.ts stepSentences()). */
  sentences: string[];
  unitsSold: number;
  openId: string;
  arriveId: string;
  /** Each step's screen-reader description, written from the seed (tour-copy.ts describe()). */
  descriptions: string[];
  /** Step 03's still and step 04's sheet, rendered on the server. */
  insights: ReactNode;
  report: ReactNode;
  /** Real Studio's data, when STUDIO_ON_HOME. */
  studio?: { data: InsightsData } | null;
}

/** The rows as the queue holds them at a point of the arrival: not yet in, just in and being checked, or decided. */
function rowsAt(rows: PreviewRow[], id: string, at: Arrival): PreviewRow[] {
  if (at === "final") return rows;
  if (at === "before") return rows.filter((r) => r.id !== id);
  // In, or checked with its verdict still to come: in progress.
  return rows.map((r) => (r.id === id ? { ...r, decision: "pending" } : r));
}

/**
 * A figure that changes in place, as a live console's does: the old value rolls up and out as the new one rolls up
 * into its place (tour.module.css .roll, 360ms). Under reduced motion it simply changes.
 */
function Roll({ value }: { value: string }) {
  const [at, setAt] = useState({ now: value, was: null as string | null, n: 0 });
  if (at.now !== value) setAt({ now: value, was: reduced() ? null : at.now, n: at.n + 1 });
  useEffect(() => {
    if (at.was === null) return;
    const t = window.setTimeout(() => setAt((a) => ({ ...a, was: null })), 400);
    return () => window.clearTimeout(t);
  }, [at.n, at.was]);
  return (
    <span className={styles.roll}>
      {at.was !== null && (
        <span key={`was-${at.n}`} data-was aria-hidden="true" className={styles.rollOut}>
          {at.was}
        </span>
      )}
      <span key={`now-${at.n}`} data-now={at.was !== null || undefined}>
        {at.now}
      </span>
    </span>
  );
}

/** The status tabs as the console has them: each filters the live grid (AG Grid's own filter, so the rows animate),
 * their counts following the arriving claim. The console's "Approved" tab also holds claims approved and not yet sent;
 * every one here was paid (settled with PayPal, preview.ts), so it reads "Paid", as their verdicts and the ledger do. */
function StatusFilter({ counts, value, onChange }: { counts: Record<Tab, number>; value: Tab; onChange: (t: Tab) => void }) {
  return (
    <div role="group" aria-label="Filter the claims by status" className="relative flex">
      {TABS.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(t.id)}
            className={clsx(
              "relative inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-control px-3 text-ui font-medium whitespace-nowrap transition-colors first:pl-0 focus-visible:outline-2 focus-visible:outline-offset-[-4px]",
              on ? "text-text after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-text first:after:left-0" : "text-muted hover:text-text",
            )}
          >
            {t.id === "paid" ? "Paid" : t.label}
            <span className={clsx("font-normal", on ? "text-muted" : "text-faint")}>
              <Roll value={String(counts[t.id])} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The queue toolbar's right end as the console draws it (ClaimsQueue.tsx): Export CSV and the search box with its /
 * key. Drawn, not working: the tour's queue is a picture a visitor filters and sorts, never searches. */
function Toolbar() {
  return (
    <span aria-hidden="true" inert className="ml-auto flex shrink-0 items-center gap-3 select-none">
      <span className="text-ui whitespace-nowrap text-muted">{TOUR.toolbar.export}</span>
      <span className="relative flex h-9 w-44 items-center rounded-control border border-line bg-surface pr-9 pl-3 text-ui whitespace-nowrap text-faint xl:w-60">
        {TOUR.toolbar.search}
        <kbd className="absolute right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-line-strong/60 font-mono text-micro text-faint">/</kbd>
      </span>
    </span>
  );
}

/**
 * The ledger over the grid, as the console's borderless stat strip: the money sent through PayPal and how fast, then
 * the units, then what waits for a person and what was rejected or blocked. Each figure in the sans at regular weight with its
 * proportional figures (its tabular ones space a stop or a colon like mono), its words after it in the UI size. A
 * figure the arriving claim changes rolls to its new value. On a narrow window the last figures drop whole (they wrap
 * out of the strip's one line) rather than being cut.
 */
function TourLedger({ rows, unitsSold }: { rows: PreviewRow[]; unitsSold: number }) {
  const l = ledgerOf(rows, { unitsSold });
  const items: [string, string][] = [
    [formatCents(l.paidCents), "paid through PayPal"],
    ...(l.medianToPay === null ? [] : ([[spokenTime(Math.round(l.medianToPay)), "median, photo to PayPal"]] as [string, string][])),
    [formatCount(l.remedied), `of ${formatCount(unitsSold)} units remedied`],
    [formatCount(l.held), "held for a person"],
    // The status tabs' own words: no "Refused" tab to find these under.
    [formatCount(l.refused), "rejected or blocked"],
  ];
  return (
    <dl className="flex h-14 flex-wrap gap-x-8 overflow-hidden whitespace-nowrap max-xl:gap-x-6">
      {items.map(([value, label]) => (
        <div key={label} className="flex h-14 items-baseline gap-2 leading-[56px]">
          <dd className="order-1 text-[22px]">
            <Roll value={value} />
          </dd>
          <dt className="order-2 text-ui text-muted">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function ConsoleTour({ rows, stillRows, sentences, unitsSold, openId, arriveId, descriptions, insights, report, studio }: ConsoleTourProps) {
  const [step, setStep] = useState<Step>(0);
  const [open, setOpen] = useState<string | null>(null);
  // The row the grid shows selected: the open claim's, a beat before its panel docks.
  const [picked, setPicked] = useState<string | null>(null);
  // The held claim step 02 shows: the seed's, or the one a visitor clicked in the queue.
  const [claim, setClaim] = useState(openId);
  const [status, setStatus] = useState<Tab>("all");
  const [sortEpoch, setSortEpoch] = useState(0);
  // Which inner scroller the wheel may move (the grid or the report): only one a visitor has clicked or focused.
  const [engaged, setEngaged] = useState<"grid" | "report" | null>(null);
  const [dockOut, setDockOut] = useState(false);
  // The arriving claim is in the queue from the start: it is taken out (out of sight) only once the real grid has taken
  // the still's place while the frame is off screen, so it can arrive when the frame comes into view.
  const [arrival, setArrival] = useState<Arrival>("final");
  const [live, setLive] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const [studioState, setStudioState] = useState<"off" | "mounted" | "shown" | "failed">("off");
  const [studioRows, setStudioRows] = useState(36);
  const [studioAtPick, setStudioAtPick] = useState(false);
  // The checks popover opens only for a pointer that has moved over the queue since the arrival (a row sliding under a
  // still cursor is not a hover).
  const [pointed, setPointed] = useState(false);
  // The arriving claim's row: "new" while it is in and being checked (a soft tint), "settled" once its verdict lands
  // (the tint lets go over 1.4s), then nothing.
  const [fresh, setFresh] = useState<"new" | "settled" | null>(null);
  // Studio's cross-filter, said in the frame's title row with a way out.
  const [studioFilter, setStudioFilter] = useState<StudioFilter | null>(null);

  const root = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const tablist = useRef<HTMLDivElement>(null);
  const stepBar = useRef<HTMLSpanElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const insightsBody = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const timers = useRef<number[]>([]);
  const arriving = useRef<number[]>([]);
  const studioWait = useRef<number[]>([]);
  const played = useRef(false);
  const gridGate = useRef<HTMLDivElement>(null);
  const reportEl = useRef<HTMLDivElement>(null);
  const now = useRef({ step, swapped, arrival, studioState });
  useEffect(() => {
    now.current = { step, swapped, arrival, studioState };
  }, [step, swapped, arrival, studioState]);

  const later = (list: number[], ms: number, fn: () => void) => list.push(window.setTimeout(fn, ms));
  const clear = (list: number[]) => list.splice(0).forEach((t) => window.clearTimeout(t));
  useEffect(() => {
    const all = [timers.current, arriving.current, studioWait.current];
    return () => all.forEach(clear);
  }, []);

  /** The claim arrives: in at +600ms (In progress, checks waiting), decided at +1500ms (Paid; the cells flash). */
  const playArrival = useCallback(() => {
    clear(arriving.current);
    setArrival("before");
    setPointed(false);
    later(arriving.current, ARRIVE.interim, () => {
      setArrival("interim");
      setLive(true);
      setFresh("new");
    });
    later(arriving.current, ARRIVE.checked, () => setArrival("checked"));
    later(arriving.current, ARRIVE.final, () => {
      setArrival("final");
      setFresh("settled");
    });
    later(arriving.current, ARRIVE.done, () => setLive(false));
    later(arriving.current, ARRIVE.final + 2000, () => setFresh(null));
  }, []);

  /** Straight to the final state, so it never animates where no one sees it, or when a visitor has moved on. */
  const finishArrival = useCallback(() => {
    clear(arriving.current);
    setArrival("final");
    setLive(false);
    setFresh(null);
  }, []);

  // 01's arrival, the one moment that plays without a click: when the real grid is in and the frame is 35% in view.
  // Once the frame has left view on 01, the claim is taken back out of sight, so it arrives again on the way back;
  // picking 01 again simply shows the queue.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        const { step, swapped, arrival } = now.current;
        if (e.intersectionRatio >= ENTER && !played.current && step === 0 && swapped && arrival === "before" && !reduced()) {
          played.current = true;
          playArrival();
        } else if (e.intersectionRatio < LEAVE && e.intersectionRatio === 0 && step === 0 && swapped && !reduced() && played.current) {
          clear(arriving.current);
          setLive(false);
          setFresh(null);
          setArrival("before");
          played.current = false;
        } else if (e.intersectionRatio < LEAVE && arriving.current.length && arrival !== "final") finishArrival();
      },
      { threshold: [0, LEAVE, ENTER] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [playArrival, finishArrival]);

  /** How much of the frame is in view, read from the layout now (an observer only reports when a threshold is crossed). */
  const inView = () => {
    const r = frame.current?.getBoundingClientRect();
    if (!r || !r.height) return 0;
    return Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)) / r.height;
  };

  // Once the page has loaded with the frame out of view, the arriving claim is held back (still and grid alike), so it
  // arrives when the frame comes into view, however a visitor gets there (a scroll, the nav's jump, a deep link).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (!reduced() && inView() === 0) setArrival("before");
    });
    return () => cancelAnimationFrame(id);
  }, []);

  /*
   * The pointer over the queue and the report. The report takes the wheel from a pointer resting on it once the page is
   * still (and from a click or focus, as the queue does: gate() below); a pointer moving out hands the wheel back, the
   * page scrolling out from under it does not, and one the page carries over either while scrolling leaves the wheel to
   * the page. The checks popover waits for a pointer that has really moved over the queue (a row sliding under a still
   * cursor is not a hover).
   */
  useEffect(() => {
    const grid = gridGate.current;
    const report = reportEl.current;
    if (!grid || !report) return;
    let scrolledAt = 0;
    let idle = 0;
    let last = { x: -1, y: -1 };
    const scrolling = () => performance.now() - scrolledAt < IDLE;
    const moved = (e: PointerEvent) => {
      const was = last;
      last = { x: e.clientX, y: e.clientY };
      return was.x !== e.clientX || was.y !== e.clientY;
    };
    const onScroll = () => {
      scrolledAt = performance.now();
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        if (now.current.step === 3 && report.matches(":hover")) setEngaged("report");
      }, IDLE);
    };
    const release = (area: "grid" | "report") => setEngaged((e) => (e === area ? null : e));
    const on = (el: HTMLElement, area: "grid" | "report") => {
      const enter = () => {
        if (scrolling()) release(area);
        else if (area === "report") setEngaged(area);
      };
      const move = (e: PointerEvent) => {
        if (!moved(e)) return;
        if (area === "grid") setPointed(true);
        else if (!scrolling()) setEngaged(area);
      };
      const leave = () => {
        if (!scrolling()) release(area);
      };
      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      return () => {
        el.removeEventListener("pointerenter", enter);
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
      };
    };
    const off = [on(grid, "grid"), on(report, "report")];
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      off.forEach((f) => f());
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(idle);
    };
  }, []);

  // The claim was taken out of sight to arrive, but the frame is already in view (the grid swapped in while the observer
  // had last seen it out of view, and it has crossed no threshold since): it arrives now, rather than never.
  useEffect(() => {
    if (step !== 0 || !swapped || arrival !== "before" || played.current || reduced()) return;
    const frameId = requestAnimationFrame(() => {
      if (played.current || inView() < ENTER) return;
      played.current = true;
      playArrival();
    });
    return () => cancelAnimationFrame(frameId);
  }, [step, swapped, arrival, playArrival]);

  // Real Studio replaces the Insights still at 1024px and up, on intent (hover, focus or pick of tab 03, or of the app
  // bar's Insights), and never on Save-Data: a visitor who only scrolls past never loads it (nor its licence notice in
  // the console). Its canvas is measured from the frame, so it fills the body with nothing cut off. If it hasn't drawn
  // in 8s, the still stays for the session.
  const studioIntent = () => {
    if (!STUDIO_ON_HOME || !studio || now.current.studioState !== "off") return;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (window.innerWidth < STUDIO_FROM || saveData) return;
    const h = insightsBody.current?.clientHeight ?? 0;
    if (h) setStudioRows(Math.max(24, Math.floor((h - STUDIO_PAD) / STUDIO_ROW)));
    void loadInsightsPreview();
    setStudioState("mounted");
    later(studioWait.current, STUDIO_WAIT, () => setStudioState((s) => (s === "mounted" ? "failed" : s)));
  };

  // The frame fits under the steps on a laptop screen (tour.module.css .stage reads the steps row's height), and the
  // nav's "For companies" jump lands so a visitor sees the whole frame: from the heading when it all fits, else from
  // the steps.
  useLayoutEffect(() => {
    const el = root.current;
    const tabsRow = rail.current;
    const section = el?.closest("section");
    if (!el || !tabsRow || !section) return;
    const place = () => {
      const railH = tabsRow.getBoundingClientRect().height;
      el.style.setProperty("--rail-h", `${Math.round(railH)}px`);
      const top = section.getBoundingClientRect().top;
      const head = (section.querySelector("h2")?.getBoundingClientRect().top ?? top) - top;
      const tabs = tabsRow.getBoundingClientRect().top - top;
      // Where the heading, the tabs and a frame of at least FIT_MIN fit one screen (a 1440x900 laptop), the frame takes
      // the height that leaves the heading in view too; otherwise the CSS height, which fits it under the tabs.
      const withHead = window.innerHeight - NAV - AIR - (tabs - head) - railH - GAP - AIR;
      if (withHead >= FIT_MIN && withHead < FRAME_MAX) frame.current?.style.setProperty("--frame-h", `${Math.floor(withHead)}px`);
      else frame.current?.style.removeProperty("--frame-h");
      const bottom = (frame.current?.getBoundingClientRect().bottom ?? 0) - top;
      const from = bottom - head + AIR <= window.innerHeight - NAV ? head : tabs;
      // The page's scroll padding already keeps the jump under the nav: the margin only adds the air and skips the
      // section's top padding and eyebrow.
      section.style.scrollMarginTop = `${AIR - from}px`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, []);

  // The evidence panel's left edge lands on a column boundary: it covers the columns after Checks (the time, the payer
  // and the money, which it repeats), or from Checks on where those leave it too narrow, at least 380px.
  const [dockW, setDockW] = useState<number | null>(null);
  useLayoutEffect(() => {
    const gate = gridGate.current;
    if (!gate) return;
    const measure = () => {
      const checks = gate.querySelector<HTMLElement>('.ag-header-cell[col-id="checks"], [data-col="checks"]');
      const g = gate.getBoundingClientRect();
      if (!checks || !g.width) return;
      const c = checks.getBoundingClientRect();
      const after = g.right - c.right;
      setDockW(Math.round(after >= 400 ? after : Math.max(380, g.right - c.left)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(gate);
    return () => ro.disconnect();
  }, [swapped]);

  // The step bar sits under the active word, its width: measured, so it can glide and resize to the next one.
  useLayoutEffect(() => {
    const list = tablist.current;
    const bar = stepBar.current;
    if (!list || !bar) return;
    const measure = () => {
      const label = tabs.current[step]?.querySelector<HTMLElement>("[data-label]");
      if (!label) return;
      const at = label.getBoundingClientRect();
      bar.style.setProperty("--x", `${Math.round(at.left - list.getBoundingClientRect().left)}px`);
      bar.style.setProperty("--w", `${Math.round(at.width)}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [step]);

  const go = (next: Step, id = claim) => {
    const prev = now.current.step;
    if (next === prev) return;
    clear(timers.current);
    const still = reduced();
    setStep(next);
    setEngaged(null);
    settleArrival();
    if (prev === 1) {
      setOpen(null);
      setPicked(null);
      if (!still) {
        setDockOut(true);
        later(timers.current, 160, () => setDockOut(false));
      }
    }
    // Leaving the queue puts it back as it was: every claim, in the order it came in, scrolled to the top (BareGrid).
    if (next >= 2) {
      setStatus("all");
      setSortEpoch((n) => n + 1);
    }
    // The draft opens on its first page, however far a visitor read it last time.
    if (next === 3 && reportEl.current) {
      reportEl.current.scrollTop = 0;
      reportEl.current.removeAttribute("data-scrolled");
    }
    if (next === 1) {
      setDockOut(false);
      setClaim(id);
      // The open claim is always in the rows shown.
      setStatus((t) => (t === "all" || t === "held" ? t : "all"));
      setPicked(id);
      if (still) setOpen(id);
      else later(timers.current, OPEN_AFTER, () => setOpen(id));
    }
    if (next === 2) {
      setStudioAtPick(now.current.studioState === "shown");
      studioIntent();
    }
  };

  /** A visitor acted on the queue: the claim still to arrive is simply there, and arrives no more. */
  const settleArrival = () => {
    played.current = true;
    if (now.current.arrival !== "final") finishArrival();
  };

  /** A click on a row: a held claim opens its evidence (step 02), or swaps the one open. */
  const onRowClick = (row: PreviewRow) => {
    if (!row.evidence) return;
    if (now.current.step === 1) {
      setClaim(row.id);
      setPicked(row.id);
      setOpen(row.id);
    } else go(1, row.id);
  };

  const onPage = (p: FramePage) => go(p === "Insights" ? 2 : p === "Report" ? 3 : now.current.step === 1 ? 1 : 0);

  const onStatus = (t: Tab) => {
    if (now.current.step === 1) go(0);
    settleArrival();
    // The checks popover goes at once (until the pointer moves again), never left fading over the rows the filter keeps.
    setPointed(false);
    setStatus(t);
  };

  /** The wheel moves an inner scroller only once a visitor has clicked or focused it (the report: or rests on it; the
   * pointer effect above hands it back). */
  const gate = (area: "grid" | "report") => ({
    "data-engaged": engaged === area || undefined,
    onPointerDown: () => setEngaged(area),
    onFocus: () => setEngaged(area),
  });

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const to = nextTab(e.key, step);
    if (to === null) return;
    e.preventDefault();
    go(to);
    tabs.current[to]?.focus();
  };

  const state = stateAt(step, "final", { openId: claim });
  const evidence = useMemo(() => rows.find((r) => r.id === claim)?.evidence ?? null, [rows, claim]);
  const arrivalProp = useMemo(() => ({ id: arriveId, phase: arrival }), [arriveId, arrival]);
  // The ledger, the tab counts and the still follow the claim as it arrives.
  const queue = useMemo(() => rowsAt(rows, arriveId, arrival), [rows, arriveId, arrival]);
  const still = useMemo(() => queue.slice(0, stillRows), [queue, stillRows]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(TABS.map((t) => [t.id, 0])) as Record<Tab, number>;
    c.all = queue.length;
    for (const r of queue) c[r.decision]++;
    return c;
  }, [queue]);
  const dock = open !== null || dockOut;
  // The checks popover: on the queue alone (not under the evidence), never during the arrival, and only for a pointer
  // that has moved since.
  const tips = step === 0 && arrival === "final" && !live && pointed;
  const filtered = step === 2 && studioState === "shown" && studioFilter;

  return (
    <div ref={root} className="flex flex-col gap-5">
      {/* The steps: four words on column 1, the active step's one sentence on column 8 (the page's two text lines). */}
      <div ref={rail} className="grid-12 items-baseline gap-y-3">
        <div ref={tablist} role="tablist" aria-label={TOUR.tablist} className={clsx("relative col-span-12 flex gap-x-7 lg:col-span-7", styles.steps)}>
          {TOUR.steps.map((s, i) => {
            const active = i === step;
            return (
              <button
                key={s.name}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                id={`tour-tab-${i}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="tour-panel"
                aria-describedby={`tour-tab-${i}-sentence`}
                tabIndex={active ? 0 : -1}
                onClick={() => go(STEPS[i])}
                onKeyDown={onKey}
                onPointerEnter={i === 2 ? studioIntent : undefined}
                onFocus={i === 2 ? studioIntent : undefined}
                className={clsx(
                  styles.step,
                  // 8px of side padding, cancelled by the margin, so the focus ring has room around the word.
                  "-mx-2 min-h-11 cursor-pointer rounded-control px-2 text-body font-medium whitespace-nowrap transition-colors duration-160 ease-snap",
                  active ? "text-text" : "text-muted hover:text-text-2",
                )}
              >
                <span data-label>{s.name}</span>
              </button>
            );
          })}
          <span ref={stepBar} aria-hidden="true" className={styles.stepBar} />
        </div>
        <div className={clsx(styles.sentences, "col-span-12 max-w-[60ch] text-body text-pretty text-text-2 lg:col-span-5 lg:col-start-8")}>
          {sentences.map((t, i) => (
            <p key={TOUR.steps[i].name} id={`tour-tab-${i}-sentence`} data-on={i === step || undefined}>
              {t}
            </p>
          ))}
        </div>
      </div>

      <ConsoleFrame
        ref={frame}
        id="tour-panel"
        role="tabpanel"
        aria-labelledby={`tour-tab-${step}`}
        tabIndex={0}
        page={PAGE[state.page]}
        description={descriptions[step]}
        notice={
          filtered ? (
            <span key="filter" className="flex items-baseline gap-3">
              <span className="text-muted">
                Showing <span className="text-text">{studioFilter.label}</span>
              </span>
              <button
                type="button"
                onClick={studioFilter.clear}
                className="cursor-pointer rounded-control text-text underline decoration-line-2 underline-offset-4 hover:decoration-text focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Clear
              </button>
            </span>
          ) : null
        }
        onPage={onPage}
        onPageIntent={(p) => p === "Insights" && studioIntent()}
        className={styles.stage}
        data-step={step}
        data-studio-pick={studioAtPick || undefined}
      >
        {/* 01 and 02: one grid, never re-mounted and never resized; the steps change it through its API. */}
        <div data-on={state.body === "claims" || undefined} className={clsx(styles.body, "flex flex-col")}>
          <div inert className="px-5">
            <TourLedger rows={queue} unitsSold={unitsSold} />
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-4 border-b border-line px-5">
              <StatusFilter counts={counts} value={status} onChange={onStatus} />
              <Toolbar />
            </div>
            <div ref={gridGate} {...gate("grid")} data-quiet={!tips || undefined} data-fresh={fresh ?? undefined} className={clsx(styles.gate, "min-h-0 flex-1")}>
              <ClaimsGridPreviewLazy
                bare
                from={1024}
                rows={rows}
                height={560}
                openId={picked}
                filter={status === "all" ? null : status}
                onRowClick={onRowClick}
                sortEpoch={sortEpoch}
                arrival={arrivalProp}
                live={live}
                onSwap={() => setSwapped(true)}
                interactive={step <= 1}
                // Isolated: nothing inside AG Grid (its pinned columns, header layers) can paint over the evidence panel.
                className="isolate h-full min-w-0"
                fallback={<GridStill rows={still} openId={picked} filter={status === "all" ? null : status} flush />}
              />
            </div>
            {/* The queue's foot, as the console's: it updates itself while a claim comes in. */}
            <p inert aria-hidden="true" className={clsx(styles.foot, "text-ui text-muted")}>
              <span className="size-1.5 shrink-0 rounded-full bg-pay" />
              {TOUR.toolbar.live}
            </p>
            {/* The evidence docks as the console's panel: flush to the window's right edge from the status row to the
                foot, over the grid's right-hand columns (the money ones it repeats), so the grid keeps its width and its
                columns as the claim opens. */}
            {dock && evidence && (
              <div
                inert
                data-out={dockOut || undefined}
                style={dockW ? { width: dockW } : undefined}
                className={clsx(styles.dock, "absolute top-0 right-0 bottom-0 z-10 w-[400px] max-xl:top-[45px] max-xl:w-[380px]")}
              >
                <EvidenceStill
                  claim={evidence}
                  note={<PayoutsNote amount={evidence.amount} id={evidence.id} />}
                  className="w-full! rounded-none! bg-transparent! shadow-none!"
                />
              </div>
            )}
          </div>
        </div>

        {/* Insights: the still until Studio has drawn, then real Studio over it, live (hover a bar, pick a reason). */}
        <div
          ref={insightsBody}
          inert={studioState !== "shown"}
          data-on={state.body === "insights" || undefined}
          data-studio-shown={studioState === "shown" || undefined}
          className={styles.body}
        >
          {insights}
          {studio && (studioState === "mounted" || studioState === "shown") && (
            <div data-studio data-on={studioState === "shown" || undefined} className={clsx(styles.studio, "absolute inset-0 overflow-hidden bg-bg")}>
              <InsightsPreviewLazy
                data={studio.data}
                rows={studioRows}
                active={step === 2}
                onDisplayed={() => setStudioState((s) => (s === "mounted" ? "shown" : s))}
                onFilter={setStudioFilter}
              />
            </div>
          )}
        </div>

        {/* The draft reads like a document in a viewer: its pages scroll inside the frame. */}
        <div
          ref={reportEl}
          {...gate("report")}
          // A scroller a keyboard can reach, so its pages scroll with the arrow keys too.
          tabIndex={0}
          onScroll={(e) => e.currentTarget.toggleAttribute("data-scrolled", e.currentTarget.scrollTop > 0)}
          aria-label="CPSC progress report draft"
          data-on={state.body === "report" || undefined}
          className={clsx(styles.body, styles.reportBody)}
        >
          <div className={clsx(styles.draftSheet, "px-12 pt-8 pb-12 xl:px-0")}>{report}</div>
        </div>
      </ConsoleFrame>
    </div>
  );
}
