// The check funnel's arithmetic, shared by the server's facts and the Check funnel widget. Pure.

/** How far a claim got, in order. Every claim reaches "Filed"; it stops at the last stage it passed. */
export const STAGES = ["Filed", "Photos sent", "Passed account checks", "Passed photo check", "Paid"] as const;
export type Stage = (typeof STAGES)[number];

/** How the report shows a decision or a stage: as the console's verdict says it ("Paid" once PayPal settled it, which
 * every paid claim in the console has). One place, so the page never says a word the queue doesn't. */
export const shownAs = (value: string) => value;

/**
 * Why a claim stopped where it did: refused by a check (rejected or blocked, drawn in --stop), held for a person
 * (waiting, drawn in --hold, never counted as refused), or still in progress.
 */
export type StopKind = "refused" | "held" | "approved" | "waiting";
export const STOP_KINDS: StopKind[] = ["refused", "held", "approved", "waiting"];

export const kindOf = (decision: string | null | undefined): StopKind =>
  decision === "Held" ? "held" : decision === "Rejected" || decision === "Blocked" ? "refused" : decision === "Paid" ? "approved" : "waiting";

export interface StopGroup {
  kind: StopKind;
  count: number;
  /** The reasons in words, with their counts: never a tie presented as the top reason. */
  summary: string;
}

export interface FunnelStep {
  stage: Stage;
  /** Claims that got at least this far. */
  reached: number;
  /** Claims that got this far and no further. */
  stopped: number;
  /** The stopped claims by kind, refused first; empty kinds are left out. */
  groups: StopGroup[];
}

/**
 * One line for a set of reasons and their counts: the reasons themselves, commonest first, each with its count when the
 * counts differ ("Photo of a screen or a print 2, Code missing or wrong 1"). Never a templated count of reasons, and
 * never a tie presented as the top reason.
 */
export function reasonSummary(tally: ReadonlyMap<string, number>): string {
  const sorted = [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const even = sorted.every(([, c]) => c === sorted[0]?.[1]);
  return sorted.map(([reason, n]) => (even ? reason : `${reason} ${n}`)).join(", ");
}

/** Every reason with its count, commonest first: "Photo already used in another claim (2), PayPal account not verified (1)". */
export function reasonList(tally: ReadonlyMap<string, number>): string {
  const sorted = [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return sorted.length === 1 ? sorted[0][0] : sorted.map(([r, n]) => `${r} (${n})`).join(", ");
}

/**
 * Rows are claims, or groups of claims with a count (as a Studio query returns them). `summarize` words each drop's
 * reasons: by default the commonest (reasonSummary); the homepage names every one (reasonList).
 */
export function funnel(
  rows: { stage: string; stopReason: string | null; decision?: string | null; count?: number }[],
  summarize: (tally: ReadonlyMap<string, number>) => string = reasonSummary,
): FunnelStep[] {
  const weight = (r: { count?: number }) => r.count ?? 1;
  return STAGES.map((stage, i) => {
    const reached = rows.filter((r) => STAGES.indexOf(r.stage as Stage) >= i).reduce((n, r) => n + weight(r), 0);
    const tallies = new Map<StopKind, Map<string, number>>();
    let stopped = 0;
    for (const r of rows) {
      if (r.stage !== stage || !r.stopReason) continue;
      stopped += weight(r);
      const kind = kindOf(r.decision);
      const tally = tallies.get(kind) ?? new Map<string, number>();
      tally.set(r.stopReason, (tally.get(r.stopReason) ?? 0) + weight(r));
      tallies.set(kind, tally);
    }
    const groups = STOP_KINDS.flatMap((kind) => {
      const tally = tallies.get(kind);
      if (!tally) return [];
      const count = [...tally.values()].reduce((a, b) => a + b, 0);
      return [{ kind, count, summary: summarize(tally) }];
    });
    return { stage, reached, stopped, groups };
  });
}

/** The words each kind of stop is labelled with. */
// A claim approved with nothing sent stops short of Paid as the console's Approved, never "in progress".
export const KIND_LABEL: Record<StopKind, string> = { refused: "refused", held: "held for a person", approved: "approved", waiting: "in progress" };
