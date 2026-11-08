"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { Ledger as LedgerData } from "@/app/console/_lib/view";
import type { InsightsData } from "@/app/console/insights/facts";
import type { PreviewRow } from "@/components/console/ClaimsGridPreview";
import { ClaimsGridPreviewLazy } from "@/components/console/ClaimsGridPreviewLazy";
import { EvidenceStill } from "@/components/console/EvidenceStill";
import { Ledger } from "@/components/console/Ledger";
import { TABS, type Tab } from "@/components/console/StatusTabs";
import { InsightsPreviewLazy, loadInsightsPreview, STUDIO_ON_HOME } from "@/components/insights/InsightsPreviewLazy";
import { ConsoleFrame, useSlider } from "./ConsoleFrame";
import { ReplicaTable, type PreviewRow as ReplicaRow } from "./ConsoleReplica";
import { CREDIT } from "./credits";
import styles from "./home.module.css";
import { payoutsLine, TOUR } from "./tour-copy";
import { nextTab, stateAt, STEPS, type Step } from "./tour-state";

/*
 * The homepage's "For companies" tour (DESIGN.md, Screens §6), laptops only (1024px and up; phones get the stacked
 * story in ConsoleStory.tsx). Four tabs over one fixed console frame, a real view on each step:
 *   01 the claims queue, the real AG Grid on the 40 sample claims, where the newest paid claim arrives once on entering
 *      view (a row insert, then its verdict and payout cells flash as its checks come back);
 *   02 the same grid filtered to Held, with RM-9629's evidence docked;
 *   03 Insights: the still (or real AG Studio, on intent, with a production licence) with the recall analyst's answer;
 *   04 the CPSC report draft, the section's one paper object.
 * Nothing autoplays except 01's arrival; every other moment plays when its tab is picked. The frame never changes
 * height. tour-state.ts holds what each step shows; reduced motion shows every step's final state at once.
 */

const ENTER = 0.35;
const LEAVE = 0.25;
const OPEN_AFTER = 450;
const ARRIVE = { interim: 600, final: 1500, done: 2600 };
const STUDIO_FROM = 1280;
const STUDIO_WAIT = 4000;

const PAGE = { claims: "Claims", insights: "Insights", report: "Report" } as const;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface ConsoleTourProps {
  /** The grid's rows (the open claim's carries its evidence), memo-stable: the grid is driven through its API. */
  rows: PreviewRow[];
  /** The same rows in the static replica's form, for the still before the grid loads. */
  replica: ReplicaRow[];
  ledger: LedgerData;
  counts: Record<Tab, number>;
  openId: string;
  arriveId: string;
  /** Each step's screen-reader description, written from the seed (tour-copy.ts describe()). */
  descriptions: string[];
  /** Step 03's still and step 04's sheet, rendered on the server. */
  insights: ReactNode;
  report: ReactNode;
  /** Real Studio's data and canvas height in 16px rows, only when STUDIO_ON_HOME. */
  studio?: { data: InsightsData; rows: number } | null;
}

/** The status tabs as the console draws them, an echo: All and Held change as the steps do, the underline glides. */
function TabsEcho({ value, counts }: { value: Tab; counts: Record<Tab, number> }) {
  const { row, bar } = useSlider<HTMLDivElement>(TABS.findIndex((t) => t.id === value));
  return (
    <div ref={row} className={clsx("relative flex", styles.slideRow)}>
      {TABS.map((t) => {
        const active = t.id === value;
        return (
          <span
            key={t.id}
            data-slide
            data-on={active || undefined}
            className={clsx("relative inline-flex min-h-11 shrink-0 items-center gap-2 px-3 text-ui font-medium whitespace-nowrap first:pl-0", styles.chromePage, active ? "text-text" : "text-muted")}
          >
            {t.label}
            <span className={clsx("font-mono text-micro tabular-nums", active ? "text-muted" : "text-faint")}>{counts[t.id]}</span>
          </span>
        );
      })}
      <span ref={bar} className={clsx(styles.slider, "bottom-0 h-0.5")} />
    </div>
  );
}

export function ConsoleTour({ rows, replica, ledger, counts, openId, arriveId, descriptions, insights, report, studio }: ConsoleTourProps) {
  const [step, setStep] = useState<Step>(0);
  const [filter, setFilter] = useState<"held" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [dockOut, setDockOut] = useState(false);
  // The arriving claim is held back only when motion is allowed: otherwise it is in the queue from the start.
  const [arrival, setArrival] = useState<"before" | "interim" | "final">(() => (typeof window === "undefined" || reduced() ? "final" : "before"));
  const [live, setLive] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const [studioState, setStudioState] = useState<"off" | "mounted" | "shown" | "failed">("off");
  const [studioAtPick, setStudioAtPick] = useState(false);

  const frame = useRef<HTMLDivElement>(null);
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

  /** Off screen mid-arrival: straight to the final state, so it never animates where no one sees it. */
  const finishArrival = useCallback(() => {
    clear(arriving.current);
    setArrival("final");
    setLive(false);
  }, []);

  // 01's arrival, the one moment that plays without a click: once per page view, when the real grid is in and the frame
  // is 35% in view.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        const { step, swapped, arrival } = now.current;
        if (e.intersectionRatio >= ENTER && !played.current && step === 0 && swapped && arrival === "before" && !reduced()) {
          played.current = true;
          playArrival();
        } else if (e.intersectionRatio < LEAVE && arriving.current.length && now.current.arrival !== "final") finishArrival();
      },
      { threshold: [0, LEAVE, ENTER] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [playArrival, finishArrival]);

  // Real Studio replaces the Insights still only at 1280px and up, on intent (hover, focus or pick of tab 03), with a
  // production licence at build, and never on Save-Data. If it hasn't drawn in 4s, the still stays for the session.
  const studioIntent = () => {
    if (!STUDIO_ON_HOME || !studio || now.current.studioState !== "off") return;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (window.innerWidth < STUDIO_FROM || saveData) return;
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
    if (prev === 1) {
      setFilter(null);
      setOpen(null);
      if (!still) {
        setDockOut(true);
        later(timers.current, 160, () => setDockOut(false));
      }
    }
    if (next === 0) {
      // Picking 01 again replays the arrival, once the real grid is in.
      if (!still && now.current.swapped) playArrival();
      else finishArrival();
    } else if (now.current.arrival !== "final") finishArrival();
    if (next === 1) {
      setDockOut(false);
      setFilter("held");
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

  const state = stateAt(step, "final", { openId, studio: studioState === "shown" });
  const evidence = useMemo(() => rows.find((r) => r.id === openId)?.evidence ?? null, [rows, openId]);
  const stillRows = useMemo(() => (filter === "held" ? replica.filter((r) => r.status === "held") : replica), [filter, replica]);
  const arrivalProp = useMemo(() => ({ id: arriveId, phase: arrival }), [arriveId, arrival]);
  const credit = state.credit && CREDIT ? CREDIT[state.credit] : null;
  const dock = open !== null || dockOut;

  return (
    <div className="flex flex-col gap-8">
      <div role="tablist" aria-label={TOUR.tablist} className={clsx("relative grid grid-cols-4 gap-x-(--col-gap) border-b border-line", styles.rail)}>
        {TOUR.steps.map((s, i) => {
          const active = i === step;
          return (
            <button
              key={s.n}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`tour-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="tour-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => go(STEPS[i])}
              onKeyDown={onKey}
              onPointerEnter={i === 2 ? studioIntent : undefined}
              onFocus={i === 2 ? studioIntent : undefined}
              className="group flex flex-col items-start gap-1 rounded-control pb-4 text-left"
            >
              <span className="font-mono text-micro text-faint">{s.n}</span>
              <span className={clsx("text-ui font-medium transition-colors", active ? "text-text" : "text-muted group-hover:text-text")}>{s.name}</span>
              <span className="min-h-[4.35em] text-ui text-pretty text-muted">{s.sentence}</span>
            </button>
          );
        })}
        <span aria-hidden="true" className={styles.railBar} style={{ "--i": step } as CSSProperties} />
      </div>

      <ConsoleFrame
        ref={frame}
        id="tour-panel"
        role="tabpanel"
        aria-labelledby={`tour-tab-${step}`}
        tabIndex={0}
        page={PAGE[state.page]}
        description={descriptions[step]}
        foot={{ left: state.money ? TOUR.money : null, right: credit }}
        className={styles.stage}
        data-step={step}
        data-studio-pick={studioAtPick || undefined}
      >
        {/* 01 and 02: one grid, never re-mounted; the steps change it through its API. */}
        <div data-on={state.body === "claims" || undefined} className={clsx(styles.body, "flex flex-col px-5 pb-3")}>
          <Ledger ledger={ledger} className="mt-2" />
          <div className="mt-1 border-b border-line">
            <TabsEcho value={filter === "held" ? "held" : "all"} counts={counts} />
          </div>
          {/* The evidence docks beside the grid from 1280px and lies over it as a sheet below, as in the console, so the
              grid keeps its columns at 1024. */}
          <div className="relative flex min-h-0 flex-1 gap-3 pt-3">
            <ClaimsGridPreviewLazy
              bare
              from={1024}
              rows={rows}
              height={560}
              filter={filter}
              openId={open}
              arrival={arrivalProp}
              live={live}
              onSwap={() => setSwapped(true)}
              className="h-full min-w-0 flex-1"
              fallback={<ReplicaTable rows={stillRows} openId={open} className="h-full overflow-hidden rounded-card bg-surface" />}
            />
            {dock && evidence && (
              <div data-out={dockOut || undefined} className={clsx(styles.dock, "h-full shrink-0 max-xl:absolute max-xl:top-3 max-xl:h-auto max-xl:right-0 max-xl:bottom-0 max-xl:z-10")}>
                <EvidenceStill claim={evidence} note={payoutsLine(evidence.amount, evidence.id)} quoteClassName={styles.inkUnder} />
              </div>
            )}
          </div>
        </div>

        <div data-on={state.body === "insights" || undefined} className={styles.body}>
          {insights}
          {studio && (studioState === "mounted" || studioState === "shown") && (
            <div data-studio data-on={studioState === "shown" || undefined} className={clsx(styles.studio, "absolute inset-0 bg-bg p-2")}>
              <InsightsPreviewLazy data={studio.data} rows={studio.rows} onDisplayed={() => setStudioState((s) => (s === "mounted" ? "shown" : s))} />
            </div>
          )}
        </div>

        <div data-on={state.body === "report" || undefined} className={clsx(styles.body, styles.reportBody, "bg-surface px-12 pt-8 xl:px-0")}>
          <div className={styles.sheet}>{report}</div>
        </div>
      </ConsoleFrame>
    </div>
  );
}
