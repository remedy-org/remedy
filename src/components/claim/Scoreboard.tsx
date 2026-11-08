import clsx from "clsx";
import type { ReactNode } from "react";
import { CheckIcon, CrossIcon, StatusPill, statusLabel } from "@/components/ui";
import { DEMO_SAMPLES, type DemoSample } from "@/lib/demo";
import type { Decision } from "@/lib/types";

/** One sample's latest run in this browser's demo round: the decision the pipeline actually reached. */
export interface RoundRun {
  sample: string;
  decision: Decision;
  /** Held because the photo model gave no answer (noModelAnswer): Remedy's fallback, scored apart from the misses. */
  unanswered?: boolean;
}

/** The round's runs that reached a decision, newest first per sample, keyed by sample id. */
export function latestRuns(runs: RoundRun[]): Map<string, RoundRun> {
  const out = new Map<string, RoundRun>();
  for (const r of runs) if (r.decision !== "pending" && !out.has(r.sample)) out.set(r.sample, r);
  return out;
}

/** How a sample's latest run compares with what it should do. */
export type RunMark = "expected" | "missed" | "unanswered";

export function runMark(sample: DemoSample, run: RoundRun): RunMark {
  return run.unanswered ? "unanswered" : run.decision === sample.expect ? "expected" : "missed";
}

/**
 * "3 of 4 run · all as expected": the judge-facing proof that the rule behaves, from this round's own claims. Runs the
 * model never answered are counted apart ("1 model unavailable"), not as misses.
 */
export function scoreLine(runs: RoundRun[]): { ran: number; expected: number; unanswered: number; text: string } {
  const latest = latestRuns(runs);
  const ran = DEMO_SAMPLES.filter((s) => latest.has(s.id));
  const marks = ran.map((s) => runMark(s, latest.get(s.id)!));
  const expected = marks.filter((m) => m === "expected").length;
  const unanswered = marks.filter((m) => m === "unanswered").length;
  const answered = ran.length - unanswered;
  const all = DEMO_SAMPLES.length;
  if (!ran.length) return { ran: 0, expected, unanswered, text: `0 of ${all} run` };
  const parts = [ran.length === all ? `All ${all} run` : `${ran.length} of ${all} run`];
  if (answered) parts.push(expected === answered && !unanswered && ran.length < all ? "all as expected" : `${expected} of ${answered} as expected`);
  if (unanswered) parts.push(`${unanswered} model unavailable`);
  return { ran: ran.length, expected, unanswered, text: parts.join(" · ") };
}

/** The round's end, in words: "Round complete: 4 of 4 as expected", the model's silences counted apart. */
export function roundLine(runs: RoundRun[]): string {
  const { ran, expected, unanswered } = scoreLine(runs);
  const answered = ran - unanswered;
  const parts = [answered ? `${expected} of ${answered} as expected` : "", unanswered ? `${unanswered} model unavailable` : ""].filter(Boolean);
  return `Round complete: ${parts.join(" · ")}`;
}

/** The first sample in the guided order (genuine, wrong code, upload, repost) this round hasn't run, if any. */
export function nextSample(runs: RoundRun[], except?: string): DemoSample | null {
  const ran = new Set(runs.map((r) => r.sample));
  return DEMO_SAMPLES.find((s) => s.id !== except && !ran.has(s.id)) ?? null;
}

/** A run's decision, then its mark in words and an icon: green tick, red cross, or neutral for the model's silence. */
export function RunResult({ sample, run, prefix, className }: { sample: DemoSample; run: RoundRun; prefix?: ReactNode; className?: string }) {
  const mark = runMark(sample, run);
  return (
    <span className={clsx("inline-flex items-center gap-2 whitespace-nowrap", className)}>
      {prefix}
      <StatusPill status={run.decision} />
      <span className={clsx("inline-flex items-center gap-1 text-ui", mark === "expected" ? "text-pay" : mark === "missed" ? "text-stop" : "text-muted")}>
        {mark === "expected" ? <CheckIcon size={14} /> : mark === "missed" ? <CrossIcon size={14} /> : null}
        {mark === "expected" ? "As expected" : mark === "missed" ? `Expected ${statusLabel(sample.expect).toLowerCase()}` : "Model unavailable"}
      </span>
    </span>
  );
}

/**
 * The round as a scorecard: one row per sample in the guided order, lettered A to D, with what its latest run got and
 * whether that was the expected outcome, in words beside its own row; then the line in words, unless `complete`: the
 * round-complete line above already says it.
 */
export function Scoreboard({ runs, complete, className }: { runs: RoundRun[]; complete?: boolean; className?: string }) {
  const latest = latestRuns(runs);
  const { text } = scoreLine(runs);
  return (
    <div className={clsx("flex flex-col gap-3", className)}>
      <ol className="flex flex-col" aria-label="This round's claims">
        {DEMO_SAMPLES.map((s, i) => {
          const run = latest.get(s.id);
          const letter = String.fromCharCode(65 + i);
          return (
            <li key={s.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-3 border-b border-line py-2.5 text-ui last:border-b-0">
              <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-control border border-line-2 font-mono text-ui font-medium text-text">
                {letter}
              </span>
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="text-text">
                  <span className="sr-only">Claim {letter}: </span>
                  {s.title}
                </span>
                {run ? <RunResult sample={s} run={run} className="flex-wrap" /> : <span className="text-faint">Not run yet · ends {statusLabel(s.expect).toLowerCase()}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {!complete && <span className="font-mono text-micro text-muted">{text}</span>}
    </div>
  );
}
