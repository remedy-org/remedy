import { z } from "zod";
import type { ClaimSummary } from "@/lib/store";
import { ClaimId, type Claim, type Reason, type Recall } from "@/lib/types";
import { formatMoney, reviewReasonText } from "./view";

// A company's decisions on the shared recall's starter claims. The claims sit in every workspace, so a decision is kept
// for the company in its own browser (a cookie the server reads): every tab, the ledger, Insights and the report agree,
// and the shared record stays held for the next company. Pure, so the console and its tests read it the same way.

export const STARTER_COOKIE = "remedy_decided";
// A year: the shared recall stays in the workspace, and so does what the company decided on it.
export const STARTER_MAX_AGE = 365 * 24 * 3600;

const Decision = z.object({
  k: z.enum(["approve", "reject"]),
  at: z.iso.datetime(),
  by: z.string().max(120),
  // The reason the owner reads, for a reject (the route caps it at 280).
  r: z.string().max(280).optional(),
});
export type StarterDecision = z.infer<typeof Decision>;
export type StarterDecisions = Record<string, StarterDecision>;

// p: the company the decisions belong to, so another company signing in on this browser never sees them.
const Cookie = z.object({ p: z.string(), d: z.record(ClaimId, Decision) });

/** The decisions this browser holds for this company: none for anyone else, or for a cookie that doesn't parse. */
export function parseDecisions(raw: string | undefined, payerId: string): StarterDecisions {
  if (!raw) return {};
  try {
    const parsed = Cookie.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return parsed.success && parsed.data.p === payerId ? parsed.data.d : {};
  } catch {
    return {};
  }
}

export const encodeDecisions = (payerId: string, d: StarterDecisions) => Buffer.from(JSON.stringify({ p: payerId, d }), "utf8").toString("base64url");

const approvedText = (by: string) => `Approved on review by ${by}`;
const plusSeconds = (iso: string, s: number) => new Date(Date.parse(iso) + s * 1000).toISOString();

/** A held starter claim as this company decided it: approved and paid, or rejected with its reason. Anything else as is. */
export function decideStarter(c: Claim, d: StarterDecision | undefined, recall: Pick<Recall, "refund">): Claim {
  if (!d || !c.seeded || c.decision !== "held") return c;
  if (d.k === "reject") {
    const text = reviewReasonText(d.r ?? "");
    return {
      ...c,
      decision: "rejected",
      reasons: [...c.reasons, { check: "review", outcome: "reject", text }],
      events: [...c.events, { at: d.at, type: "rejected", detail: `${text} (by ${d.by})` }],
    };
  }
  const sent = plusSeconds(d.at, 1);
  return {
    ...c,
    decision: "paid",
    reasons: [...c.reasons, { check: "review", outcome: "pass", text: approvedText(d.by) }],
    payout: { batchId: `SEED${c.id.slice(3)}`, status: "SUCCESS", updatedAt: sent, amount: recall.refund },
    events: [
      ...c.events,
      { at: d.at, type: "approved", detail: approvedText(d.by) },
      { at: sent, type: "payout_sent", detail: `Payout of ${formatMoney(recall.refund)} sent through PayPal` },
      { at: sent, type: "payout_updated", detail: "PayPal: SUCCESS" },
    ],
  };
}

/** The same decision on the claim's index row, so the grid, the ledger and the report count it without a claim read.
 * The row keeps its version: the panel reads the stored claim at it and decides it the same way (decideStarter). */
export function decideStarterRow(r: ClaimSummary, d: StarterDecision | undefined, recall: Pick<Recall, "refund">): ClaimSummary {
  if (!d || !r.seeded || r.decision !== "held") return r;
  const review: Reason = d.k === "approve" ? { check: "review", outcome: "pass", text: approvedText(d.by) } : { check: "review", outcome: "reject", text: reviewReasonText(d.r ?? "") };
  const checks = [...(r.checks ?? []), { check: review.check, outcome: review.outcome }];
  if (d.k === "reject") return { ...r, decision: "rejected", reason: review, checks };
  const sent = plusSeconds(d.at, 1);
  return { ...r, decision: "paid", reason: review, checks, payoutStatus: "SUCCESS", payoutAmount: recall.refund, times: { ...r.times, sent, settled: sent } };
}

/** Every row as this company decided it. */
export const withDecisions = (rows: ClaimSummary[], d: StarterDecisions, recall: Pick<Recall, "refund">) =>
  Object.keys(d).length ? rows.map((r) => decideStarterRow(r, d[r.id], recall)) : rows;
