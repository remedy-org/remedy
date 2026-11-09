"use client";

import clsx from "clsx";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { formatCents, ledgerOf } from "@/app/console/_lib/view";
import type { InsightsData } from "@/app/console/insights/facts";
import { payoutWord } from "@/components/console/cells";
import { matchesSearch, type PreviewRow } from "@/components/console/ClaimsGridPreview";
import { ClaimsGridPreviewLazy } from "@/components/console/ClaimsGridPreviewLazy";
import { EvidenceStill } from "@/components/console/EvidenceStill";
import { formatCount } from "@/components/console/format";
import { GridStill } from "@/components/console/GridStill";
import { TABS, type Tab } from "@/components/console/StatusTabs";
import { verdictOf, verdictWord } from "@/components/console/VerdictMark";
import { InsightsPreviewLazy, loadInsightsPreview, STUDIO_ON_HOME, type StudioFilter } from "@/components/insights/InsightsPreviewLazy";
import { homeRowsFor, spokenTime } from "@/components/insights/report";
import { ConsoleFrame } from "./ConsoleFrame";
import styles from "./tour.module.css";
import { ReviewFoot, type ReviewPhase } from "./PayoutsNote";
import { TOUR } from "./tour-copy";
import { nextTab, stateAt, STEPS, type Step } from "./tour-state";

/*
 * The homepage's "For companies" tour (DESIGN.md, Screens §6), laptops only (1024px and up; phones get the stacked
 * story in ConsoleStory.tsx). Four tabs over one fixed console frame, a real view on each step:
 *   01 the claims queue, the real AG Grid on the recall's seven claims, settled whenever it comes into view (the newest
 *      claim paid at the top), where that claim replays its arrival once a visitor has rested on it (a row insert, its
 *      checks filling, then its verdict and payout). The
 *      real grid takes the still's place as soon as it has drawn, so a visitor may search it, filter it by status, sort
 *      it, hover its checks, export it as CSV, and click any claim with photos to open its evidence (step 02);
 *   02 the same grid with a claim selected and its evidence laid over the grid's right-hand columns: a held claim's Pay
 *      and Reject play the decision in the browser (no request), the row, counts and ledger following, and are put
 *      back when the visitor leaves the queue or the section;
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
// How long the page must rest with the frame in view before 01's claim replays its arrival: a visitor who arrives sees
// the queue settled (RM-0442 paid, the ledger counting it), and one who stays sees how it came in.
const DWELL = 1500;
// On 02 the held claim's row is selected at once and its evidence docks a beat later, so the panel reads as the row's.
const OPEN_AFTER = 180;
// In at +600ms, its checks back at +1400ms (the bars fill over 480ms), the verdict at +2000ms.
const ARRIVE = { interim: 600, checked: 1400, final: 2000, done: 3100 };
const STUDIO_FROM = 1024;
// How long the page must have been still before a pointer resting on the report hands it the wheel.
const IDLE = 150;
const STUDIO_WAIT = 8000;
// The still's entrance on a pick (its bars, then the day columns and their figures, tour.module.css): Studio cuts in
// only after it, so the cut never lands on a half-grown chart.
const STILL_ENTRANCE = 1500;
// Studio's canvas rows are 16px, inside 14px of canvas padding and 6px around each panel (InsightsPreview.tsx): its
// cards sit on the frame's 20px inset with 12px between them, where the still draws its own (homeRowsFor).
// The nav's height, and the air the nav jump leaves under it.
const NAV = 64;
const AIR = 16;
// The space between the steps and the frame (the root's gap-4).
const GAP = 16;
// The frame's tallest (tour.module.css .stage), and the least it takes to keep the heading in view with it.
const FRAME_MAX = 680;
const FIT_MIN = 560;

// The grid's header and rows (ClaimsGrid.tsx): the frame's grid area holds whole rows, so no row shows cut at its foot.
const GRID_HEAD = 37;
const GRID_ROW = 52;
// How long paying or rejecting a held claim reads as on its way, as the console's request takes.
const SENDING = 600;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Arrival = "before" | "interim" | "checked" | "final";

export interface ConsoleTourProps {
  /** The grid's rows, all seven (the open claim's carries its evidence), memo-stable: the grid is driven through its API. */
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

/** A held claim as a visitor's decision leaves it, as the console's approve does for its own claims: approved with
 * nothing sent through PayPal (it reads Approved, never Paid), or rejected on review (no amount owed); otherwise as it
 * was. */
function decide(r: PreviewRow, phase: ReviewPhase | undefined): PreviewRow {
  if (phase === "paid") {
    return { ...r, decision: "paid", payoutStatus: null, note: "Approved on review", evidence: r.evidence && { ...r.evidence, decision: "paid", payout: null } };
  }
  if (phase === "rejected") {
    return { ...r, decision: "rejected", note: "Rejected on review", amount: null, cents: null, evidence: r.evidence && { ...r.evidence, decision: "rejected" } };
  }
  return r;
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

/** The status tabs as the console has them, in its words (lib/payoutWords.ts: Paid once PayPal confirmed, Sent, settling
 * before that, Approved with nothing sent): each filters the live grid (AG Grid's own filter, so the rows
 * animate), their counts following the arriving claim, a visitor's decision and the search. */
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
              // Eight tabs and the toolbar share the frame's row: tighter below 1280px, so the search stays inside it at 1024.
              "relative inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-control px-2 text-ui font-medium whitespace-nowrap transition-colors first:pl-0 focus-visible:outline-2 focus-visible:outline-offset-[-4px] xl:px-3",
              on ? "text-text after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-text first:after:left-0 xl:after:inset-x-3" : "text-muted hover:text-text",
            )}
          >
            {t.label}
            <span className={clsx("font-normal", on ? "text-muted" : "text-faint")}>
              <Roll value={String(counts[t.id])} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The claims as the console's Export CSV writes them, built in the browser from the rows on screen. */
function csvOf(rows: PreviewRow[]) {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const head = ["Claim", "Filed (UTC)", "Verdict", "Reason", "Payout", "Amount (USD)"];
  const body = rows.map((r) => [r.id, r.createdAt, verdictWord(verdictOf(r)), r.note ?? "", payoutWord(r) ?? "", r.cents === null ? "" : (r.cents / 100).toFixed(2)]);
  return [head, ...body].map((line) => line.map(cell).join(",")).join("\n");
}

/** The queue toolbar's right end as the console has it (ClaimsQueue.tsx): Export CSV, which downloads the claims shown,
 * and the search box, which filters the grid as a visitor types (/ puts the caret in it while the frame is in hand). */
function Toolbar({ search, onSearch, onExport, input }: { search: string; onSearch: (q: string) => void; onExport: () => void; input: RefObject<HTMLInputElement | null> }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-3">
      <button
        type="button"
        onClick={onExport}
        className="inline-flex min-h-9 cursor-pointer items-center rounded-control px-1.5 text-ui whitespace-nowrap text-muted transition-colors duration-160 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {TOUR.toolbar.export}
      </button>
      <span className="relative flex h-9 w-36 items-center xl:w-60">
        <input
          ref={input}
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && search) {
              e.preventDefault();
              onSearch("");
            }
          }}
          aria-label="Search claims"
          placeholder={TOUR.toolbar.search}
          spellCheck={false}
          autoComplete="off"
          className="peer h-9 w-full rounded-control border border-line-strong bg-surface pr-9 pl-3 text-ui text-text placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-line-strong/60 font-mono text-micro text-faint peer-focus:hidden peer-[:not(:placeholder-shown)]:hidden"
        >
          /
        </kbd>
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
    ...(l.medianToPay === null ? [] : ([[spokenTime(Math.round(l.medianToPay)), "median photo to payout"]] as [string, string][])),
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
  const rowCount = rows.length;
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
  // The toolbar's search, and what a visitor has done with each held claim's review (played in the browser alone).
  const [search, setSearch] = useState("");
  const [review, setReview] = useState<Record<string, ReviewPhase>>({});
  const searchInput = useRef<HTMLInputElement>(null);

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
  const pickedAt = useRef(0);
  // When Insights was picked, for the cut to Studio (STILL_ENTRANCE).
  useEffect(() => {
    if (step === 2) pickedAt.current = performance.now();
  }, [step]);
  const gridGate = useRef<HTMLDivElement>(null);
  const reportEl = useRef<HTMLDivElement>(null);
  const now = useRef({ step, swapped, arrival, studioState, engaged });
  useEffect(() => {
    now.current = { step, swapped, arrival, studioState, engaged };
  }, [step, swapped, arrival, studioState, engaged]);

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

  /** How much of the frame is in view, read from the layout now (an observer only reports when a threshold is crossed). */
  const inView = () => {
    const r = frame.current?.getBoundingClientRect();
    if (!r || !r.height) return 0;
    return Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)) / r.height;
  };

  // 01's arrival, the one moment that plays without a click: the queue is settled whenever the frame comes into view
  // (RM-0442 paid, the ledger counting it), and replays how the claim came in only once the page has rested on it
  // (DWELL), with the real grid in. Once the frame has left view, the queue is settled again and another rest replays it;
  // picking 01 again simply shows the queue.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    let dwell = 0;
    const wait = () => {
      window.clearTimeout(dwell);
      dwell = window.setTimeout(() => {
        const { step, swapped, arrival } = now.current;
        if (played.current || step !== 0 || arrival !== "final" || reduced() || inView() < ENTER) return;
        // The real grid isn't in yet: the arrival waits for it (it inserts the row through the grid's API).
        if (!swapped) return wait();
        played.current = true;
        playArrival();
      }, DWELL);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= ENTER && !played.current) wait();
        if (e.intersectionRatio === 0) {
          window.clearTimeout(dwell);
          dwell = 0;
          // Out of sight, the queue is put back as it was: a claim a visitor paid or rejected is held again, an arrival
          // half played is finished, and the next rest on it replays the arrival.
          setReview((r) => (Object.keys(r).length ? {} : r));
          if (now.current.step === 0) {
            finishArrival();
            played.current = false;
          }
        }
      },
      { threshold: [0, ENTER] },
    );
    // A scroll restarts the wait: the arrival plays for a page at rest, never under a fling passing through.
    const onScroll = () => {
      if (!played.current && dwell) wait();
    };
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(dwell);
    };
  }, [playArrival, finishArrival]);

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
    // AG Grid scrolls the queue itself from a wheel over its header (the header rides in its sticky top rows), before
    // the page's scroll ever sees the event: a fling that landed on this section with the pointer over the header ran
    // its momentum into the list. Until a visitor has engaged the grid, a wheel over it goes to the page alone, handed
    // on as the page's own (SmoothScroll.tsx: only while it runs, so the page always scrolls).
    const toPage = (e: WheelEvent) => {
      if (now.current.engaged === "grid" || !document.documentElement.classList.contains("lenis")) return;
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      const { deltaX, deltaY, deltaZ, deltaMode, clientX, clientY, screenX, screenY, ctrlKey, shiftKey, altKey, metaKey } = e;
      const own = new WheelEvent("wheel", { deltaX, deltaY, deltaZ, deltaMode, clientX, clientY, screenX, screenY, ctrlKey, shiftKey, altKey, metaKey, bubbles: true, cancelable: true });
      // The input's own time, so the gate paces the gesture as the hand made it, not as the page got to it.
      Object.defineProperty(own, "timeStamp", { value: e.timeStamp });
      window.dispatchEvent(own);
    };
    grid.addEventListener("wheel", toPage, { capture: true, passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      off.forEach((f) => f());
      grid.removeEventListener("wheel", toPage, { capture: true });
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(idle);
    };
  }, []);

  // Real Studio replaces the Insights still at 1024px and up, on intent (hover, focus or pick of tab 03, or of the app
  // bar's Insights), and never on Save-Data: a visitor who only scrolls past never loads it (nor its licence notice in
  // the console). Its canvas is measured from the frame, so it fills the body with nothing cut off. If it hasn't drawn
  // in 8s, the still stays for the session.
  const studioIntent = () => {
    if (!STUDIO_ON_HOME || !studio || now.current.studioState !== "off") return;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (window.innerWidth < STUDIO_FROM || saveData) return;
    const h = insightsBody.current?.clientHeight ?? 0;
    if (h) setStudioRows(homeRowsFor(h));
    void loadInsightsPreview();
    setStudioState("mounted");
    later(studioWait.current, STUDIO_WAIT, () => setStudioState((s) => (s === "mounted" ? "failed" : s)));
  };

  // The frame fits under the steps on a laptop screen (tour.module.css .stage reads the steps row's height), and is
  // never taller than the queue's rows: a tall screen gets a window as tall as its claims, never a half-empty table. The
  // nav's "For companies" jump lands so a visitor sees the whole frame: from the heading when it all fits, else from the
  // steps.
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
      // The grid area holds whole rows, and no more rows than the queue has: the frame gives up what would show of a row
      // cut at its foot, and the slots under its last claim.
      const grid = gridGate.current;
      if (grid && frame.current) {
        const slots = Math.min(rowCount, Math.floor((grid.clientHeight - GRID_HEAD) / GRID_ROW));
        const extra = grid.clientHeight - GRID_HEAD - slots * GRID_ROW;
        if (extra > 0) frame.current.style.setProperty("--frame-h", `${Math.floor(frame.current.getBoundingClientRect().height - extra)}px`);
      }
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
  }, [rowCount]);

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
    // Leaving the queue puts it back as it was: every claim, in the order it came in, scrolled to the top (BareGrid),
    // unsearched, and a claim a visitor paid or rejected held again.
    if (next >= 2) {
      setStatus("all");
      setSearch("");
      setReview({});
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
      // The open claim is always in the rows shown: the tab stays where it holds the claim.
      const decision = shownRows.current.find((r) => r.id === id)?.decision;
      setStatus((t) => (t === "all" || t === decision ? t : "all"));
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

  /** A click on a row: a claim with photos opens its evidence (step 02), or swaps the one open. */
  const onRowClick = (row: PreviewRow) => {
    if (!row.evidence) return;
    if (now.current.step === 1) {
      setClaim(row.id);
      setPicked(row.id);
      setOpen(row.id);
    } else go(1, row.id);
  };

  /** A held claim's review, a step on: paying and rejecting read as on their way for a moment, then land. */
  const onReview = (id: string, phase: ReviewPhase) => {
    setReview((r) => ({ ...r, [id]: phase }));
    const done = phase === "paying" ? "paid" : phase === "rejecting" ? "rejected" : null;
    if (done) later(timers.current, reduced() ? 0 : SENDING, () => setReview((r) => (r[id] === phase ? { ...r, [id]: done } : r)));
  };

  const onExport = () => {
    const url = URL.createObjectURL(new Blob([csvOf(shownRows.current)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "remedy-claims-27-071.csv" });
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

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
  // The rows with a visitor's decisions on them: a held claim approved reads Approved (nothing sent), one rejected Rejected.
  const decided = useMemo(() => rows.map((r) => decide(r, review[r.id])), [rows, review]);
  const shownRows = useRef(decided);
  useEffect(() => {
    shownRows.current = decided;
  }, [decided]);
  const evidence = useMemo(() => decided.find((r) => r.id === claim)?.evidence ?? null, [decided, claim]);
  const arrivalProp = useMemo(() => ({ id: arriveId, phase: arrival }), [arriveId, arrival]);
  // The ledger, the tab counts and the still follow the claim as it arrives; the counts follow the search too.
  const queue = useMemo(() => rowsAt(decided, arriveId, arrival), [decided, arriveId, arrival]);
  const found = useMemo(() => (search.trim() ? queue.filter((r) => matchesSearch(r, search)) : queue), [queue, search]);
  const still = useMemo(() => found.slice(0, stillRows), [found, stillRows]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(TABS.map((t) => [t.id, 0])) as Record<Tab, number>;
    c.all = found.length;
    for (const r of found) c[verdictOf(r)]++;
    return c;
  }, [found]);

  // "/" puts the caret in the search while the frame is in hand (the pointer over it, or focus in it), as the console's
  // does; a field or a key with a modifier keeps its own.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || now.current.step > 1) return;
      const el = frame.current;
      const t = e.target instanceof Element ? e.target : null;
      if (!el || t?.closest("input, textarea, select, [contenteditable]")) return;
      if (!el.matches(":hover") && !el.contains(document.activeElement)) return;
      e.preventDefault();
      searchInput.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const dock = open !== null || dockOut;
  // The checks popover: on the queue alone (not under the evidence), never during the arrival, and only for a pointer
  // that has moved since.
  const tips = step === 0 && arrival === "final" && !live && pointed;
  const filtered = step === 2 && studioState === "shown" && studioFilter;

  return (
    <div ref={root} className="flex flex-col gap-4">
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
              <Toolbar
                search={search}
                onSearch={(q) => {
                  settleArrival();
                  setPointed(false);
                  setSearch(q);
                }}
                onExport={onExport}
                input={searchInput}
              />
            </div>
            <div ref={gridGate} {...gate("grid")} data-quiet={!tips || undefined} data-fresh={fresh ?? undefined} className={clsx(styles.gate, "min-h-0 flex-1")}>
              <ClaimsGridPreviewLazy
                bare
                from={1024}
                rows={decided}
                height={560}
                openId={picked}
                filter={status === "all" ? null : status}
                search={search}
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
            {/* The queue's foot, as the console's: updated just now, as the claim that has just arrived says. */}
            <p inert aria-hidden="true" className={clsx(styles.foot, "text-ui text-muted")}>
              {found.length ? TOUR.toolbar.live : TOUR.toolbar.none}
            </p>
            {/* The evidence docks as the console's panel: flush to the window's right edge from the status row to the
                foot, over the grid's right-hand columns (the money ones it repeats), so the grid keeps its width and its
                columns as the claim opens. */}
            {dock && evidence && (
              <div
                data-out={dockOut || undefined}
                style={dockW ? { width: dockW } : undefined}
                className={clsx(styles.dock, "absolute top-0 right-0 bottom-0 z-10 w-[400px] max-xl:top-[45px] max-xl:w-[380px]")}
              >
                <EvidenceStill
                  claim={evidence}
                  note={<ReviewFoot key={evidence.id} claim={evidence} phase={review[evidence.id] ?? "idle"} onPhase={(p) => onReview(evidence.id, p)} />}
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
                onDisplayed={() => {
                  // A cut, once the still has finished coming in (STILL_ENTRANCE) if it is the step on screen.
                  const wait = now.current.step === 2 ? STILL_ENTRANCE - (performance.now() - pickedAt.current) : 0;
                  later(studioWait.current, Math.max(0, wait), () => setStudioState((s) => (s === "mounted" ? "shown" : s)));
                }}
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
