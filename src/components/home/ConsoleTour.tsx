"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { duration, formatCents, ledgerOf } from "@/app/console/_lib/view";
import type { InsightsData } from "@/app/console/insights/facts";
import type { PreviewRow } from "@/components/console/ClaimsGridPreview";
import { ClaimsGridPreviewLazy } from "@/components/console/ClaimsGridPreviewLazy";
import { EvidenceStill } from "@/components/console/EvidenceStill";
import { formatCount } from "@/components/console/format";
import { GridStill } from "@/components/console/GridStill";
import { TABS, type Tab } from "@/components/console/StatusTabs";
import { InsightsPreviewLazy, loadInsightsPreview, STUDIO_ON_HOME } from "@/components/insights/InsightsPreviewLazy";
import { ConsoleFrame } from "./ConsoleFrame";
import styles from "./home.module.css";
import { PayoutsNote } from "./PayoutsNote";
import { TOUR } from "./tour-copy";
import { nextTab, stateAt, STEPS, type Step } from "./tour-state";

/*
 * The homepage's "For companies" tour (DESIGN.md, Screens §6), laptops only (1024px and up; phones get the stacked
 * story in ConsoleStory.tsx). Four tabs over one fixed console frame, a real view on each step:
 *   01 the claims queue, the real AG Grid on the recall's 40 claims, where the newest paid claim arrives on entering
 *      view (a row insert, then its verdict and payout cells flash as its checks come back). A visitor may scroll it,
 *      sort it and hover its rows;
 *   02 the same grid with RM-8843 selected and its evidence laid over the grid's right-hand columns;
 *   03 Insights: real AG Studio from 1280px (the still stands in while it loads, and below 1280px);
 *   04 the CPSC report draft, the section's one paper object, read by scrolling it.
 * Nothing autoplays except 01's arrival; every other moment plays when its tab is picked. The frame never changes
 * height, and the grid never changes width: no step reflows its columns. tour-state.ts holds what each step shows;
 * reduced motion shows every step's final state at once.
 */

const ENTER = 0.35;
const LEAVE = 0.25;
const OPEN_AFTER = 300;
const ARRIVE = { interim: 600, final: 1500, done: 2600 };
const STUDIO_FROM = 1280;
const STUDIO_WAIT = 6000;
// Studio's canvas rows are 16px, inside its own 20px of padding (about 22px at the foot); that 20px is the frame's own
// 20px inset, so its panels line up with the recall's row above them.
const STUDIO_ROW = 16;
const STUDIO_PAD = 44;

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

/** The status tabs as the console draws them, an echo: their counts follow the arriving claim. */
function TabsEcho({ counts }: { counts: Record<Tab, number> }) {
  return (
    <div className="relative flex">
      {TABS.map((t, i) => (
        <span
          key={t.id}
          className={clsx(
            "relative inline-flex min-h-11 shrink-0 items-center gap-2 px-3 text-ui font-medium whitespace-nowrap first:pl-0",
            i === 0 ? "text-text after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-text first:after:left-0" : "text-muted",
          )}
        >
          {t.label}
          <span className={clsx("text-micro tabular-nums", i === 0 ? "text-muted" : "text-faint")}>{counts[t.id]}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * The ledger over the grid, as the homepage leads with it: the money sent through PayPal and how fast, then the units,
 * then what waits for a person and what was refused. One face for every figure (the sans, its proportional figures:
 * its tabular ones space a stop or a colon like mono), no meter.
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
          <dd className="order-1 text-[20px] leading-7 font-semibold">{value}</dd>
          <dt className="order-2 text-micro text-muted">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function ConsoleTour({ rows, stillRows, sentences, unitsSold, openId, arriveId, descriptions, insights, report, studio }: ConsoleTourProps) {
  const [step, setStep] = useState<Step>(0);
  const [open, setOpen] = useState<string | null>(null);
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

  const frame = useRef<HTMLDivElement>(null);
  const insightsBody = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const timers = useRef<number[]>([]);
  const arriving = useRef<number[]>([]);
  const studioWait = useRef<number[]>([]);
  const played = useRef(false);
  const visible = useRef(false);
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
        visible.current = e.intersectionRatio > 0;
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

  // Real Studio replaces the Insights still at 1280px and up, on intent (hover, focus or pick of tab 03), and never on
  // Save-Data. Its canvas is measured from the frame, so it fills the body with nothing cut off. If it hasn't drawn in
  // 6s, the still stays for the session.
  const studioIntent = () => {
    if (!STUDIO_ON_HOME || !studio || now.current.studioState !== "off") return;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (window.innerWidth < STUDIO_FROM || saveData) return;
    const h = insightsBody.current?.clientHeight ?? 0;
    if (h) setStudioRows(Math.max(30, Math.floor((h - STUDIO_PAD) / STUDIO_ROW)));
    void loadInsightsPreview();
    setStudioState("mounted");
    later(studioWait.current, STUDIO_WAIT, () => setStudioState((s) => (s === "mounted" ? "failed" : s)));
  };

  const go = (next: Step) => {
    const prev = now.current.step;
    if (next === prev) return;
    clear(timers.current);
    const still = reduced();
    setStep(next);
    setPicked(true);
    if (now.current.arrival !== "final") finishArrival();
    if (prev === 1) {
      setOpen(null);
      if (!still) {
        setDockOut(true);
        later(timers.current, 160, () => setDockOut(false));
      }
    }
    if (next === 1) {
      setDockOut(false);
      if (still) setOpen(openId);
      else later(timers.current, OPEN_AFTER, () => setOpen(openId));
    }
    if (next === 2) {
      setStudioAtPick(now.current.studioState === "shown");
      studioIntent();
    }
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const to = nextTab(e.key, step);
    if (to === null) return;
    e.preventDefault();
    go(to);
    tabs.current[to]?.focus();
  };

  const state = stateAt(step, "final", { openId });
  const evidence = useMemo(() => rows.find((r) => r.id === openId)?.evidence ?? null, [rows, openId]);
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
    <div className="flex flex-col gap-8">
      <div role="tablist" aria-label={TOUR.tablist} className={clsx("relative grid grid-cols-4 gap-x-(--col-gap) border-b border-line", styles.rail)}>
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
            <div inert className="mt-1 border-b border-line">
              <TabsEcho counts={counts} />
            </div>
            <div className="min-h-0 flex-1 pt-3">
              <ClaimsGridPreviewLazy
                bare
                from={1024}
                rows={rows}
                height={560}
                openId={open}
                arrival={arrivalProp}
                live={live}
                onSwap={() => {
                  setSwapped(true);
                  if (!visible.current && now.current.step === 0 && !played.current && !reduced()) setArrival("before");
                }}
                swapOnPick={picked}
                interactive={step === 0}
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

        <div ref={insightsBody} inert data-on={state.body === "insights" || undefined} className={styles.body}>
          {insights}
          {studio && (studioState === "mounted" || studioState === "shown") && (
            <div data-studio data-on={studioState === "shown" || undefined} className={clsx(styles.studio, "absolute inset-0 overflow-hidden bg-bg")}>
              <InsightsPreviewLazy data={studio.data} rows={studioRows} onDisplayed={() => setStudioState((s) => (s === "mounted" ? "shown" : s))} />
            </div>
          )}
        </div>

        {/* The draft reads like a document: its pages scroll inside the frame. */}
        <div data-on={state.body === "report" || undefined} className={clsx(styles.body, styles.reportBody)}>
          <div className={clsx(styles.sheet, "px-12 pt-8 pb-12 xl:px-0")}>{report}</div>
        </div>
      </ConsoleFrame>
    </div>
  );
}
