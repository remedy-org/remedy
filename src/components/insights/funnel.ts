// The check funnel's arithmetic, shared by the server's facts and the Check funnel widget. Pure.

/** How far a claim got, in order. Every claim reaches "Filed"; it stops at the last stage it passed. */
export const STAGES = ["Filed", "Photos sent", "Passed pre-checks", "Passed photo check", "Paid"] as const;
export type Stage = (typeof STAGES)[number];

/** How the report shows a decision or a stage: "Paid" reads as "Approved", as the console's pill does, since "paid"
 * belongs only beside a payout really sent. The data keeps its own values, so filters still match. */
export const shownAs = (value: string) => (value === "Paid" ? "Approved" : value);

/**
 * Why a claim stopped where it did: refused by a check (rejected or blocked, drawn in --stop), held for a person
 * (waiting, drawn in --hold, never counted as refused), or still in progress.
 */
export type StopKind = "refused" | "held" | "waiting";
export const STOP_KINDS: StopKind[] = ["refused", "held", "waiting"];

export const kindOf = (decision: string | null | undefined): StopKind =>
  decision === "Held" ? "held" : decision === "Rejected" || decision === "Blocked" ? "refused" : "waiting";

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

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n: number) => WORDS[n] ?? String(n);

/**
 * One line for a set of reasons and their counts. One reason: its name. A clear commonest reason: it, with its share
 * ("Photo of a screen or a print · 3 of 6"). Reasons tied for commonest: how many and how often, without picking one.
 */
export function reasonSummary(tally: ReadonlyMap<string, number>): string {
  const sorted = [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!sorted.length) return "";
  const total = sorted.reduce((n, [, c]) => n + c, 0);
  const [top, n] = sorted[0];
  if (sorted.length === 1) return top;
  const tied = sorted.filter(([, c]) => c === n).length;
  if (tied === 1) return `${top} · ${n} of ${total}`;
  if (tied === sorted.length) return `${word(tied)} reasons, ${n} each`;
  return `${word(tied)} reasons tied at ${n}, and ${sorted.length - tied} more`;
}

/** Rows are claims, or groups of claims with a count (as a Studio query returns them). */
export function funnel(rows: { stage: string; stopReason: string | null; decision?: string | null; count?: number }[]): FunnelStep[] {
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
      return [{ kind, count, summary: reasonSummary(tally) }];
    });
    return { stage, reached, stopped, groups };
  });
}

/** The words each kind of stop is labelled with. */
export const KIND_LABEL: Record<StopKind, string> = { refused: "refused", held: "held for a person", waiting: "in progress" };
