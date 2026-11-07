// The check funnel's arithmetic, shared by the server's facts and the Check funnel widget. Pure.

/** How far a claim got, in order. Every claim reaches "Filed"; it stops at the last stage it passed. */
export const STAGES = ["Filed", "Photos sent", "Passed pre-checks", "Passed photo check", "Paid"] as const;
export type Stage = (typeof STAGES)[number];

export interface FunnelStep {
  stage: Stage;
  /** Claims that got at least this far. */
  reached: number;
  /** Claims that got this far and no further. */
  stopped: number;
  /** The commonest reason the stopped ones went no further. */
  topReason: string | null;
  /** How many different reasons they stopped for. */
  reasons: number;
}

/** Rows are claims, or groups of claims with a count (as a Studio query returns them). */
export function funnel(rows: { stage: string; stopReason: string | null; count?: number }[]): FunnelStep[] {
  const weight = (r: { count?: number }) => r.count ?? 1;
  return STAGES.map((stage, i) => {
    const reached = rows.filter((r) => STAGES.indexOf(r.stage as Stage) >= i).reduce((n, r) => n + weight(r), 0);
    const tally = new Map<string, number>();
    let stopped = 0;
    for (const r of rows) {
      if (r.stage !== stage || !r.stopReason) continue;
      stopped += weight(r);
      tally.set(r.stopReason, (tally.get(r.stopReason) ?? 0) + weight(r));
    }
    const top = [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    return { stage, reached, stopped, topReason: top?.[0] ?? null, reasons: tally.size };
  });
}
