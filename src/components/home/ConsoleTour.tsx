"use client";

import clsx from "clsx";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { duration, formatCents, ledgerOf } from "@/app/console/_lib/view";
import type { InsightsData } from "@/app/console/insights/facts";
import type { PreviewRow } from "@/components/console/ClaimsGridPreview";
import { ClaimsGridPreviewLazy } from "@/components/console/ClaimsGridPreviewLazy";
import { EvidenceStill } from "@/components/console/EvidenceStill";
import { formatCount } from "@/components/console/format";
import { GridStill } from "@/components/console/GridStill";
import { TABS, type Tab } from "@/components/console/StatusTabs";
import { InsightsPreviewLazy, loadInsightsPreview, STUDIO_ON_HOME } from "@/components/insights/InsightsPreviewLazy";
import { ConsoleFrame, type FramePage } from "./ConsoleFrame";
import styles from "./home.module.css";
import { PayoutsNote } from "./PayoutsNote";
import { TOUR } from "./tour-copy";
import { nextTab, stateAt, STEPS, type Step } from "./tour-state";

/*
 * The homepage's "For companies" tour (DESIGN.md, Screens §6), laptops only (1024px and up; phones get the stacked
 * story in ConsoleStory.tsx). Four tabs over one fixed console frame, a real view on each step:
 *   01 the claims queue, the real AG Grid on the recall's 40 claims, where the newest paid claim arrives on entering
 *      view (a row insert, then its verdict and payout cells flash as its checks come back). A visitor may filter it by
 *      status, sort it, hover its checks, and click a held claim to open its evidence (step 02);
 *   02 the same grid with a held claim selected and its evidence laid over the grid's right-hand columns;
 *   03 Insights: real AG Studio from 1280px, drawn out of sight as the frame comes near so it is there when picked (the
 *      still stands in until then, and below 1280px). A visitor may hover its charts and cross-filter it;
 *   04 the CPSC report draft, the section's one paper object, read by scrolling it.
 * The grid and the report scroll inside the frame only once a visitor has clicked or focused them: a wheel passing over
 * the frame keeps moving the page.
 * Nothing autoplays except 01's arrival; every other moment plays when its tab is picked. The frame never changes
 * height, and the grid never changes width: no step reflows its columns. tour-state.ts holds what each step shows;
 * reduced motion shows every step's final state at once.
 */

const ENTER = 0.35;
const LEAVE = 0.25;
const OPEN_AFTER = 300;
const ARRIVE = { interim: 600, final: 1500, done: 2600 };
const STUDIO_FROM = 1280;
const STUDIO_WAIT = 8000;
// Studio's canvas rows are 16px, inside 14px of canvas padding and 6px around each panel (InsightsPreview.tsx): its
// cards sit on the frame's 20px inset with 12px between them, where the still draws its own.
const STUDIO_ROW = 16;
const STUDIO_PAD = 28;
// The nav's height, and the air the nav jump leaves under it.
const NAV = 64;
const AIR = 16;

const PAGE = { claims: "Claims", insights: "Insights", report: "Report" } as const;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Arrival = "before" | "interim" | "final";

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
    ...(l.medianToPay === null ? [] : ([[duration(Math.round(l.medianToPay)), "median, photo to PayPal"]] as [string, string][])),
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
  // The visitor has picked a step: from then on the real grid may take the still's place in view (a 160ms fade
  // riding on the change they asked for), so a visitor who landed on the section still gets the live grid.
  const [picked, setPicked] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const insightsBody = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const timers = useRef<number[]>([]);
  const arriving = useRef<number[]>([]);
  const studioWait = useRef<number[]>([]);
  const played = useRef(false);
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
    later(arriving.current, ARRIVE.interim, () => {
      setArrival("interim");
      setLive(true);
    });
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

  // Real Studio replaces the Insights still at 1280px and up, on intent (hover, focus or pick of tab 03), and never on
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
      el.style.setProperty("--rail-h", `${Math.round(tabsRow.getBoundingClientRect().height)}px`);
      const top = section.getBoundingClientRect().top;
      const head = (section.querySelector("h2")?.getBoundingClientRect().top ?? top) - top;
      const tabs = tabsRow.getBoundingClientRect().top - top;
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
    setPicked(true);
    setEngaged(null);
    if (now.current.arrival !== "final") finishArrival();
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
    setStatus(t);
  };

  /** The wheel moves an inner scroller only once a visitor has clicked or focused it; leaving it hands the wheel back. */
  const gate = (area: "grid" | "report") => ({
    "data-engaged": engaged === area || undefined,
    onPointerDown: () => setEngaged(area),
    onFocus: () => setEngaged(area),
    onPointerLeave: () => setEngaged((e) => (e === area ? null : e)),
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
  const still = useMemo(() => rows.slice(0, stillRows), [rows, stillRows]);
  const arrivalProp = useMemo(() => ({ id: arriveId, phase: arrival }), [arriveId, arrival]);
  // The ledger and the tab counts follow the claim as it arrives (only once the real grid is there to show it).
  const queue = useMemo(() => rowsAt(rows, arriveId, swapped ? arrival : "final"), [rows, arriveId, swapped, arrival]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(TABS.map((t) => [t.id, 0])) as Record<Tab, number>;
    c.all = queue.length;
    for (const r of queue) c[r.decision]++;
    return c;
  }, [queue]);
  const dock = open !== null || dockOut;

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
              <span id={`tour-tab-${i}-sentence`} className={clsx("min-h-[4.35em] text-ui text-pretty transition-colors", active ? "text-text-2" : "text-muted group-hover:text-text-2")}>
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
        credit={TOUR.credit[step]}
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
            <div {...gate("grid")} className={clsx(styles.gate, "min-h-0 flex-1 pt-3")}>
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
                onSwap={() => {
                  setSwapped(true);
                  // Read from the layout, not the observer's last report: it may predate the frame coming into view.
                  if (inView() < ENTER && now.current.step === 0 && !played.current && !reduced()) setArrival("before");
                }}
                swapOnPick={picked}
                interactive={step <= 1}
                // Isolated: nothing inside AG Grid (its pinned columns, header layers) can paint over the evidence sheet.
                className="isolate h-full min-w-0"
                fallback={<GridStill rows={still} openId={open} />}
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
              <InsightsPreviewLazy data={studio.data} rows={studioRows} active={step === 2} onDisplayed={() => setStudioState((s) => (s === "mounted" ? "shown" : s))} />
            </div>
          )}
        </div>

        {/* The draft reads like a document: its pages scroll inside the frame. */}
        <div
          {...gate("report")}
          // A scroller a keyboard can reach, so its pages scroll with the arrow keys too.
          tabIndex={0}
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
