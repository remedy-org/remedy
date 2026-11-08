import { toDrawerClaim } from "@/app/console/_lib/drawer";
import { amountOf, cents, reasonOf } from "@/app/console/_lib/view";
import { APPEAL_CHECK } from "@/lib/appeal";
import { summarize } from "@/lib/store/store";
import type { Claim, Decision, Recall } from "@/lib/types";
import type { Stage } from "@/components/insights/funnel";

export { funnel, STAGES } from "@/components/insights/funnel";

// The Insights page's data, built on the server from the claim files. Pure, so every number is unit-tested. The
// client turns these rows into AG Studio data sources; the agent's tools read the dossiers.

export const DECISION_LABEL: Record<Decision, string> = {
  paid: "Paid",
  held: "Held",
  rejected: "Rejected",
  blocked: "Blocked",
  pending: "In progress",
};

// The order every chart, the funnel and the agent list decisions in, which is also the chart palette's order.
export const DECISION_RANK: Record<Decision, number> = { paid: 1, held: 2, rejected: 3, blocked: 4, pending: 5 };

// The same wording as the CPSC report (console/_lib/report.ts), so the two pages never disagree.
const REFUSAL: Record<string, string> = {
  code: "One-time code missing or wrong",
  screen: "Photo of a screen or a print",
  label: "Label missing or not the recalled product",
  same_item: "Photos showed different items",
  step: "Destruction not shown",
  session: "Photos outside the live camera session",
  duplicate_photo: "Photo already used in another claim",
  payer: "Second claim from one PayPal account",
  payer_verified: "PayPal account not verified",
  review: "Rejected by a person on review",
};

export const refusalLabel = (check: string) => REFUSAL[check.startsWith("step_") ? "step" : check] ?? "Other";

const PRE_CHECKS = new Set(["session", "duplicate_photo", "payer", "payer_verified"]);

export type Source = "Starter" | "Demo" | "Owner";

export interface ClaimFact {
  id: string;
  filedAt: string;
  /** "Paid", "Held"... */
  decision: string;
  decisionRank: number;
  /** Why a refused claim was refused, in the CPSC report's words; null otherwise. */
  refusalReason: string | null;
  /** Which kind of check refused it: a pre-check that needs no AI, the model reading the photo, or a person. */
  refusalGate: "No AI" | "Model reads" | "Person" | null;
  /** The check that refused or held it ("code", "same_item"); null when nothing did. */
  failedCheck: string | null;
  /** The grid's one-line reason. */
  reason: string;
  /** Where the claim came from: the eval samples seeded in every console, the judges' demo, or a real owner. */
  source: Source;
  payer: string;
  verified: boolean;
  /** Dollars the rule paid; 0 unless paid. A sample claim's amount was decided, never sent. */
  amountPaid: number;
  /** Dollars really sent through PayPal (sandbox in this build): 0 for a sample claim, whose payout never left. */
  amountSent: number;
  /** The grid's refund cell, as the console's payout cell says it: "$29.99", "$29.99 · not sent" for a sample, or "—". */
  refund: string;
  /** 1 when paid: a unit taken out of use and refunded. */
  remedied: number;
  /** 1 when a sample claim was "paid": counted in remedied, but no money ever reached a real owner. */
  remediedSample: number;
  refused: number;
  held: number;
  /** Seconds from the photos arriving to the payout being sent; null unless paid. A sample claim's are made up. */
  timeToPaySec: number | null;
  /** The same, for payouts really sent through PayPal only; null for a sample claim. */
  timeToSendSec: number | null;
  /** 1 when it was paid only after a person approved it on review: its time to pay includes the wait for that person. */
  paidOnReview: number;
  /** Seconds from the photos arriving to the model's answer; null when the model never ran. */
  modelSec: number | null;
  photoCount: number;
  payoutStatus: string | null;
  /** The last stage it passed, and why it went no further. */
  stage: Stage;
  stopReason: string | null;
}

export interface CheckFact {
  id: string;
  claimId: string;
  check: string;
  stage: "Pre-check" | "Photo check";
  outcome: "Passed" | "Held" | "Refused";
}

/** What the agent may quote for one claim: the model's evidence verbatim, the rule's sentence, never a full payer id. */
export interface Dossier {
  id: string;
  decision: string;
  filedAt: string;
  code: string;
  source: Source;
  sentence: string;
  summary: string | null;
  amount: string;
  checks: { label: string; outcome: string; rule: string; evidence: string | null }[];
  preChecks: { label: string; state: string; detail: string }[];
  photo: string | null;
  reviewable: boolean;
}

export interface InsightsRecall {
  id: string;
  product: string;
  slug: string;
  unitsSold: number;
  refund: number;
  autoPay: boolean;
}

export interface InsightsData {
  recall: InsightsRecall;
  claims: ClaimFact[];
  checks: CheckFact[];
  dossiers: Record<string, Dossier>;
  /** Built at, ISO. */
  asOf: string;
}

const seconds = (from: string | undefined, to: string | undefined) => (from && to ? Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000)) : null);
const at = (c: Claim, type: string) => c.events.find((e) => e.type === type)?.at;

export const sourceOf = (c: Pick<Claim, "seeded" | "demo">): Source => (c.seeded ? "Starter" : c.demo ? "Demo" : "Owner");

function stageOf(c: Claim): { stage: Stage; stopReason: string | null } {
  if (c.decision === "paid") return { stage: "Paid", stopReason: null };
  if (!c.photos.length && c.decision !== "blocked") return { stage: "Filed", stopReason: "No photos yet" };
  const refusedBy = c.reasons.find((r) => r.outcome === "reject");
  if (c.decision === "blocked" || (refusedBy && PRE_CHECKS.has(refusedBy.check))) {
    return { stage: "Photos sent", stopReason: refusedBy ? refusalLabel(refusedBy.check) : "Blocked by a pre-check" };
  }
  if (c.decision === "pending") return { stage: "Passed pre-checks", stopReason: "Photo check running" };
  const model = c.reasons.filter((r) => !PRE_CHECKS.has(r.check) && r.check !== "review" && r.check !== APPEAL_CHECK && r.check !== "state");
  const failed = model.find((r) => r.outcome === "reject") ?? model.find((r) => r.outcome === "hold");
  if (failed) return { stage: "Passed pre-checks", stopReason: failed.outcome === "reject" ? refusalLabel(failed.check) : failed.text };
  if (c.decision === "rejected") return { stage: "Passed photo check", stopReason: refusalLabel(refusedBy?.check ?? "review") };
  // Held with every check passed: auto-pay off, or a payout that couldn't be sent.
  return { stage: "Passed photo check", stopReason: c.reasons.find((r) => r.outcome === "hold")?.text ?? "Held for a person" };
}

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function claimFact(c: Claim, recall: Recall): ClaimFact {
  const failed = c.reasons.find((r) => r.outcome === "reject") ?? c.reasons.find((r) => r.outcome === "hold") ?? null;
  const refused = c.decision === "rejected" || c.decision === "blocked";
  const refusedBy = c.reasons.find((r) => r.outcome === "reject");
  const photosIn = at(c, "photos_received");
  return {
    id: c.id,
    filedAt: c.createdAt,
    decision: DECISION_LABEL[c.decision],
    decisionRank: DECISION_RANK[c.decision],
    refusalReason: refused ? refusalLabel(refusedBy?.check ?? "") : null,
    refusalGate: !refused ? null : refusedBy?.check === "review" ? "Person" : !refusedBy || PRE_CHECKS.has(refusedBy.check) ? "No AI" : "Model reads",
    failedCheck: failed?.check ?? null,
    reason: reasonOf(summarize(c), recall),
    source: sourceOf(c),
    payer: `•••• ${c.payerId.slice(-4)}`,
    verified: c.payerVerified,
    amountPaid: c.decision === "paid" ? cents(amountOf(c.payout?.amount, recall)) / 100 : 0,
    amountSent: c.decision === "paid" && !c.seeded ? cents(amountOf(c.payout?.amount, recall)) / 100 : 0,
    // As the queue's payout column: what a paid or held claim pays; "approved" on a starter claim (the rule approved it, and
    // starter claims never pay out) and "not sent" on a held one.
    refund:
      c.decision !== "paid" && c.decision !== "held"
        ? "—"
        : `${dollars.format(cents(amountOf(c.payout?.amount, recall)) / 100)}${c.decision === "held" ? " · not sent" : c.seeded ? " · approved" : ""}`,
    remedied: c.decision === "paid" ? 1 : 0,
    remediedSample: c.decision === "paid" && c.seeded ? 1 : 0,
    refused: refused ? 1 : 0,
    held: c.decision === "held" ? 1 : 0,
    timeToPaySec: c.decision === "paid" ? seconds(photosIn, at(c, "payout_sent")) : null,
    timeToSendSec: c.decision === "paid" && !c.seeded ? seconds(photosIn, at(c, "payout_sent")) : null,
    paidOnReview: c.decision === "paid" && c.reasons.some((r) => r.check === "review" && r.outcome === "pass") ? 1 : 0,
    modelSec: seconds(photosIn, at(c, "checked")),
    photoCount: c.photos.length,
    payoutStatus: c.payout?.status ?? null,
    ...stageOf(c),
  };
}

export function checkFacts(c: Claim): CheckFact[] {
  return c.reasons
    .filter((r) => r.check !== "review" && r.check !== APPEAL_CHECK && r.check !== "state")
    .map((r) => ({
      id: `${c.id}:${r.check}`,
      claimId: c.id,
      check: checkName(r.check),
      stage: PRE_CHECKS.has(r.check) ? ("Pre-check" as const) : ("Photo check" as const),
      outcome: r.outcome === "pass" ? ("Passed" as const) : r.outcome === "hold" ? ("Held" as const) : ("Refused" as const),
    }));
}

const CHECK_NAME: Record<string, string> = {
  session: "Live camera session",
  duplicate_photo: "Photo not seen before",
  payer: "One claim per account",
  payer_verified: "Verified PayPal account",
  label: "Label",
  code: "One-time code",
  same_item: "Same item",
  screen: "Real photo",
};

function checkName(check: string): string {
  if (CHECK_NAME[check]) return CHECK_NAME[check];
  const step = check.match(/^step_(\d+)$/);
  return step ? `Step ${step[1]}` : check;
}

export function dossier(c: Claim, recall: Recall): Dossier {
  const d = toDrawerClaim(c, recall);
  return {
    id: d.id,
    decision: DECISION_LABEL[d.decision],
    filedAt: d.createdAt,
    code: d.code,
    source: sourceOf(c),
    sentence: d.sentence,
    summary: d.summary,
    amount: d.amount,
    checks: d.checks.map((k) => ({ label: k.label, outcome: k.outcome, rule: k.rule, evidence: k.evidence })),
    preChecks: d.preChecks.map((p) => ({ label: p.label, state: p.state, detail: p.detail })),
    photo: d.photos[0] ?? null,
    reviewable: d.decision === "held",
  };
}

export function buildInsights(claims: Claim[], recall: Recall, now: Date): InsightsData {
  return {
    recall: {
      id: recall.id,
      product: recall.product,
      slug: recall.slug,
      unitsSold: recall.unitsSold,
      refund: cents(recall.refund) / 100,
      autoPay: recall.autoPay,
    },
    claims: claims.map((c) => claimFact(c, recall)),
    checks: claims.flatMap(checkFacts),
    dossiers: Object.fromEntries(claims.map((c) => [c.id, dossier(c, recall)])),
    asOf: now.toISOString(),
  };
}
