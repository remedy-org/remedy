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

/** "2 of 4 run": how far this browser's round has got. */
export function ranLine(runs: RoundRun[]): string {
  const latest = latestRuns(runs);
  return `${DEMO_SAMPLES.filter((s) => latest.has(s.id)).length} of ${DEMO_SAMPLES.length} run`;
}

/** The first sample in the guided order (genuine, wrong code, upload, repost) this round hasn't run, if any. */
export function nextSample(runs: RoundRun[], except?: string): DemoSample | null {
  const ran = new Set(runs.map((r) => r.sample));
  return DEMO_SAMPLES.find((s) => s.id !== except && !ran.has(s.id)) ?? null;
}
