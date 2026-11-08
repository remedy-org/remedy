"use client";

import clsx from "clsx";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
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
import styles from "./home.module.css";
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
 *   03 Insights: real AG Studio, drawn out of sight as the frame comes near so it is there when picked (the still
 *      stands in until then). A visitor may hover its charts and cross-filter it, and clear the filter from the frame;
 *   04 the CPSC report draft, the section's one paper object, read by scrolling it.
 * The grid scrolls inside the frame only once a visitor has clicked or focused it, the report also once the pointer
 * rests on it with the page still: a wheel passing over the frame keeps moving the page.
 * Nothing autoplays except 01's arrival; every other moment plays when its tab is picked. The frame never changes
 * height, and the grid never changes width: no step reflows its columns. tour-state.ts holds what each step shows;
 * reduced motion shows every step's final state at once.
 */

const ENTER = 0.35;
const LEAVE = 0.25;
const OPEN_AFTER = 300;
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
// The frame's tallest (home.module.css .stage), and the least it takes to keep the heading in view with it.
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

/** The status tabs as the console has them: each filters the live grid (AG Grid's own filter, so the rows animate),
 * their counts following the arriving claim. */
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
              "relative inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-control px-3 text-ui font-medium whitespace-nowrap transition-colors first:pl-0 focus-visible:outline-2 focus-visible:outline-offset-[-4px]",
              on ? "text-text after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-text first:after:left-0" : "text-muted hover:text-text",
            )}
          >
            {t.label}
            <span className={clsx("text-micro tabular-nums", on ? "text-muted" : "text-faint")}>{counts[t.id]}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The ledger over the grid, as the homepage leads with it: the money sent through PayPal and how fast, then the units,
 * then what waits for a person and what was refused. Its figures are set as every figure in the section is (Insights'
 * tiles, the report's): the sans at regular weight, its proportional figures (its tabular ones space a stop or a colon
 * like mono). No meter.
 */
function TourLedger({ rows, unitsSold }: { rows: PreviewRow[]; unitsSold: number }) {
  const l = ledgerOf(rows, { unitsSold });
  const items: [string, string][] = [
    [formatCents(l.paidCents), "paid through PayPal"],
    ...(l.medianToPay === null ? [] : ([[spokenTime(Math.round(l.medianToPay)), "median, photo to PayPal"]] as [string, string][])),
    [formatCount(l.remedied), `of ${formatCount(unitsSold)} units remedied`],
    [formatCount(l.held), "held for a person"],
    [formatCount(l.refused), "refused"],
  ];
  return (
    <dl className="flex min-h-12 items-center gap-x-7 overflow-hidden border-y border-line py-2.5 whitespace-nowrap max-xl:gap-x-5">
      {items.map(([value, label]) => (
        <div key={label} className="flex items-baseline gap-2">
          <dd className="order-1 text-[22px] leading-7">{value}</dd>
          <dt className="order-2 text-micro text-muted">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function ConsoleTour({ rows, stillRows, sentences, unitsSold, openId, arriveId, descriptions, insights, report, studio }: ConsoleTourProps) {
  const [step, setStep] = useState<Step>(0);
  const [open, setOpen] = useState<string | null>(null);
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
  // Studio's cross-filter, said in the frame's title row with a way out.
  const [studioFilter, setStudioFilter] = useState<StudioFilter | null>(null);

  const root = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
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
    });
    later(arriving.current, ARRIVE.checked, () => setArrival("checked"));
    later(arriving.current, ARRIVE.final, () => setArrival("final"));
    later(arriving.current, ARRIVE.done, () => setLive(false));
  }, []);

  /** Straight to the final state, so it never animates where no one sees it, or when a visitor has moved on. */
  const finishArrival = useCallback(() => {
    clear(arriving.current);
    setArrival("final");
    setLive(false);
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

  // Real Studio replaces the Insights still at 1024px and up (wherever the frame credits it), on intent (hover, focus or pick of tab 03), and never on
  // Save-Data. Its canvas is measured from the frame, so it fills the body with nothing cut off. If it hasn't drawn in
  // 6s, the still stays for the session.
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
  const intent = useRef(studioIntent);
  useEffect(() => {
    intent.current = studioIntent;
  });

  // Studio draws out of sight once the frame is a viewport away (the page's first load never carries it), so picking
  // Insights shows the real dashboard at once, with no still giving way to it.
  useEffect(() => {
    const el = frame.current;
    if (!el || !STUDIO_ON_HOME || !studio) return;
    let wait = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        // After the page's own work settles: a short wait, then the next idle moment.
        wait = window.setTimeout(() => (window.requestIdleCallback ?? ((f: () => void) => f()))(() => intent.current()), 300);
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(wait);
    };
  }, [studio]);

  // The frame fits under the rail on a laptop screen (home.module.css .stage reads the rail's height), and the nav's
  // "For companies" jump lands so a visitor sees the whole frame: from the heading when it all fits, else from the tabs.
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
      const withHead = window.innerHeight - NAV - AIR - (tabs - head) - railH - 24 - AIR;
      if (withHead >= FIT_MIN && withHead < FRAME_MAX) frame.current?.style.setProperty("--frame-h", `${Math.floor(withHead)}px`);
      else frame.current?.style.removeProperty("--frame-h");
      const bottom = (frame.current?.getBoundingClientRect().bottom ?? 0) - top;
      const from = bottom - head + AIR <= window.innerHeight - NAV ? head : tabs;
      section.style.scrollMarginTop = `${NAV + AIR - from}px`;
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
      if (!still) {
        setDockOut(true);
        later(timers.current, 160, () => setDockOut(false));
      }
    }
    // Leaving the queue puts it back as it was: every claim, in the order it came in.
    if (next >= 2) {
      setStatus("all");
      setSortEpoch((n) => n + 1);
    }
    if (next === 1) {
      setDockOut(false);
      setClaim(id);
      // The open claim is always in the rows shown.
      setStatus((t) => (t === "all" || t === "held" ? t : "all"));
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
      setOpen(row.id);
    } else go(1, row.id);
  };

  const onPage = (p: FramePage) => go(p === "Insights" ? 2 : p === "Report" ? 3 : now.current.step === 1 ? 1 : 0);

  const onStatus = (t: Tab) => {
    if (now.current.step === 1) go(0);
    settleArrival();
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
    <div ref={root} className="flex flex-col gap-6">
      <div ref={rail} role="tablist" aria-label={TOUR.tablist} className={clsx("relative grid grid-cols-4 gap-x-(--col-gap) border-b border-line", styles.rail)}>
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
              aria-labelledby={`tour-tab-${i}-name`}
              aria-describedby={`tour-tab-${i}-sentence`}
              tabIndex={active ? 0 : -1}
              onClick={() => go(STEPS[i])}
              onKeyDown={onKey}
              onPointerEnter={i === 2 ? studioIntent : undefined}
              onFocus={i === 2 ? studioIntent : undefined}
              className={clsx(styles.tab, "group relative flex cursor-pointer flex-col items-start gap-1.5 rounded-control pb-5 text-left")}
            >
              <span id={`tour-tab-${i}-name`} className={clsx("text-body font-medium transition-colors", active ? "text-text" : "text-muted group-hover:text-text")}>
                {s.name}
              </span>
              <span id={`tour-tab-${i}-sentence`} className={clsx("min-h-[2.9em] text-ui text-pretty transition-colors", active ? "text-text-2" : "text-muted group-hover:text-text-2")}>
                {sentences[i]}
              </span>
            </button>
          );
        })}
        <span aria-hidden="true" className={styles.railBar} style={{ "--i": step } as CSSProperties} />
      </div>

      <ConsoleFrame
        ref={frame}
        id="tour-panel"
        role="tabpanel"
        aria-labelledby={`tour-tab-${step}-name`}
        tabIndex={0}
        page={PAGE[state.page]}
        description={descriptions[step]}
        credit={
          filtered ? (
            <span className="flex items-baseline gap-3">
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
          ) : (
            TOUR.credit[step]
          )
        }
        onPage={onPage}
        className={styles.stage}
        data-step={step}
        data-studio-pick={studioAtPick || undefined}
      >
        {/* 01 and 02: one grid, never re-mounted and never resized; the steps change it through its API. */}
        <div data-on={state.body === "claims" || undefined} className={clsx(styles.body, "flex flex-col px-5 pb-3")}>
          <div inert className="mt-2">
            <TourLedger rows={queue} unitsSold={unitsSold} />
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="mt-1 border-b border-line">
              <StatusFilter counts={counts} value={status} onChange={onStatus} />
            </div>
            <div ref={gridGate} {...gate("grid")} data-quiet={!tips || undefined} className={clsx(styles.gate, "min-h-0 flex-1 pt-3")}>
              <ClaimsGridPreviewLazy
                bare
                from={1024}
                rows={rows}
                height={560}
                openId={open}
                filter={status === "all" ? null : status}
                onRowClick={onRowClick}
                sortEpoch={sortEpoch}
                arrival={arrivalProp}
                live={live}
                onSwap={() => setSwapped(true)}
                interactive={step <= 1}
                // Isolated: nothing inside AG Grid (its pinned columns, header layers) can paint over the evidence sheet.
                className="isolate h-full min-w-0"
                fallback={<GridStill rows={still} openId={open} filter={status === "all" ? null : status} />}
              />
            </div>
            {/* The evidence lies over the grid's right-hand columns (the money ones it repeats), from the tabs to the
                frame's foot, so the grid keeps its width and its columns as the claim opens. */}
            {dock && evidence && (
              <div inert data-out={dockOut || undefined} className={clsx(styles.dock, "absolute top-0 right-0 bottom-0 z-10 w-[380px] max-xl:top-[49px]")}>
                <EvidenceStill claim={evidence} note={<PayoutsNote amount={evidence.amount} id={evidence.id} />} />
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

        {/* The draft reads like a document: its pages scroll inside the frame. */}
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
          <div className={clsx(styles.sheet, "px-12 pt-8 pb-12 xl:px-0")}>{report}</div>
        </div>
      </ConsoleFrame>
    </div>
  );
}
