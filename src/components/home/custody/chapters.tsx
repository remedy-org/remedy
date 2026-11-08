"use client";

import clsx from "clsx";
import Image from "next/image";
import { motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { AlertIcon, ClockIcon, Money, NoBreakHyphens, Paper, SPRING, StatusPill } from "@/components/ui";
import { RemedyMark } from "@/components/ui/Wordmark";
import { CLAIM, CODE_AT, CONSENT_AT, CONSOLE_ROWS, SHOT_AT, WRITE_AT } from "./claim";

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
const outQuart = (t: number) => 1 - (1 - t) ** 4;

/** A line that lights from 35% once the progress passes `at`, so a step can come up in its turn. Lit at rest. */
function Lit({ p, at, className, children }: { p?: Progress; at: number; className?: string; children: ReactNode }) {
  const done = useDone();
  const opacity = useTransform(p ?? done, (v) => 0.35 + 0.65 * ramp(v, at, at + 0.012));
  return (
    <motion.span className={className} style={{ opacity }}>
      {children}
    </motion.span>
  );
}

function RefundLine() {
  return (
    <div className="flex flex-col gap-2">
      <span className="micro text-faint">Your refund</span>
      <div className="flex items-center gap-4">
        <Money value={CLAIM.amount} size="amount" />
        <span className="inline-flex h-6 items-center rounded-full border border-line px-2.5 font-mono text-micro whitespace-nowrap text-muted">About 5 min start to finish</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ 01 Consent */

const CONSENT_STEPS = ["Cut it in half, as the notice says", "Write your one-time code on a tag and photograph it here", "Paid to your PayPal, usually within a minute"];

/** `p` lights the steps in turn (the pinned laptop); without it they are all lit. */
export function ConsentChapter({ p }: { p?: Progress }) {
  const compact = useContext(Compact);
  // In the pinned sequence the product column comes in only once the screen's clip has grown to the grid (0.2), so
  // while it grows from the laptop's screen the clip holds the consent card alone, and never slices this column's words.
  const done = useDone();
  const product = useTransform(p ?? done, (v) => outQuart(ramp(v, 0.195, 0.205)));
  return (
    <div className="@container">
      <div className="grid items-center gap-10 @min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] @min-[720px]:gap-12">
        <motion.div className={clsx("hidden flex-col @min-[720px]:flex", compact ? "gap-4" : "gap-6")} style={{ opacity: product }}>
          <span className="micro text-faint">
            {CLAIM.recall} · Recalled {CLAIM.recalled}
          </span>
          <p className="text-h2 font-medium">{CLAIM.product}</p>
          <p className="flex gap-3 rounded-card bg-stop-soft p-4 text-body font-medium text-text">
            <AlertIcon className="mt-1 shrink-0 text-stop" />
            Risk of serious injury or death from suffocation. Stop using it now.
          </p>
          <RefundLine />
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
          {/* On a short phone the marks and the steps give way, so the button stays in the frame. */}
          <div className={clsx("flex flex-col gap-3", compact && "@max-[719px]:hidden")}>
            <div className="flex">
              <span className="flex size-11 items-center justify-center rounded-card bg-surface-2 text-body font-medium text-text">KS</span>
              <span className="-ml-2.5 flex size-11 items-center justify-center rounded-card bg-bg ring-2 ring-surface">
                <RemedyMark className="h-4 w-6" />
              </span>
            </div>
            <span className="text-ui text-muted">Kikea Store works with Remedy to pay this recall.</span>
          </div>
          <p className="text-title font-medium text-pretty">
            Get $29.99 back for your <NoBreakHyphens>X-VESOLJE</NoBreakHyphens> pillow.{" "}
            <span className="text-muted">Remedy sends it through PayPal for Kikea Store once your photo shows it&rsquo;s destroyed.</span>
          </p>
          <ol
            className={clsx(
              "relative flex flex-col gap-3 before:absolute before:top-1 before:bottom-1 before:left-[7px] before:w-px before:bg-line",
              compact && "@max-[719px]:hidden",
            )}
          >
            {CONSENT_STEPS.map((s, i) => (
              <li key={s} className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] items-baseline text-ui font-medium">
                <span className="relative bg-bg font-mono text-micro text-faint @min-[720px]:bg-surface">
                  <Lit p={p} at={CONSENT_AT[i]}>
                    {String(i + 1).padStart(2, "0")}
                  </Lit>
                </span>
                <Lit p={p} at={CONSENT_AT[i]}>
                  {s}
                </Lit>
              </li>
            ))}
          </ol>
          {/* A picture of the claim page's button, drawn as a wireframe (a dashed hairline, no fill, faint text) so it never
              reads as a button on this page: the amber and the real buttons stay on the page's own actions. */}
          <span className="flex h-12 items-center justify-center rounded-control border border-dashed border-line-2 text-ui text-faint">
            Log in with PayPal
          </span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------------------- 02 The code */

function CodeCell({ p, at, char }: { p: Progress; at: number; char: string }) {
  const t = useTransform(p, (v) => outQuart(ramp(v, at - 0.008, at + 0.004)));
  const y = useTransform(t, (v) => Math.round((1 - v) * 10));
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
  const wipe = useTransform(p, (v) => `inset(-0.2em ${((1 - ramp(v, WRITE_AT[0], WRITE_AT[1])) * 100).toFixed(2)}% -0.2em 0)`);
  return (
    <div className="@container">
      <div className={clsx("grid items-center @min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @min-[720px]:gap-14", compact ? "gap-6" : "gap-10")}>
        <div className={clsx("flex flex-col", compact ? "gap-4" : "gap-6")}>
          <div className="flex items-center justify-between gap-4">
            <p className="text-title font-medium">Your one-time code</p>
            <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-line px-2.5 font-mono text-ui text-muted tabular-nums">
              <ClockIcon size={14} />
              <motion.span>{left}</motion.span>
            </span>
          </div>
          <div className="flex gap-2" aria-hidden="true">
            {CLAIM.code.split("").map((c, i) => (
              <CodeCell key={c} p={p} at={CODE_AT[i]} char={c} />
            ))}
          </div>
          <p className={clsx("max-w-[44ch] text-body text-muted", compact && "@max-[719px]:hidden")}>Write it on a tag with <NoBreakHyphens>X-VESOLJE</NoBreakHyphens>, big, in marker. Then photograph the cut pillow with the tag on it, in this page&rsquo;s camera.</p>
          <div className="hidden flex-col gap-2 @min-[720px]:flex">
            <span className="micro text-faint">Your photo must show</span>
            <ol className="flex flex-col gap-1.5">
              {SHOT_LIST.map((s, i) => (
                <li key={s} className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-baseline text-ui">
                  <Lit p={p} at={SHOT_AT[i]} className="font-mono text-micro text-faint">
                    {String(i + 1).padStart(2, "0")}
                  </Lit>
                  <Lit p={p} at={SHOT_AT[i]}>
                    {s}
                  </Lit>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className={clsx("flex justify-center", compact ? "pt-6 @min-[720px]:pt-10" : "pt-12 @min-[720px]:pt-14")}>
          <motion.div
            className={clsx("relative w-full origin-[50%_19px] @min-[720px]:max-w-[22rem]", compact ? "max-w-[15rem]" : "max-w-[18rem]")}
            initial={false}
            animate={swung ? { rotate: -2, y: 0, opacity: 1 } : { rotate: -8, y: -28, opacity: 0 }}
            transition={swung ? SPRING.drop : { duration: 0.16 }}
          >
            {/* The string, from the punched hole up and off the top of the frame. */}
            <svg className="absolute bottom-[calc(100%-19px)] left-1/2 h-20 w-10 -translate-x-[3px] overflow-visible" viewBox="0 0 40 80" aria-hidden="true">
              <path d="M3 80 C 6 52, -6 30, 10 0" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
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
      <p className="micro text-ink-muted">
        {CLAIM.recall} · {CLAIM.company}
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
const BARS: Record<string, Bar[]> = {
  paid: ["pass", "pass", "pass", "pass", "pass"],
  held: ["pass", "pass", "pass", "hold", "pass"],
  rejected: ["pass", "pass", "pass", "reject", "pass"],
  blocked: ["reject", "skip", "skip", "skip", "skip"],
};

function Barcode({ bars }: { bars: Bar[] }) {
  return (
    <span className="flex items-center">
      {bars.map((b, i) => (
        <span
          key={i}
          className={clsx(
            "h-4 w-1.5 rounded-[1.5px]",
            i === 3 ? "ml-2" : i > 0 && "ml-[3px]",
            b === "pass" && "bg-pay/70",
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

/** Claim RM-0442 as Kikea Store's console lists it, paid. */
const M4T_ROW = {
  photo: CLAIM.photo,
  code: CLAIM.code,
  id: CLAIM.id,
  status: "paid" as const,
  reason: "Every check passed",
  time: `0:${String(CLAIM.seconds).padStart(2, "0")}`,
  amount: CLAIM.amount,
  // A judges' demo claim: its refund was sandbox money.
  sandbox: true,
};

/** Marks a sample claim (an eval case the demo workspace starts with), as the SAMPLE DATA badge does in the console. */
function SampleBadge() {
  return <span className="micro inline-flex h-[18px] items-center rounded-control border border-line-2 px-1 text-[10px] text-muted">Sample</span>;
}

function ConsoleRow({ row, first }: { row: (typeof CONSOLE_ROWS)[number]; first?: boolean }) {
  const compact = useContext(Compact);
  return (
    <div className={clsx(GRID, compact ? "h-12" : "h-14", "border-b border-line text-ui")}>
      <span className="flex min-w-0 items-center gap-3">
        <Thumb src={row.photo} />
        <span className="flex min-w-0 flex-col leading-tight">
          {/* The console's own convention: the claim id first, its one-time code under it. */}
          <span className="flex items-center gap-1.5 font-mono font-medium">
            {row.id}
            {row.sample && <SampleBadge />}
          </span>
          <span className="truncate font-mono text-micro text-faint">Code {row.code}</span>
        </span>
      </span>
      <span className="hidden min-w-0 items-center gap-3 @min-[720px]:flex">
        <StatusPill status={row.status} />
        <span className={clsx("truncate", first ? "text-text" : "text-muted")}>{row.reason}</span>
      </span>
      <span className="hidden @min-[720px]:block">
        <Barcode bars={BARS[row.status]} />
      </span>
      <span className="hidden font-mono text-faint @min-[720px]:block">{row.time ?? "—"}</span>
      <span className="flex items-center justify-end gap-3 font-mono">
        <span className="@min-[720px]:hidden">
          <StatusPill status={row.status} />
        </span>
        {row.amount ? (
          // A sample's amount was decided, never sent: muted, and said so. RM-0442's went out in sandbox money.
          <span className={clsx("flex flex-col items-end leading-tight", row.sample && "text-faint")}>
            <Money value={row.amount} size="grid" />
            {"sandbox" in row && row.sandbox === true ? <span className="micro text-[10px] text-faint">Sandbox</span> : null}
            {row.sample && <span className="micro text-[10px] text-faint">Not sent</span>}
          </span>
        ) : (
          <span className="text-faint">—</span>
        )}
      </span>
    </div>
  );
}

export function ConsoleChapter({ p }: { p: Progress }) {
  const compact = useContext(Compact);
  const height = useTransform(p, (v) => `${(outQuart(ramp(v, 0.905, 0.94)) * (compact ? 3 : 3.5)).toFixed(3)}rem`);
  const opacity = useTransform(p, (v) => ramp(v, 0.92, 0.94));
  const flash = useTransform(p, (v) => `color-mix(in oklch, var(--accent) ${(14 * (1 - ramp(v, 0.94, 1))).toFixed(2)}%, transparent)`);
  // It fills the stage down to its foot, so as the pin releases the stage never shows an empty band under it.
  return (
    <div className="h-full @container">
      <div className="flex h-full flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
          <p className="text-head-sm font-medium">
            And Kikea Store sees it here. <span className="text-muted">Every claim, with its evidence.</span>
          </p>
          <span className="flex items-center gap-2 text-micro text-faint">
            <SampleBadge />
            eval claims, never paid
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card bg-surface shadow-card">
          <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
            <span className="text-ui font-medium">
              <NoBreakHyphens>Kikea X-VESOLJE nursing pillows</NoBreakHyphens>
            </span>
            <span className="micro text-faint">{CLAIM.recall}</span>
          </div>
          <div className="flex gap-6 border-b border-line px-4 text-ui">
            {["All", "Paid", "Held", "Refused"].map((t, i) => (
              <span key={t} className={clsx("py-2.5", i === 0 ? "border-b-2 border-accent text-text" : "text-muted")}>
                {t}
              </span>
            ))}
          </div>
          <div className={clsx(GRID, "hidden h-9 border-b border-line bg-surface-2 font-mono text-micro tracking-[0.06em] text-faint uppercase @min-[720px]:grid")}>
            <span>Claim</span>
            <span>Verdict</span>
            <span>Checks</span>
            <span>Photo→PayPal</span>
            <span className="text-right">Amount</span>
          </div>
          <motion.div className="overflow-hidden" style={{ height }}>
            <motion.div style={{ opacity, backgroundColor: flash }}>
              <ConsoleRow row={M4T_ROW} first />
            </motion.div>
          </motion.div>
          {CONSOLE_ROWS.map((r) => (
            <ConsoleRow key={r.id} row={r} />
          ))}
          <p className="mt-auto flex items-center justify-between gap-4 border-t border-line px-4 py-3 text-micro text-faint">
            <span>{CONSOLE_ROWS.length + 1} claims</span>
            <span>RM-0442 paid in sandbox · the samples never paid</span>
          </p>
        </div>
      </div>
    </div>
  );
}
