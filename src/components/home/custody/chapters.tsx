"use client";

import clsx from "clsx";
import Image from "next/image";
import { motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertIcon, CheckIcon, ClockIcon, Money, Paper, SPRING, StatusPill } from "@/components/ui";
import { CHECKS, CLAIM, CODE_AT, CONSOLE_ROWS, REGIONS, TICK_AT, WRITE_AT, type RegionId } from "./claim";
import styles from "./custody.module.css";

// The five chapters of the Chain of Custody, as presentational copies of the real claim screens. Each one is drawn from
// a scroll progress `p` (0 to 1 over the whole runway, spec H2); a progress fixed at 1 (useDone) gives every chapter's
// final state, which the static figures, the phone and reduced motion show. Every chapter lays itself out from its own
// width (@container): side by side from 720px, stacked below. All of it is decorative (aria-hidden by the caller); the
// text alternative is CHAPTERS in claim.ts.

export type Progress = MotionValue<number>;

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
function AiLabel({ className }: { className?: string }) {
  return <span className={clsx(CHIP, "absolute bg-bg/80 text-text", className)}>AI-made test photo</span>;
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
  return (
    <div className="@container">
      <div className="grid items-center gap-10 @min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] @min-[720px]:gap-14">
        <div className="hidden flex-col gap-6 @min-[720px]:flex">
          <span className="micro text-accent-text">
            {CLAIM.recall} · Recalled {CLAIM.recalled}
          </span>
          <p className="text-h2 font-semibold">{CLAIM.product}</p>
          <p className="flex gap-3 rounded-card bg-stop-soft p-4 text-body font-semibold text-text">
            <AlertIcon className="mt-1 shrink-0 text-stop" />
            Risk of serious injury or death from suffocation. Stop using it now.
          </p>
          <RefundLine />
          <dl className="grid grid-cols-2 border-t border-line text-ui">
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

        <div className="flex flex-col gap-5 @min-[720px]:gap-6 @min-[720px]:rounded-card @min-[720px]:bg-surface @min-[720px]:p-8 @min-[720px]:shadow-ring">
          <div className="flex flex-col gap-3">
            <div className="flex">
              <span className="flex size-11 items-center justify-center rounded-card bg-surface-2 text-body font-semibold text-text">KS</span>
              <span className="-ml-2.5 flex size-11 items-center justify-center rounded-card bg-bg ring-2 ring-surface">
                <TagGlyph />
              </span>
            </div>
            <span className="text-ui text-muted">Kikea Store works with Remedy to pay this recall.</span>
          </div>
          <p className="text-title font-semibold text-pretty">
            Get $29.99 back for your X-VESOLJE pillow.{" "}
            <span className="text-muted">Remedy sends it through PayPal for Kikea Store once your photo shows it&rsquo;s destroyed.</span>
          </p>
          <ol className="relative flex flex-col gap-3 before:absolute before:top-1 before:bottom-1 before:left-[7px] before:w-px before:bg-line">
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
      <motion.span className="font-mono text-[1.75rem] leading-none font-semibold" style={{ opacity: t, y }}>
        {char}
      </motion.span>
    </span>
  );
}

const SHOT_LIST = ["The X-VESOLJE tag", "The pillow cut fully in half", `The code ${CLAIM.code}, on the tag`];

export function CodeChapter({ p }: { p: Progress }) {
  const swung = useAfter(p, 0.34);
  const wipe = useTransform(p, (v) => `inset(-0.2em ${((1 - ramp(v, WRITE_AT[0], WRITE_AT[1])) * 100).toFixed(2)}% -0.2em 0)`);
  return (
    <div className="@container">
      <div className="grid items-center gap-10 @min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @min-[720px]:gap-14">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-title font-semibold">Your one-time code</p>
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
          <p className="max-w-[44ch] text-body text-muted">Write it on a tag with X-VESOLJE, big, in marker. Then photograph the cut pillow with the tag on it, in this page&rsquo;s camera.</p>
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

        <div className="flex justify-center pt-12 @min-[720px]:pt-14">
          <motion.div
            className="relative w-full max-w-[18rem] origin-[50%_19px] @min-[720px]:max-w-[22rem]"
            initial={false}
            animate={swung ? { rotate: -2, y: 0, opacity: 1 } : { rotate: -8, y: -28, opacity: 0 }}
            transition={swung ? SPRING.drop : { duration: 0.16 }}
          >
            {/* The string, from the punched hole up and off the top of the frame. */}
            <svg className="absolute bottom-[calc(100%-19px)] left-1/2 h-20 w-10 -translate-x-[3px] overflow-visible" viewBox="0 0 40 80" aria-hidden="true">
              <path d="M3 80 C 6 52, -6 30, 10 0" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <Paper variant="tag" hole padding="lg" className="w-full">
              <p className="micro text-ink-muted">
                {CLAIM.recall} · {CLAIM.company}
              </p>
              <motion.p className="mt-5 font-mono leading-none font-semibold tracking-[0.08em]" style={{ clipPath: wipe }}>
                <span className="block text-[1.75rem]">X-VESOLJE</span>
                <span className="mt-3 block text-[3.5rem] tracking-[0.14em]">{CLAIM.code}</span>
              </motion.p>
              <p className="mt-6 border-t border-dashed border-paper-line pt-3 text-ui text-ink-muted">Write it big, in marker.</p>
            </Paper>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- 03 Live photo */

/** The captured photo as a print: a 3px paper border and the amber exhibit letter. */
function ExhibitPrint({ children, className, sizes }: { children?: ReactNode; className?: string; sizes: string }) {
  return (
    <div className={clsx("relative rounded-control bg-paper p-[3px] shadow-paper", className)}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-[3px] bg-surface-2">
        <Photo sizes={sizes} />
        {children}
      </div>
      <span className="absolute -top-2.5 -left-2.5 flex size-6 items-center justify-center rounded-control bg-accent font-mono text-micro font-semibold text-accent-ink">A</span>
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
          <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-[oklch(0.12_0.01_255)]">
            <Photo sizes="(min-width: 1024px) 640px, 320px" />
            <motion.span
              className="absolute rounded-2xl border-2 border-[oklch(1_0_0/0.85)] shadow-[0_0_0_100vmax_oklch(0_0_0/0.45)]"
              style={{ top, bottom: top, left, right: left }}
            />
            <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {["Label", "Cut in half", `Code ${CLAIM.code}`].map((c) => (
                <span key={c} className={clsx(CHIP, "bg-bg/80 text-text")}>
                  {c}
                </span>
              ))}
            </span>
            <span className={clsx(CHIP, "absolute top-3 right-3 bg-accent text-accent-ink @max-[719px]:hidden")}>Exhibit A</span>
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
                    <span className="absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-[3px] bg-accent font-mono text-micro font-semibold text-accent-ink">
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
  const check = CHECKS[i];
  const t = useTransform(p, (v) => ramp(v, TICK_AT[i] - 0.006, TICK_AT[i] + 0.006));
  const scale = useTransform(t, [0, 1], [0.4, 1]);
  const text = useTransform(t, [0, 1], [0.55, 1]);
  return (
    <li className="flex flex-col border-b border-line py-2 last:border-b-0 @min-[720px]:py-3">
      <div className="flex items-center gap-3">
        <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong">
          <motion.span className="absolute -inset-px flex items-center justify-center rounded-full bg-pay-soft text-pay" style={{ opacity: t, scale }}>
            <CheckIcon size={14} />
          </motion.span>
        </span>
        <motion.span className="text-body" style={{ opacity: text }}>
          {check.label}
        </motion.span>
        <span className={clsx(CHIP, "ml-auto shrink-0 border", check.ai ? "border-accent/40 text-accent-text" : "border-line text-muted")}>
          {check.ai ? "Model reads" : "No AI"}
        </span>
      </div>
      {check.quote && (
        <motion.p data-quote={check.region} className="mt-2 border-l border-line-strong pl-3 font-mono text-micro text-pretty text-muted @min-[720px]:ml-9" style={{ opacity: t }}>
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
        className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent font-mono text-micro font-semibold text-accent-ink @min-[720px]:hidden"
        style={{ left: `${(r.x + r.w / 2) * 100}%`, top: `${(r.y + r.h / 2) * 100}%` }}
      >
        {n}
      </span>
    </>
  );
}

type Leader = { id: RegionId; d: string; x2: number; y2: number };

export function ChecksChapter({ p }: { p: Progress }) {
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
      const y1 = (q.top - o.top) / k + 9;
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
        <ExhibitPrint sizes="(min-width: 1024px) 560px, 320px" className="mx-auto w-2/3 @min-[720px]:w-auto">
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

function Digit({ p, d, i }: { p: Progress; d: number; i: number }) {
  // An odometer wheel: 0 to 9 stacked, rolled up to d between 0.82 and 0.86, the later wheels a little behind.
  const y = useTransform(p, (v) => `${(-d * outQuart(ramp(v, 0.82 + i * 0.004, 0.848 + i * 0.004))).toFixed(3)}em`);
  return (
    <span className={styles.wheel}>
      <motion.span className={styles.strip} style={{ y }}>
        {"0123456789".split("").map((n) => (
          <span key={n}>{n}</span>
        ))}
      </motion.span>
      {/* Sizes the wheel to its own digit, so proportional widths stay right at rest. */}
      <span className={styles.sizer}>{d}</span>
    </span>
  );
}

/** $29.99 in the monumental serif, rolling up from $00.00. Screen readers and copy get the plain amount. */
export function Odometer({ p }: { p: Progress }) {
  const [whole, cents] = CLAIM.amount.toFixed(2).split(".");
  return (
    <span className={clsx("font-serif text-numeral font-normal italic tabular-nums", styles.odometer)}>
      <span className="sr-only select-none">${CLAIM.amount.toFixed(2)}</span>
      <span aria-hidden="true" className={styles.figure}>
        <span>$</span>
        {whole.split("").map((n, i) => (
          <Digit key={i} p={p} d={Number(n)} i={i} />
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
  const decided = useTransform(p, (v) => ramp(v, 0.805, 0.815));
  return (
    <div className="@container">
      <div className="grid items-center gap-10 @min-[720px]:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] @min-[720px]:gap-16">
        <div className="flex flex-col gap-5">
          <p className="text-head-sm font-medium">
            A fixed rule decides. <span className="text-muted">The model only says what it sees.</span>
          </p>
          <div className="flex flex-col rounded-card border border-line bg-surface font-mono text-micro @min-[720px]:text-ui">
            {RULE.map((r) => (
              <div key={r.when} className={clsx("relative flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0", r.pay && "pr-10 @min-[720px]:pr-4")}>
                <span className="flex-1 text-muted @min-[720px]:w-[18ch] @min-[720px]:flex-none">{r.when}</span>
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
        <div className="flex flex-col gap-4">
          <span className="micro text-faint">Sent to the owner&rsquo;s PayPal account</span>
          <Odometer p={p} />
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-ui text-muted">
            <span className="text-pay">sent to PayPal · {CLAIM.seconds} s after the photo</span>
            <span className="text-faint">
              Claim {CLAIM.id} · PayPal sandbox
            </span>
          </p>
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

function ConsoleRow({ row, first }: { row: (typeof CONSOLE_ROWS)[number] & { id?: string }; first?: boolean }) {
  return (
    <div className={clsx(GRID, "h-14 border-b border-line text-ui")}>
      <span className="flex min-w-0 items-center gap-3">
        <Thumb src={row.photo} />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="flex items-center gap-1.5 font-mono font-medium">
            {row.code}
            {row.sample && <span className="size-1.5 rotate-45 border border-faint" title="Sample claim" />}
          </span>
          <span className="truncate font-mono text-micro text-faint">{row.id ?? "sample"}</span>
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
        {row.amount ? <Money value={row.amount} size="grid" /> : <span className="text-faint">—</span>}
      </span>
    </div>
  );
}

export function ConsoleChapter({ p }: { p: Progress }) {
  const height = useTransform(p, (v) => `${(outQuart(ramp(v, 0.915, 0.95)) * 3.5).toFixed(3)}rem`);
  const opacity = useTransform(p, (v) => ramp(v, 0.93, 0.95));
  const flash = useTransform(p, (v) => `color-mix(in oklch, var(--accent) ${(14 * (1 - ramp(v, 0.95, 1))).toFixed(2)}%, transparent)`);
  const m4t = { photo: CLAIM.photo, code: CLAIM.code, id: CLAIM.id, status: "paid" as const, reason: "Every check passed", time: `0:${String(CLAIM.seconds).padStart(2, "0")}`, amount: CLAIM.amount };
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
        <div className="overflow-hidden rounded-card bg-surface shadow-ring">
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
              <ConsoleRow row={m4t} first />
            </motion.div>
          </motion.div>
          {CONSOLE_ROWS.map((r) => (
            <ConsoleRow key={r.code} row={r} />
          ))}
        </div>
      </div>
    </div>
  );
}
