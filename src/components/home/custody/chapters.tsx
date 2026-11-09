"use client";

import clsx from "clsx";
import { motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { createContext, useContext, useState, type ComponentType, type ReactNode } from "react";
import type { CustomCellRendererProps } from "ag-grid-react";
import type { ClaimRow } from "@/app/console/_lib/view";
import { AmountCell, ChecksCell, ClaimCell, PayoutCell, TimeCell, VerdictCell } from "@/components/console/cells";
import "@/components/console/claims-grid.css";
import { durationFigure, LedgerItem } from "@/components/console/Ledger";
import { TABS } from "@/components/console/StatusTabs";
import { verdictOf } from "@/components/console/VerdictMark";
import { PAYPAL_CONSENT } from "@/components/claim/consentCopy";
import { ClockIcon, DURATION, EASE, NoBreakHyphens, Paper, SPRING } from "@/components/ui";
import { CLAIM, CODE_AT, CODE_STAGGER, CONSENT, SHOT_AT, WRITE_FOR } from "./claim";
import { ENTER, LEAVE, useGate } from "./gate";

// The five chapters of the Chain of Custody, as presentational copies of the real claim screens. Each one is drawn from
// a scroll progress `p` (0 to 1 over the whole runway, spec H2); a progress fixed at 1 (useDone) gives every chapter's
// final state, which the static figures, the phone and reduced motion show. Every chapter lays itself out from its own
// width (@container): side by side from 720px, stacked below. All of it is decorative (aria-hidden by the caller); the
// text alternative is CHAPTERS in claim.ts.

export type Progress = MotionValue<number>;

/**
 * True where the chapters must fit a short screen: a laptop stage under 800px tall, or a phone whose chapter well is
 * under 560px. Compact layouts drop secondary parts and tighten gaps; they never shrink the type.
 */
export const Compact = createContext(false);

/** A progress fixed at 1: every chapter at rest in its final state. */
export function useDone() {
  return useMotionValue(1);
}

/** True once the progress has passed `at`, for moves that trigger at a threshold instead of scrubbing. */
function useAfter(p: Progress, at: number) {
  const [after, setAfter] = useState(() => p.get() >= at);
  useMotionValueEvent(p, "change", (v) => setAfter(v >= at));
  return after;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ramp = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

/** A line that lights from 35% once the progress passes `at`, in time (after `delay` seconds), so a step comes up in
 * its turn and a stop never rests on it half lit. Lit at rest. */
function Lit({ p, at, delay = 0, className, children }: { p?: Progress; at: number; delay?: number; className?: string; children?: ReactNode }) {
  const done = useDone();
  const lit = useGate(p ?? done, (v) => v >= at, { ...ENTER, delay });
  const opacity = useTransform(lit, (k) => 0.35 + 0.65 * k);
  return (
    <motion.span className={className} style={{ opacity }}>
      {children}
    </motion.span>
  );
}

/**
 * A list of steps on a hairline, each with a small node that lights in turn (no numerals: the order is the line). `p`
 * lights them at `at`; without it they are all lit.
 */
function StepLine({ p, at, steps, className }: { p?: Progress; at: readonly number[]; steps: readonly string[]; className?: string }) {
  return (
    <ol className={clsx("relative flex flex-col gap-2.5 before:absolute before:top-2 before:bottom-2 before:left-[3.5px] before:w-px before:bg-line", className)}>
      {steps.map((s, i) => (
        <li key={s} className="relative grid grid-cols-[1.25rem_minmax(0,1fr)] text-ui">
          <span className="mt-1.5 flex size-2 rounded-full bg-bg">
            <Lit p={p} at={at[i]} className="block size-2 rounded-full border border-text-2" />
          </span>
          <Lit p={p} at={at[i]}>
            {s}
          </Lit>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------------------------------------ 01 Consent */

/** The claim page's (RecallBrief.tsx) line under the product: the CPSC number in mono, the date, the notice's link. */
function SourceLine({ link = true }: { link?: boolean }) {
  return (
    <span className="text-ui text-muted">
      CPSC <span className="font-mono">{CLAIM.recall.replace(/^CPSC /, "")}</span> · Recalled {CLAIM.recalled}
      {link && (
        <>
          <span className="mx-2">·</span>
          <span className="text-text underline decoration-line-strong underline-offset-4">cpsc.gov</span>
        </>
      )}
    </span>
  );
}

/**
 * The real claim page (/r/kikea-x-vesolje) as it is: the recall's brief beside the offer on a hairline, no card and no
 * steps, every word from the page's own copy (claim/consentCopy.ts). `p` brings the brief in once the screen has taken
 * over the laptop's glass; without it, it is all there.
 */
export function ConsentChapter({ p }: { p?: Progress }) {
  const compact = useContext(Compact);
  // In the pinned sequence the product column comes in with the consent column as the screen takes over the laptop's
  // glass (0.12, CustodyStage's HANDOFF): the glass spans the window's width from the top, so the clip, growing only down
  // to the window's foot, never slices this column's words. It comes in time, so a stop there never rests on it half drawn.
  const done = useDone();
  const product = useGate(p ?? done, (v) => v >= 0.12);
  return (
    <div className="@container">
      {/* The claim page's two columns (Exhibit.tsx STEP_GRID) from 720px: the brief, then the offer on a hairline. */}
      <div className="grid items-start gap-6 @min-[720px]:grid-cols-2 @min-[720px]:gap-16">
        <motion.div className={clsx("hidden flex-col @min-[720px]:flex", compact ? "gap-4" : "gap-6")} style={{ opacity: product }}>
          {/* The brief's small header (RecallBrief.tsx), so the offer beside it is the one headline. */}
          <div className="flex flex-col gap-1">
            <p className="text-body font-medium text-balance text-text">{CLAIM.product}</p>
            <SourceLine />
          </div>
          {/* The live recall page's own hazard (RecallBrief.tsx): one sentence on a red rule, no box, no icon. */}
          <p className="border-l-2 border-stop pl-4 text-body font-medium text-pretty text-text">Risk of serious injury or death from suffocation. Stop using it now.</p>
          {/* CPSC's photo on its paper plate, as the live page shows it under the hazard; a short screen gives it way. */}
          <div className={clsx("flex h-44 items-center justify-center rounded-control bg-paper p-4 ring-1 ring-line brightness-[0.84] in-data-[theme=light]:brightness-100", compact && "hidden")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={CLAIM.cpscPhoto} alt="" loading="lazy" className="block max-h-full w-auto max-w-full object-contain mix-blend-multiply" />
          </div>
          <dl className={clsx("grid grid-cols-2 border-t border-line text-ui", compact && "hidden")}>
            {[
              ["Units recalled", CLAIM.units],
              ["Sold by", CLAIM.company],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 py-3">
                <dt className="text-faint">{k}</dt>
                <dd className="text-text">{v}</dd>
              </div>
            ))}
          </dl>
        </motion.div>

        {/* On a phone, where the brief is hidden, the recall is said first, as the claim page's phone brief now says it:
            the product, then the CPSC line; a short phone gives the second way. */}
        <div className="flex flex-col gap-1 @min-[720px]:hidden">
          <p className="text-body font-medium text-balance text-text">{CLAIM.product}</p>
          <span className={clsx(compact && "hidden")}>
            <SourceLine link={false} />
          </span>
        </div>

        {/* The offer as the claim page sets it (ConsentCard.tsx): on the page, not in a box, a hairline from the brief. */}
        <div
          data-dolly-target
          className={clsx(
            "flex flex-col border-line @max-[719px]:border-t @max-[719px]:pt-6 @min-[720px]:-ml-8 @min-[720px]:self-stretch @min-[720px]:border-l @min-[720px]:pl-8",
            compact ? "gap-5" : "gap-7",
          )}
        >
          <div className="flex flex-col gap-3">
            <p className="text-title font-medium text-balance text-text">
              <NoBreakHyphens>{CONSENT.title}</NoBreakHyphens>
            </p>
            <p className="text-body text-pretty text-muted">{CONSENT.how}</p>
          </div>
          <div className="flex flex-col gap-4">
            {/* The claim page's own button, as it looks there: brass, the screen's one amber. A picture, so it is no
                control (the whole screen is hidden from screen readers and takes no pointer). */}
            <span className="btn-primary pointer-events-none flex h-12 items-center justify-center rounded-button-lg text-body font-medium select-none">Log in with PayPal</span>
            <p className="-mt-1 text-ui text-pretty text-muted">{CONSENT.clock}</p>
            <p className={clsx("text-ui text-pretty text-faint", compact && "@max-[719px]:hidden")}>{PAYPAL_CONSENT}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------------------- 02 The code */

function CodeCell({ p, i, char }: { p: Progress; i: number; char: string }) {
  // Each character drops into its cell in time once p reaches the code's moment, one after another, so a stop never
  // rests on one half there.
  const t = useGate(p, (v) => v >= CODE_AT - 0.004, { ...ENTER, delay: i * CODE_STAGGER });
  const y = useTransform(t, (v) => (1 - v) * 10);
  return (
    <span className="flex h-16 w-14 items-center justify-center rounded-control border border-line-strong bg-surface">
      <motion.span className="font-mono text-[1.75rem] leading-none font-medium" style={{ opacity: t, y }}>
        {char}
      </motion.span>
    </span>
  );
}

const SHOT_LIST = ["The X-VESOLJE tag", "The pillow cut fully in half", `The code ${CLAIM.code}, on the tag`];

/** The 10-minute camera session, counting down through the beat to where the static figure rests (9:42). */
const sessionLeft = (v: number) => {
  const s = Math.round(600 - 18 * ramp(v, 0.34, 0.48));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function CodeChapter({ p }: { p: Progress }) {
  const compact = useContext(Compact);
  const swung = useAfter(p, 0.34);
  const left = useTransform(p, sessionLeft);
  // The tag is written in the same event as the boxes fill: left to right as the last character lands, in time.
  const write = useGate(p, (v) => v >= CODE_AT - 0.004, { duration: WRITE_FOR, ease: EASE.outQuart, delay: 2 * CODE_STAGGER }, LEAVE);
  const wipe = useTransform(write, (k) => `inset(-0.2em ${((1 - k) * 100).toFixed(2)}% -0.2em 0)`);
  return (
    <div className="@container">
      <div className={clsx("grid items-center @min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @min-[720px]:gap-14", compact ? "gap-6" : "gap-10")}>
        <div className={clsx("flex flex-col", compact ? "gap-4" : "gap-6")}>
          <div className="flex items-center justify-between gap-4">
            <p className="text-title font-medium">Your one-time code</p>
            <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-ui text-muted">
              <ClockIcon size={14} />
              <motion.span>{left}</motion.span>
            </span>
          </div>
          <div className="flex gap-2" aria-hidden="true">
            {CLAIM.code.split("").map((c, i) => (
              <CodeCell key={c} p={p} i={i} char={c} />
            ))}
          </div>
          <p className={clsx("max-w-[44ch] text-body text-muted", compact && "@max-[719px]:hidden")}>Write it on a tag with <NoBreakHyphens>X-VESOLJE</NoBreakHyphens>, big, in marker. Then photograph the cut pillow with the tag on it, in this page&rsquo;s camera.</p>
          <div className="hidden flex-col gap-2 @min-[720px]:flex">
            <span className="text-ui text-faint">Your photo must show</span>
            <StepLine p={p} at={SHOT_AT} steps={SHOT_LIST} />
          </div>
        </div>

        <div className={clsx("flex justify-center", compact ? "pt-6 @min-[720px]:pt-10" : "pt-12 @min-[720px]:pt-14")}>
          <motion.div
            className={clsx("relative w-full origin-[50%_19px] @min-[720px]:max-w-[22rem]", compact ? "max-w-[15rem]" : "max-w-[18rem]")}
            initial={false}
            animate={swung ? { rotate: 0, y: 0, opacity: 1 } : { rotate: -6, y: -28, opacity: 0 }}
            transition={swung ? SPRING.drop : { duration: 0.16 }}
          >
            {/* The string, from the punched hole up and off the top of the frame; shorter on a short phone, where the
                tag sits closer under the code, so it never crosses the code's cells. */}
            <svg
              className={clsx("absolute bottom-[calc(100%-19px)] left-1/2 w-10 -translate-x-[3px] overflow-visible", compact ? "h-14" : "h-20")}
              viewBox="0 0 40 80"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {/* From the hole's top rim, never its middle, so the hole reads as a hole, not a dial with a hand in it. */}
              <path d="M3.5 74 C 6 52, -6 30, 10 0" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            {/* What it hangs from: a brass pin at the string's top end, as the Problem board's pins (never a string ending
                in the air). */}
            <span
              aria-hidden="true"
              className={clsx(
                "absolute left-[calc(50%+7px)] size-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-accent shadow-[0_0_0_1px_var(--accent-edge),0_2px_3px_-1px_oklch(0_0_0/0.4)]",
                compact ? "bottom-[calc(100%+37px)]" : "bottom-[calc(100%+61px)]",
              )}
            />
            <CodeTag wipe={wipe} short={compact} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/** The owner's paper tag with the recall's name and the one-time code, written left to right as `wipe` opens. */
export function CodeTag({ wipe, short, className }: { wipe?: MotionValue<string>; short?: boolean; className?: string }) {
  return (
    <Paper variant="tag" hole padding="lg" className={clsx("w-full", className)}>
      {/* Headed by the recall it answers, never by the seller's name: the seller isn't Remedy's customer here. */}
      <p className="flex items-baseline justify-between gap-3 text-ui text-ink-muted">
        Recall
        <span className="font-mono text-micro">{CLAIM.recall}</span>
      </p>
      <motion.p className="mt-5 font-mono leading-none font-medium tracking-[0.08em]" style={wipe ? { clipPath: wipe } : undefined}>
        <span className="block text-[1.75rem]">X-VESOLJE</span>
        <span className="mt-3 block text-[3.5rem] tracking-[0.14em]">{CLAIM.code}</span>
      </motion.p>
      {/* On a short phone the tag's foot gives way; the laptop and the static figure always show it. */}
      <p className={clsx("mt-6 border-t border-dashed border-paper-line pt-3 text-ui text-ink-muted", short && "@max-[719px]:hidden")}>Write it big, in marker.</p>
    </Paper>
  );
}

/* ------------------------------------------------------------------------------------------- 03 Live photo */

/* -------------------------------------------------------------------------------------- Handoff: the console */

type Cell = CustomCellRendererProps<ClaimRow>;

// The console queue's columns at a laptop's width, with GridStill's widths (the payout from 708px of window, the photo
// check's time from 812px), each cell drawn by the console's own renderer (cells.tsx) as /console draws it: ids, filing
// times, times and money in mono, the reason in the verdict's cell (under its mark in a column this narrow, as the
// console sets it), a refusal's bar hatched. No reason column of its own and no foot the console lacks.
const COLUMNS: { id: string; header: string; cell: ComponentType<Cell>; className: string }[] = [
  { id: "claim", header: "Claim", cell: ClaimCell, className: "w-[220px]" },
  // A container, as the console's verdict cell is (claims-grid.css): narrower than 26rem, the reason goes under its mark.
  { id: "verdict", header: "Verdict", cell: VerdictCell, className: "min-w-[144px] flex-1 @container" },
  { id: "checks", header: "Checks", cell: ChecksCell, className: "w-[136px]" },
  { id: "time", header: "Answered in", cell: TimeCell, className: "hidden w-[104px] justify-end @min-[812px]:flex" },
  { id: "payout", header: "Payout", cell: PayoutCell, className: "hidden w-[112px] @min-[708px]:flex" },
  { id: "amount", header: "Amount", cell: AmountCell, className: "w-[96px] justify-end" },
];
// The first and last cells on the window's 16px inset.
const EDGE = "first:pl-4 last:pr-4";
// The console's mode (no homepage `stacked`): its own renderers, its own type.
const cellProps = (row: ClaimRow) => ({ data: row, context: {} }) as unknown as Cell;

function QueueRow({ row }: { row: ClaimRow }) {
  return (
    <div className="flex h-13 border-b border-line">
      {COLUMNS.map(({ id, cell: Render, className }) => (
        <span key={id} className={clsx("flex min-w-0 shrink-0 items-center overflow-hidden px-3 text-ui whitespace-nowrap", EDGE, className)}>
          <span className={clsx("min-w-0 flex-1", (id === "amount" || id === "time") && "flex justify-end")}>
            <Render {...cellProps(row)} />
          </span>
        </span>
      ))}
    </div>
  );
}

/** The status tabs' counts over the recall's claims, as the console's tabs count them, and the ledger's remedied, as the
 * console's strip (console/Ledger.tsx) gives it (paid or approved): before RM-0442's row lands (six claims) and after. */
function tally(rows: readonly ClaimRow[]) {
  const counts: Record<string, number> = { all: rows.length };
  for (const r of rows) {
    const v = verdictOf(r);
    counts[v] = (counts[v] ?? 0) + 1;
  }
  return { counts, remedied: (counts.paid ?? 0) + (counts.approved ?? 0) };
}

/** `rows`: the recall's claims as /console draws them, newest first (Hero.tsx, from the console's preview seed). */
export function ConsoleChapter({ p, rows }: { p: Progress; rows: ClaimRow[] }) {
  const arriving = rows.find((r) => r.id === CLAIM.id);
  const others = rows.filter((r) => r.id !== CLAIM.id);
  // RM-0442's row opens into the table once the console is in (an object moving, 560ms), its words after the space. It
  // waits 200ms, so on a page straight past 0.91 the table has landed first and the paid row is the last thing in.
  const open = useGate(p, (v) => v >= 0.91, { duration: DURATION.object, ease: EASE.outQuart, delay: 0.2 }, { duration: 0.28, ease: EASE.outQuart });
  // The console's 52px row.
  const height = useTransform(open, (k) => `${(k * 3.25).toFixed(3)}rem`);
  const opacity = useTransform(open, [0.5, 1], [0, 1]);
  // The tabs and the ledger count RM-0442 as its row lands (All 6 to 7, Paid 0 to 1, $0.00 to $29.99), never before.
  const [landed, setLanded] = useState(() => open.get() >= 0.5);
  useMotionValueEvent(open, "change", (k) => setLanded(k >= 0.5));
  const { counts, remedied } = tally(landed ? rows : others);
  // The console's one neutral flash on a changed row (never amber: the rail's running chapter is this screen's amber).
  const flash = useTransform(p, (v) => `color-mix(in oklch, var(--text) ${(8 * (1 - ramp(v, 0.94, 1))).toFixed(2)}%, transparent)`);
  // Its window is as tall as the queue (CustodyStage, .screen[data-fit]): a tall screen shows the seven claims whole over
  // their foot, never a well of empty rows; a short one keeps as many whole rows as the window holds.
  return (
    // The queue sits straight in the console's window on hairlines, as the tour draws it: no card inside the window, and
    // no heading over it (the rail already says who sees it; RM-0442's own row says when it was paid).
    <div className="h-full @container">
      <div className="flex h-full flex-col">
        <div data-console-queue className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* The console's ledger strip, in its order and words (console/Ledger.tsx), over its status tabs. */}
          <dl className="flex h-12 shrink-0 items-center gap-x-6 overflow-hidden border-b border-line px-4 whitespace-nowrap @min-[720px]:gap-x-8">
            <LedgerItem
              value={
                <>
                  {remedied}
                  <span className="text-ui font-normal text-muted"> of {CLAIM.units.replace(/^About /, "")}</span>
                </>
              }
              label="remedied"
            />
            <LedgerItem value={`$${(landed ? CLAIM.amount : 0).toFixed(2)}`} label="paid through PayPal" />
            {/* The console shows no median before a payout: it comes in with the row. */}
            <LedgerItem
              className={clsx("hidden transition-opacity duration-300 @min-[640px]:flex", !landed && "opacity-0")}
              value={durationFigure(CLAIM.seconds)}
              label="median photo to payout sent · 1 payout"
            />
          </dl>
          <div className="flex items-center gap-4 border-b border-line px-4">
            {/* The console's own status tabs, in its words, with their counts in mono. */}
            <span className="flex min-w-0 overflow-hidden">
              {TABS.map((t, i) => (
                <span
                  key={t.id}
                  className={clsx(
                    "relative inline-flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-ui font-medium whitespace-nowrap first:pl-0",
                    i === 0 ? "text-text after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:bg-text first:after:left-0" : "text-muted",
                  )}
                >
                  {t.label}
                  <span className={clsx("inline-block min-w-[2ch] font-mono text-micro font-normal tabular-nums", i === 0 ? "text-muted" : "text-faint")}>
                    {counts[t.id] ?? 0}
                  </span>
                </span>
              ))}
            </span>
            {/* The console's search, as it sits at rest: its placeholder and the / that focuses it. */}
            <span className="ml-auto hidden h-8 w-52 shrink-0 items-center justify-between rounded-control border border-line bg-surface px-3 text-ui text-faint @min-[960px]:flex">
              Search claims, codes…
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-line-strong/60 font-mono text-micro">/</span>
            </span>
          </div>
          {/* The grid's header as GridStill draws it: 36px and its hairline, the labels in 13px. */}
          <div className="box-content flex h-9 shrink-0 border-b border-line">
            {COLUMNS.map((c) => (
              <span key={c.id} className={clsx("flex shrink-0 items-center px-3 text-[13px] font-medium whitespace-nowrap text-muted", EDGE, c.className)}>
                {c.header}
              </span>
            ))}
          </div>
          {/* As many whole rows as the panel holds, so a tall screen shows more of the queue: a row that would not fit
              wraps out of sight beside the list, never cut through by the panel's foot. */}
          {/* .claims-grid: the console's own styles for its cells (the picked-row box stays hidden, as in /console). */}
          <div data-console-rows className="claims-grid flex min-h-0 flex-1 flex-col flex-wrap content-start overflow-hidden *:w-full *:shrink-0">
            {arriving && (
              <motion.div className="overflow-hidden" style={{ height }}>
                <motion.div style={{ opacity, backgroundColor: flash }}>
                  <QueueRow row={arriving} />
                </motion.div>
              </motion.div>
            )}
            {others.map((r) => (
              <QueueRow key={r.id} row={r} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
