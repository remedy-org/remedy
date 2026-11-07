"use client";

import clsx from "clsx";
import Image from "next/image";
import { motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertIcon, CheckIcon, ClockIcon, Money, Paper, SPRING, Stamp, StatusPill } from "@/components/ui";
import { CHECKS, CLAIM, CODE_AT, CONSOLE_ROWS, REGIONS, TICK_AT, WRITE_AT, type RegionId } from "./claim";
import styles from "./custody.module.css";

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

const CHIP = "inline-flex h-6 items-center rounded-control px-2 font-mono text-micro tracking-[0.06em] uppercase";

/** The honest label every rendering of the AI-made sample photo carries. */
export function AiLabel({ className }: { className?: string }) {
  return <span className={clsx(CHIP, "absolute bg-photo-scrim text-photo-scrim-text", className)}>AI-made test photo</span>;
}

function Photo({ sizes }: { sizes: string }) {
  return <Image src={CLAIM.photo} alt="" fill sizes={sizes} className="object-cover" style={{ objectPosition: CLAIM.objectPosition }} />;
}

/** Remedy's tag mark, for the consent card's overlapping marks (a copy of the Wordmark glyph, without the string). */
function TagGlyph() {
  return (
    <svg width="22" height="22" viewBox="5 7 14 18" aria-hidden="true">
      <g transform="rotate(-8 12 15)">
        <path
          fillRule="evenodd"
          fill="var(--accent)"
          d="M9.5 8.5h5l3.5 3.5v9.25c0 .97-.78 1.75-1.75 1.75h-8.5c-.97 0-1.75-.78-1.75-1.75V12zM13.5 12a1.5 1.5 0 1 0-3 0a1.5 1.5 0 1 0 3 0z"
        />
        <path d="M9 16.25h6M9 19.25h3.5" stroke="var(--accent-ink)" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function RefundLine() {
  return (
    <div className="flex flex-col gap-2">
      <span className="micro text-faint">Your refund</span>
      <div className="flex items-center gap-4">
        <Money value={CLAIM.amount} size="amount" />
        <span className="inline-flex h-6 items-center rounded-full border border-line px-2.5 font-mono text-micro whitespace-nowrap text-muted">About 5 min</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ 01 Consent */

const CONSENT_STEPS = ["Cut it in half, as the notice says", "Write your one-time code on a tag and photograph it here", "Paid to your PayPal, usually within a minute"];

export function ConsentChapter() {
  const compact = useContext(Compact);
  return (
    <div className="@container">
      <div className="grid items-center gap-10 @min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] @min-[720px]:gap-12">
        <div className={clsx("hidden flex-col @min-[720px]:flex", compact ? "gap-4" : "gap-6")}>
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
        </div>

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
                <TagGlyph />
              </span>
            </div>
            <span className="text-ui text-muted">Kikea Store works with Remedy to pay this recall.</span>
          </div>
          <p className="text-title font-medium text-pretty">
            Get $29.99 back for your X-VESOLJE pillow.{" "}
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
                <span className="relative bg-bg font-mono text-micro text-faint @min-[720px]:bg-surface">{String(i + 1).padStart(2, "0")}</span>
                {s}
              </li>
            ))}
          </ol>
          <span className="flex h-12 items-center justify-center rounded-control bg-accent text-body font-medium text-accent-ink">Log in with PayPal</span>
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

export function CodeChapter({ p }: { p: Progress }) {
  const compact = useContext(Compact);
  const swung = useAfter(p, 0.34);
  const wipe = useTransform(p, (v) => `inset(-0.2em ${((1 - ramp(v, WRITE_AT[0], WRITE_AT[1])) * 100).toFixed(2)}% -0.2em 0)`);
  return (
    <div className="@container">
      <div className={clsx("grid items-center @min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @min-[720px]:gap-14", compact ? "gap-6" : "gap-10")}>
        <div className={clsx("flex flex-col", compact ? "gap-4" : "gap-6")}>
          <div className="flex items-center justify-between gap-4">
            <p className="text-title font-medium">Your one-time code</p>
            <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-line px-2.5 font-mono text-ui text-muted tabular-nums">
              <ClockIcon size={14} />
              9:42
            </span>
          </div>
          <div className="flex gap-2" aria-hidden="true">
            {CLAIM.code.split("").map((c, i) => (
              <CodeCell key={c} p={p} at={CODE_AT[i]} char={c} />
            ))}
          </div>
          <p className={clsx("max-w-[44ch] text-body text-muted", compact && "@max-[719px]:hidden")}>Write it on a tag with X-VESOLJE, big, in marker. Then photograph the cut pillow with the tag on it, in this page&rsquo;s camera.</p>
          <div className="hidden flex-col gap-2 @min-[720px]:flex">
            <span className="micro text-faint">Your photo must show</span>
            <ol className="flex flex-col gap-1.5">
              {SHOT_LIST.map((s, i) => (
                <li key={s} className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-baseline text-ui">
                  <span className="font-mono text-micro text-faint">{String(i + 1).padStart(2, "0")}</span>
                  {s}
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

/** The captured photo as a print: a 3px paper border and the amber exhibit letter. */
export function ExhibitPrint({ children, className, sizes }: { children?: ReactNode; className?: string; sizes: string }) {
  return (
    <div className={clsx("relative rounded-control bg-paper p-[3px] shadow-paper", className)}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-[3px] bg-surface-2">
        <Photo sizes={sizes} />
        {children}
      </div>
      <span className="absolute -top-2.5 -left-2.5 flex size-6 items-center justify-center rounded-control bg-ink font-mono text-micro font-medium text-paper">A</span>
    </div>
  );
}

export function PhotoChapter({ p }: { p: Progress }) {
  const shot = useAfter(p, 0.57);
  const flash = useTransform(p, [0.555, 0.5625, 0.57], [0, 0.5, 0]);
  const v = useTransform(p, (x) => 12 - 4 * outQuart(ramp(x, 0.48, 0.54)));
  const top = useTransform(v, (x) => `${x}%`);
  const left = useTransform(v, (x) => `${x * 1.5}%`);
  return (
    <div className="@container">
      <div className="grid items-center gap-10 @min-[720px]:grid-cols-[minmax(0,1fr)_14rem] @min-[720px]:gap-14">
        <div className="flex flex-col gap-4">
          <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-[oklch(0.12_0.004_75)] shadow-card">
            <Photo sizes="(min-width: 1024px) 640px, 320px" />
            <motion.span
              className="absolute rounded-2xl border-2 border-[oklch(1_0_0/0.85)] shadow-[0_0_0_100vmax_oklch(0_0_0/0.45)]"
              style={{ top, bottom: top, left, right: left }}
            />
            <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {["Label", "Cut in half", `Code ${CLAIM.code}`].map((c) => (
                <span key={c} className={clsx(CHIP, "bg-photo-scrim text-photo-scrim-text")}>
                  {c}
                </span>
              ))}
            </span>
            <span className={clsx(CHIP, "absolute top-3 right-3 bg-photo-scrim text-photo-scrim-text @max-[719px]:hidden")}>Exhibit A</span>
            <AiLabel className="bottom-3 left-3" />
            <motion.span className="absolute inset-0 bg-[oklch(1_0_0)]" style={{ opacity: flash }} />
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) =>
                i === 0 && shot ? (
                  <div key={i} className="relative size-12 rounded-control bg-paper p-[2px] shadow-paper">
                    <div className="relative size-full overflow-hidden rounded-[3px]">
                      <Photo sizes="48px" />
                    </div>
                    <span className="absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-[3px] bg-ink font-mono text-micro font-medium text-paper">
                      A
                    </span>
                  </div>
                ) : (
                  <span key={i} className="size-12 rounded-control border border-dashed border-line-strong" />
                ),
              )}
            </div>
            <span className="flex size-14 items-center justify-center rounded-full border-2 border-text/80">
              <span className="size-11 rounded-full bg-text/90" />
            </span>
            <span
              className={clsx(
                "inline-flex h-9 items-center justify-self-end rounded-control bg-accent px-3 text-ui font-medium text-accent-ink transition-opacity duration-160",
                !shot && "opacity-0",
              )}
            >
              Send
            </span>
          </div>
          <p className="text-ui text-muted @min-[720px]:hidden">Live camera only. There&rsquo;s no upload button, and the photo has to arrive inside the 10-minute session.</p>
        </div>

        <div className="hidden flex-col gap-4 @min-[720px]:flex">
          <span className="micro text-faint">Exhibit A</span>
          <div className="relative aspect-[4/3] rounded-control border border-dashed border-line-strong">
            <motion.div
              className="absolute inset-0"
              initial={false}
              animate={shot ? { y: 0, rotate: 2, opacity: 1 } : { y: -24, rotate: -4, opacity: 0 }}
              transition={shot ? SPRING.drop : { duration: 0.16 }}
            >
              <ExhibitPrint sizes="224px" className="-m-[3px]" />
            </motion.div>
          </div>
          <p className="text-ui text-muted">Live camera only. There&rsquo;s no upload button, and the photo has to arrive inside the 10-minute session.</p>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------- 04 Five checks */

function CheckRow({ p, i }: { p: Progress; i: number }) {
  const compact = useContext(Compact);
  const check = CHECKS[i];
  const t = useTransform(p, (v) => ramp(v, TICK_AT[i] - 0.006, TICK_AT[i] + 0.006));
  const scale = useTransform(t, [0, 1], [0.4, 1]);
  const text = useTransform(t, [0, 1], [0.55, 1]);
  return (
    <li className={clsx("flex flex-col border-b border-line last:border-b-0", compact ? "py-1.5 @min-[720px]:py-2" : "py-2 @min-[720px]:py-3")}>
      <div className="flex items-center gap-3">
        <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong">
          <motion.span className="absolute -inset-px flex items-center justify-center rounded-full bg-pay-soft text-pay" style={{ opacity: t, scale }}>
            <CheckIcon size={14} />
          </motion.span>
        </span>
        <motion.span className="text-body" style={{ opacity: text }}>
          {check.label}
        </motion.span>
        <span className={clsx(CHIP, "ml-auto shrink-0 border", check.ai ? "border-line-2 text-text-2" : "border-line text-muted")}>
          {check.ai ? "Model reads" : "No AI"}
        </span>
      </div>
      {check.quote && (
        // On a short phone the quotes give way to the five checks; the laptop always shows them, with their leaders.
        <motion.p
          data-quote={check.region}
          className={clsx("mt-2 border-l border-line-2 pl-3 text-ui leading-[1.55] text-pretty text-muted @min-[720px]:ml-9", compact && "@max-[719px]:hidden")}
          style={{ opacity: t }}
        >
          &ldquo;{check.quote}&rdquo;
        </motion.p>
      )}
    </li>
  );
}

function Region({ p, id, n, at }: { p: Progress; id: RegionId; n: number; at: number }) {
  const r = REGIONS[id];
  const shown = useTransform(p, (v) => ramp(v, at + 0.024, at + 0.03));
  return (
    <>
      {/* Laptops: an outline round where the model looked, reached by the leader line. */}
      <motion.span
        data-region={id}
        className="absolute hidden rounded-control border-[1.5px] border-accent shadow-[0_0_0_1px_oklch(0_0_0/0.35)] @min-[720px]:block"
        style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`, opacity: shown }}
      />
      {/* Phones: a numbered dot, matching the check's number. */}
      <span
        className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent font-mono text-micro font-medium text-accent-ink @min-[720px]:hidden"
        style={{ left: `${(r.x + r.w / 2) * 100}%`, top: `${(r.y + r.h / 2) * 100}%` }}
      >
        {n}
      </span>
    </>
  );
}

type Leader = { id: RegionId; d: string; x2: number; y2: number };

export function ChecksChapter({ p }: { p: Progress }) {
  const compact = useContext(Compact);
  const root = useRef<HTMLDivElement>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);

  // Leader lines run from each model check's quote to the region of the photo it read. Measured in the chapter's own
  // box, so the stage's opacity and translate moves don't change them; re-measured on resize.
  const measure = useCallback(() => {
    const el = root.current;
    if (!el || !el.offsetWidth) return;
    const o = el.getBoundingClientRect();
    // Screen px to the chapter's own px: the stage may scale it down, and the static figures zoom it.
    const k = o.width / el.offsetWidth || 1;
    const next: Leader[] = [];
    for (const id of ["code", "cut"] as RegionId[]) {
      const q = el.querySelector(`[data-quote="${id}"]`)?.getBoundingClientRect();
      const r = el.querySelector(`[data-region="${id}"]`)?.getBoundingClientRect();
      if (!q || !r || !r.width) continue;
      const x1 = (q.left - o.left) / k - 6;
      const y1 = (q.top - o.top) / k + 11;
      const x2 = (r.right - o.left) / k;
      const y2 = (r.top - o.top + r.height / 2) / k;
      const xm = x1 - Math.max(16, (x1 - x2) * 0.35);
      next.push({ id, x2, y2, d: `M${x1.toFixed(1)} ${y1.toFixed(1)}H${xm.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}` });
    }
    setLeaders(next);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div className="@container">
      <div ref={root} className="relative grid items-center gap-8 @min-[720px]:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] @min-[720px]:gap-20">
        <ExhibitPrint sizes="(min-width: 1024px) 560px, 320px" className={clsx("mx-auto @min-[720px]:mx-0 @min-[720px]:w-auto", compact ? "w-3/5" : "w-2/3")}>
          <AiLabel className="bottom-2 left-2" />
          {CHECKS.map((c, i) => c.region && <Region key={c.region} p={p} id={c.region} n={i + 1} at={TICK_AT[i]} />)}
        </ExhibitPrint>
        <div className="flex flex-col">
          <span className="micro text-faint">Checks</span>
          <ol className="mt-1">
            {CHECKS.map((c, i) => (
              <CheckRow key={c.label} p={p} i={i} />
            ))}
          </ol>
        </div>
        <svg className="pointer-events-none absolute inset-0 hidden size-full overflow-visible @min-[720px]:block" aria-hidden="true">
          {leaders.map((l) => (
            <LeaderPath key={l.id} p={p} leader={l} at={TICK_AT[CHECKS.findIndex((c) => c.region === l.id)]} />
          ))}
        </svg>
      </div>
    </div>
  );
}

function LeaderPath({ p, leader, at }: { p: Progress; leader: Leader; at: number }) {
  const length = useTransform(p, (v) => outQuart(ramp(v, at, at + 0.03)));
  const dot = useTransform(length, [0.9, 1], [0, 1]);
  return (
    <g>
      <motion.path d={leader.d} fill="none" stroke="var(--bg)" strokeWidth={3} strokeLinecap="round" style={{ pathLength: length }} />
      <motion.path d={leader.d} fill="none" stroke="var(--accent)" strokeWidth={1} style={{ pathLength: length }} />
      <motion.circle cx={leader.x2} cy={leader.y2} r={3} fill="var(--accent)" style={{ opacity: dot }} />
    </g>
  );
}

/* ----------------------------------------------------------------------------------------------- 05 Paid */

const RULE: { when: string; then: string; pay?: boolean }[] = [
  { when: "any check fails", then: "reject" },
  { when: "any check unclear", then: "hold for a person" },
  { when: "every check passes", then: "pay", pay: true },
];

function Digit({ p, d, i, lead }: { p: Progress; d: number; i: number; lead?: boolean }) {
  // An odometer wheel: 0 to 9 stacked, rolled up to d between 0.82 and 0.86, the later wheels a little behind. A
  // leading wheel starts blank and narrow, then opens to its digit's width as it rolls, so the figure reads $0.00,
  // never $00.00.
  const t = useTransform(p, (v) => outQuart(ramp(v, 0.82 + i * 0.004, 0.848 + i * 0.004)));
  const y = useTransform(t, (k) => `${(-d * k).toFixed(3)}em`);
  const maxWidth = useTransform(t, (k) => `${Math.min(1, k * d).toFixed(3)}em`);
  return (
    <motion.span className={styles.wheel} style={lead ? { maxWidth } : undefined}>
      <motion.span className={styles.strip} style={{ y }}>
        {(lead ? "\u00a0123456789" : "0123456789").split("").map((n, k) => (
          <span key={k}>{n}</span>
        ))}
      </motion.span>
      {/* Sizes the wheel to its own digit, so proportional widths stay right at rest. */}
      <span className={styles.sizer}>{d}</span>
    </motion.span>
  );
}

/** $29.99 at the display size (the one number on this screen), rolling up from $0.00. Screen readers and copy get
 * the plain amount. */
export function Odometer({ p }: { p: Progress }) {
  const [whole, cents] = CLAIM.amount.toFixed(2).split(".");
  return (
    <span className={clsx("font-sans text-display font-medium", styles.odometer)}>
      <span className="sr-only select-none">${CLAIM.amount.toFixed(2)}</span>
      <span aria-hidden="true" className={styles.figure}>
        <span>$</span>
        {whole.split("").map((n, i) => (
          <Digit key={i} p={p} d={Number(n)} i={i} lead={i === 0 && whole.length > 1} />
        ))}
        <span className={styles.cents}>
          .
          {cents.split("").map((n, i) => (
            <Digit key={i} p={p} d={Number(n)} i={whole.length + i} />
          ))}
        </span>
      </span>
    </span>
  );
}

export function PaidChapter({ p }: { p: Progress }) {
  const compact = useContext(Compact);
  const decided = useTransform(p, (v) => ramp(v, 0.805, 0.815));
  // The PAID · SANDBOX stamp lands once the figure has rolled up, and the light table's pool comes on with it (the
  // same trigger: part of the ink move, not a new one). At rest (reduced motion, the static figures) both are there.
  const stamped = useAfter(p, 0.855);
  const lit = useTransform(p, (v) => outQuart(ramp(v, 0.855, 0.875)));
  return (
    <div className="@container">
      <div className="grid items-center gap-10 @min-[720px]:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] @min-[720px]:gap-16">
        <div className={clsx("flex flex-col gap-5", compact && "@max-[719px]:hidden")}>
          <p className="text-head-sm font-medium">
            A fixed rule decides. <span className="text-muted">The model only says what it sees.</span>
          </p>
          <div className="flex flex-col rounded-card bg-surface font-mono text-micro shadow-card @min-[720px]:text-ui">
            {RULE.map((r) => (
              <div key={r.when} className={clsx("relative flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0", r.pay && "pr-10 @min-[720px]:pr-4")}>
                <span className="flex-1 text-muted @min-[720px]:w-[19ch] @min-[720px]:flex-none @min-[720px]:whitespace-nowrap">{r.when}</span>
                <span className="text-faint">&rarr;</span>
                <span className={r.pay ? "text-text" : "text-muted"}>{r.then}</span>
                {r.pay && (
                  <motion.span className="absolute inset-0 flex items-center justify-end rounded-b-card bg-pay-soft pr-4 text-pay" style={{ opacity: decided }}>
                    <CheckIcon />
                  </motion.span>
                )}
              </div>
            ))}
          </div>
          <p className="text-ui text-muted">The model never moves money. The rule is in the code, the same for every claim.</p>
        </div>

        {/* The refund receipt on the light table: the paper leads this screen, and the pool lies under it. */}
        <div className="relative isolate flex justify-center py-4 @min-[720px]:py-10">
          <motion.div aria-hidden="true" className="pointer-events-none absolute -inset-x-[12%] -inset-y-[18%] -z-10 bg-[image:var(--table-glow)]" style={{ opacity: lit }} />
          <Paper variant="receipt" perforated padding="none" tilt={-1} className="w-full max-w-[23rem]">
            <div className="flex flex-col gap-5 px-6 pt-9 pb-6">
              <div className="flex items-center justify-between gap-3 font-mono text-micro text-ink-muted">
                <span className="tracking-[0.04em] uppercase">Refund receipt</span>
                <span className="whitespace-nowrap">Claim {CLAIM.id}</span>
              </div>
              {/* The stamp sits beside the figure, and wraps under it on a narrow receipt rather than cover it. */}
              <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <Odometer p={p} />
                {stamped && (
                  <Stamp tone="pay" land>
                    Paid · Sandbox
                  </Stamp>
                )}
              </div>
              <dl className={clsx("text-ui", compact && "@max-[719px]:hidden")}>
                {[
                  ["Sent to PayPal", `${CLAIM.seconds} s after the photo`],
                  ["Money", "PayPal sandbox"],
                  ["Recall", `${CLAIM.recall} · X-VESOLJE`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-t border-dashed border-paper-line py-2">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Paper>
        </div>
      </div>
    </div>
  );
}

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
            {row.sample && <span className="size-1.5 rotate-45 border border-faint" title="Sample claim" />}
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
          <span className="flex flex-col items-end leading-tight">
            <Money value={row.amount} size="grid" />
            {"sandbox" in row && row.sandbox === true ? <span className="micro text-[10px] text-faint">Sandbox</span> : null}
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
  const height = useTransform(p, (v) => `${(outQuart(ramp(v, 0.915, 0.95)) * (compact ? 3 : 3.5)).toFixed(3)}rem`);
  const opacity = useTransform(p, (v) => ramp(v, 0.93, 0.95));
  const flash = useTransform(p, (v) => `color-mix(in oklch, var(--accent) ${(14 * (1 - ramp(v, 0.95, 1))).toFixed(2)}%, transparent)`);
  return (
    <div className="@container">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
          <p className="text-head-sm font-medium">
            And Kikea Store sees it here. <span className="text-muted">Every claim, with its evidence.</span>
          </p>
          <span className="flex items-center gap-2 font-mono text-micro text-faint">
            <span className="size-1.5 rotate-45 border border-faint" />
            Sample claims, never paid
          </span>
        </div>
        <div className="overflow-hidden rounded-card bg-surface shadow-card">
          <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
            <span className="text-ui font-medium">Kikea X-VESOLJE nursing pillows</span>
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
        </div>
      </div>
    </div>
  );
}
