import clsx from "clsx";
import { CheckIcon, CrossIcon } from "@/components/ui";
import { DEMO_SAMPLES, type DemoSample } from "@/lib/demo";
import type { Decision } from "@/lib/types";

/** One sample's latest run in this browser's demo round: the decision the pipeline actually reached. */
export interface RoundRun {
  sample: string;
  decision: Decision;
}

const FILL: Record<Decision, string> = {
  paid: "bg-pay border-pay",
  held: "bg-hold border-hold",
  rejected: "bg-stop border-stop",
  blocked: "bg-stop border-stop",
  pending: "border-line-strong",
};

/** The round's runs that reached a decision, newest first per sample, keyed by sample id. */
export function latestRuns(runs: RoundRun[]): Map<string, Decision> {
  const out = new Map<string, Decision>();
  for (const r of runs) if (r.decision !== "pending" && !out.has(r.sample)) out.set(r.sample, r.decision);
  return out;
}

/** "3 of 4 run · all as expected": the judge-facing proof that the rule behaves, from this round's own claims. */
export function scoreLine(runs: RoundRun[]): { ran: number; expected: number; text: string } {
  const latest = latestRuns(runs);
  const ran = DEMO_SAMPLES.filter((s) => latest.has(s.id));
  const expected = ran.filter((s) => latest.get(s.id) === s.expect).length;
  const all = DEMO_SAMPLES.length;
  let text: string;
  if (!ran.length) text = `0 of ${all} run`;
  else if (ran.length === all) text = `All ${all} run · ${expected} of ${all} as expected`;
  else text = `${ran.length} of ${all} run · ${expected === ran.length ? "all as expected" : `${expected} of ${ran.length} as expected`}`;
  return { ran: ran.length, expected, text };
}

/** The first sample in the guided order (genuine, wrong code, AI image, repost) this round hasn't run, if any. */
export function nextSample(runs: RoundRun[], except?: string): DemoSample | null {
  const ran = new Set(runs.map((r) => r.sample));
  return DEMO_SAMPLES.find((s) => s.id !== except && !ran.has(s.id)) ?? null;
}

/**
 * Four 10px squares, one per sample in the guided order and lettered A to D under it, each in the colour of the
 * decision this round's run actually reached, with a tick when it was the expected one; then the line in words. Every
 * slot is the same width, so a tick never shifts the next square.
 */
export function Scoreboard({ runs, className }: { runs: RoundRun[]; className?: string }) {
  const latest = latestRuns(runs);
  const { text } = scoreLine(runs);
  return (
    <div className={clsx("flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      <ol className="flex items-start gap-1" aria-label="This round's samples">
        {DEMO_SAMPLES.map((s, i) => {
          const got = latest.get(s.id);
          const ok = got === s.expect;
          const letter = String.fromCharCode(65 + i);
          return (
            <li key={s.id} className="grid w-6 grid-cols-[10px_12px] items-center gap-x-0.5 gap-y-1" title={`${s.title}: ${got ? `${got}, expected ${s.expect}` : "not run yet"}`}>
              <span className="sr-only">
                {letter}, {s.title}: {got ? `${got}${ok ? ", as expected" : `, expected ${s.expect}`}` : "not run yet"}.
              </span>
              <span aria-hidden="true" className={clsx("size-2.5 rounded-[2px] border", got ? FILL[got] : "border-line-strong")} />
              <span aria-hidden="true" className={clsx("flex size-3 items-center", ok ? "text-pay" : "text-stop")}>
                {got && (ok ? <CheckIcon size={12} /> : <CrossIcon size={12} />)}
              </span>
              <span aria-hidden="true" className="text-center font-mono text-[10px] leading-none text-faint">
                {letter}
              </span>
            </li>
          );
        })}
      </ol>
      <span className="font-mono text-micro text-muted tabular-nums">{text}</span>
    </div>
  );
}
