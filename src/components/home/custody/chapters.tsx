"use client";

import clsx from "clsx";
import Image from "next/image";
import { motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { VerdictMark } from "@/components/console/VerdictMark";
import { ClockIcon, DURATION, EASE, NoBreakHyphens, Paper, SPRING } from "@/components/ui";
import { CLAIM, CODE_AT, CODE_STAGGER, CONSENT_AT, CONSENT_STAGGER, CONSOLE_ROWS, SHOT_AT, WRITE_FOR } from "./claim";
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
 * lights them at `at`; without it they are all lit. `card`: the list sits on the consent card from 720px, so each node
 * masks the hairline in the card's colour there.
 */
function StepLine({ p, at, stagger = 0, steps, card, className }: { p?: Progress; at: readonly number[]; stagger?: number; steps: readonly string[]; card?: boolean; className?: string }) {
  return (
    <ol className={clsx("relative flex flex-col gap-2.5 before:absolute before:top-2 before:bottom-2 before:left-[3.5px] before:w-px before:bg-line", className)}>
      {steps.map((s, i) => (
        <li key={s} className="relative grid grid-cols-[1.25rem_minmax(0,1fr)] text-ui">
          <span className={clsx("mt-1.5 flex size-2 rounded-full bg-bg", card && "@min-[720px]:bg-surface")}>
            <Lit p={p} at={at[i]} delay={i * stagger} className="block size-2 rounded-full border border-text-2" />
          </span>
          <Lit p={p} at={at[i]} delay={i * stagger}>
            {s}
          </Lit>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------------------------------------ 01 Consent */

const CONSENT_STEPS = ["Cut it in half, as the notice says", "Write your one-time code on a tag and photograph it here", "Paid to your PayPal, usually within a minute"];

/** `p` lights the steps in turn (the pinned laptop); without it they are all lit. */
export function ConsentChapter({ p }: { p?: Progress }) {
  const compact = useContext(Compact);
  // In the pinned sequence the product column comes in with the consent card as the screen takes over the laptop's glass
  // (0.12, CustodyStage's HANDOFF): the glass spans the window's width from the top, so the clip, growing only down to
  // the window's foot, never slices this column's words. It comes in time, so a stop there never rests on it half drawn.
  const done = useDone();
  const product = useGate(p ?? done, (v) => v >= 0.12);
  return (
    <div className="@container">
      <div className="grid items-start gap-10 @min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] @min-[720px]:gap-12">
        <motion.div className={clsx("hidden flex-col @min-[720px]:flex", compact ? "gap-4" : "gap-6")} style={{ opacity: product }}>
          <span className="text-ui text-faint">
            <span className="font-mono">{CLAIM.recall}</span> · Recalled {CLAIM.recalled}
          </span>
          <p className="text-h2 font-medium">{CLAIM.product}</p>
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
              <div key={k} className="flex flex-col gap-1 border-b border-line py-3">
                <dt className="text-faint">{k}</dt>
                <dd className="text-text">{v}</dd>
              </div>
            ))}
          </dl>
        </motion.div>

        <div
          data-dolly-target
          className={clsx(
            "flex flex-col gap-5 @min-[720px]:rounded-card @min-[720px]:bg-surface @min-[720px]:shadow-card",
            compact ? "@min-[720px]:gap-5 @min-[720px]:p-6" : "@min-[720px]:gap-6 @min-[720px]:p-8",
          )}
        >
          {/* The offer heads the card, as the claim page's does: no company badge (the seller is in the recall's facts).
              On a phone, where the brief is hidden, the recall is said once above it; a short phone gives it way. */}
          <span className={clsx("text-ui text-muted @min-[720px]:hidden", compact && "@max-[719px]:hidden")}>
            <NoBreakHyphens>X-VESOLJE</NoBreakHyphens> nursing pillow recall · <span className="font-mono whitespace-nowrap">{CLAIM.recall}</span>
          </span>
          {/* The claim page's headline and the line under it (ConsentCard.tsx): one ink, the line a step down. */}
          <div className="flex flex-col gap-2">
            <p className="text-title font-medium text-pretty">
              $29.99 back for your <NoBreakHyphens>X-VESOLJE</NoBreakHyphens> pillow
            </p>
            <p className="text-body text-pretty text-text-2">Cut the pillow in half, photograph it with the code we give you, and PayPal pays you in seconds.</p>
          </div>
          <StepLine p={p} at={CONSENT_AT} stagger={CONSENT_STAGGER} steps={CONSENT_STEPS} card className={clsx("font-medium", compact && "@max-[719px]:hidden")} />
          {/* The claim page's own button, as it looks there: brass, the screen's one amber. A picture, so it is no control
              (the whole screen is hidden from screen readers and takes no pointer). */}
          <span className="btn-primary pointer-events-none flex h-12 items-center justify-center rounded-button-lg text-body font-medium select-none">Log in with PayPal</span>
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

type Bar = "pass" | "hold" | "reject" | "skip";
/**
 * The five checks' bars for a row: paid, every one passed; held at the fifth (the same item in both photos); rejected or
 * blocked at the check that stopped it (`fails`), and a claim blocked before the photo check never ran the rest.
 */
const barsOf = (row: { status: string; fails?: number }): Bar[] =>
  [0, 1, 2, 3, 4].map((i) => {
    if (row.status === "held") return i === 4 ? "hold" : "pass";
    if (row.fails === undefined || i < row.fails) return "pass";
    if (i === row.fails) return "reject";
    return row.status === "blocked" ? "skip" : "pass";
  });

function Barcode({ bars }: { bars: Bar[] }) {
  return (
    <span className="flex items-center">
      {bars.map((b, i) => (
        <span
          key={i}
          className={clsx(
            "h-4 w-1.5 rounded-[1.5px]",
            i === 3 ? "ml-2" : i > 0 && "ml-[3px]",
            // A pass in ink, as the console draws it: green means money moved, and a check moves none.
            b === "pass" && "bg-text-2",
            b === "hold" && "bg-[linear-gradient(var(--hold)_50%,transparent_50%)] ring-1 ring-hold/60 ring-inset",
            b === "reject" && "bg-stop",
            b === "skip" && "border border-dashed border-line-strong",
          )}
        />
      ))}
    </span>
  );
}

function Thumb({ src }: { src: string }) {
  return (
    <span className="relative h-6 w-8 shrink-0 overflow-hidden rounded-[4px] border border-line">
      <Image src={src} alt="" fill sizes="32px" className="object-cover" style={{ objectPosition: CLAIM.objectPosition }} />
    </span>
  );
}

const GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 @min-[720px]:grid-cols-[11rem_minmax(0,1fr)_6rem_6.5rem_5rem]";

/** Claim RM-0442 as the recall team's console lists it, paid, just filed: its photo check answered at 0:14, the
 * payout sent at 0:15 (the exhibit's clock, teardown/model.ts elapsed). Its line says the payout's time, so the 14 s the
 * photo check took never reads as the receipt's 15 s. */
const M4T_ROW = {
  photo: CLAIM.photo,
  filed: "Just now",
  id: CLAIM.id,
  status: "paid" as const,
  reason: `Paid ${CLAIM.seconds} s after the photo`,
  // The console's one time unit: seconds, "14 s".
  time: `${CLAIM.seconds - 1} s`,
  amount: CLAIM.amount,
};

/** The ones a reviewer answers for are in full ink, as the console sets them. */
const EXCEPTION = new Set<string>(["held", "rejected", "blocked"]);

function ConsoleRow({ row, first }: { row: (typeof CONSOLE_ROWS)[number]; first?: boolean }) {
  const compact = useContext(Compact);
  return (
    <div className={clsx(GRID, compact ? "h-12" : "h-14", "border-b border-line text-ui")}>
      <span className="flex min-w-0 items-center gap-3">
        <Thumb src={row.photo} />
        <span className="flex min-w-0 flex-col leading-tight">
          {/* The tour's convention: the claim id first, when it was filed under it, newest first. */}
          <span className="font-mono font-medium">{row.id}</span>
          <span className="truncate text-micro text-faint">{row.filed}</span>
        </span>
      </span>
      {/* The console's verdict mark in a track as wide as the widest (Approved), so every reason starts on one line. */}
      <span className="hidden min-w-0 grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 @min-[720px]:grid">
        <VerdictMark verdict={row.status} className={clsx("justify-self-start", EXCEPTION.has(row.status) && "text-text")} />
        {/* Two lines rather than an ellipsis: a cut sentence reads unfinished. */}
        <span className={clsx("line-clamp-2 leading-tight", first ? "text-text" : "text-muted")}>{row.reason}</span>
      </span>
      <span className="hidden @min-[720px]:block">
        <Barcode bars={barsOf(row)} />
      </span>
      {/* Right-aligned on tabular figures, as the console's own column: "11 s" over "14 s" keeps one edge. */}
      <span className="hidden text-right text-faint tabular-nums @min-[720px]:block">{row.time ?? "—"}</span>
      <span className="flex items-center justify-end gap-3">
        <span className="@min-[720px]:hidden">
          <VerdictMark verdict={row.status} className={EXCEPTION.has(row.status) ? "text-text" : undefined} />
        </span>
        {/* Plain figures in a table, as the console tour prints them: superscript cents are the hero receipt's alone. */}
        {row.amount ? (
          // Schibsted's proportional figures: its tabular ones space the point like mono ("$29 .99").
          <span>${row.amount.toFixed(2)}</span>
        ) : (
          <span className="text-faint">—</span>
        )}
      </span>
    </div>
  );
}

export function ConsoleChapter({ p }: { p: Progress }) {
  const compact = useContext(Compact);
  // RM-0442's row opens into the table once the console is in (an object moving, 560ms), its words after the space. It
  // waits 200ms, so on a page straight past 0.91 the table has landed first and the paid row is the last thing in.
  const open = useGate(p, (v) => v >= 0.91, { duration: DURATION.object, ease: EASE.outQuart, delay: 0.2 }, { duration: 0.28, ease: EASE.outQuart });
  const height = useTransform(open, (k) => `${(k * (compact ? 3 : 3.5)).toFixed(3)}rem`);
  const opacity = useTransform(open, [0.5, 1], [0, 1]);
  // The console's one neutral flash on a changed row (never amber: the rail's running chapter is this screen's amber).
  const flash = useTransform(p, (v) => `color-mix(in oklch, var(--text) ${(8 * (1 - ramp(v, 0.94, 1))).toFixed(2)}%, transparent)`);
  // It fills the stage down to its foot, so as the pin releases the stage never shows an empty band under it.
  return (
    // The queue sits straight in the console's window on hairlines, as the tour draws it: no card inside the window, and
    // no heading over it (the rail already says who sees it; RM-0442's own row says when it was paid).
    <div className="h-full @container">
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex gap-6 border-b border-line px-4 text-ui">
            {/* The console's own status tabs, in its words. */}
            {["All", "Approved", "Held", "Rejected", "Blocked"].map((t, i) => (
              <span key={t} className={clsx("py-2.5", i === 0 ? "border-b-2 border-text text-text" : "text-muted")}>
                {t}
              </span>
            ))}
          </div>
          <div className={clsx(GRID, "hidden h-9 border-b border-line text-micro font-medium text-muted @min-[720px]:grid")}>
            <span>Claim</span>
            <span>Verdict</span>
            <span>Checks</span>
            <span className="text-right">Answered in</span>
            <span className="text-right">Amount</span>
          </div>
          {/* The rows run on past the panel's foot, cut by it as a list is, so a tall screen shows more of the queue. */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <motion.div className="overflow-hidden" style={{ height }}>
              <motion.div style={{ opacity, backgroundColor: flash }}>
                <ConsoleRow row={M4T_ROW} first />
              </motion.div>
            </motion.div>
            {CONSOLE_ROWS.map((r) => (
              <ConsoleRow key={r.id} row={r} />
            ))}
          </div>
          {/* The newest claims of the recall, never totals of their own: the recall's figures are For companies'. */}
          <p className="flex shrink-0 items-center justify-between gap-4 border-t border-line px-4 py-3 text-micro text-faint">
            <span>Newest first</span>
          </p>
        </div>
      </div>
    </div>
  );
}
