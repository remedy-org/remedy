import type { Claim, Decision, Money, Reason, Recall } from "@/lib/types";

// Pure view helpers for the console: grid rows, header numbers, the rule's sentence. No I/O, so they are unit-tested.

export const cents = (m: Pick<Money, "value">) => Math.round(Number(m.value) * 100);

export function formatCents(c: number): string {
  return `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const formatMoney = (m: Pick<Money, "value">) => formatCents(cents(m));

/** What a claim pays or paid: the amount fixed at pay time, else the recall's current refund (held, or paid before
 * amounts were recorded). Changing the refund never reprices money already sent. */
export const amountOf = (c: Pick<Claim, "payout">, recall: Pick<Recall, "refund">): Money => c.payout?.amount ?? recall.refund;

// PayPal payer ids are 13 characters; the console shows the last four, enough to tell accounts apart.
export const maskPayer = (payerId: string) => `•••• ${payerId.slice(-4)}`;

export interface ClaimRow {
  id: string;
  createdAt: string;
  payer: string;
  verified: boolean;
  decision: Decision;
  reason: string;
  // PayPal's own status string (SUCCESS, PENDING, ...), or null before a payout.
  payoutStatus: string | null;
  // Paid or waiting to be paid: the refund. Refused claims carry no amount.
  amount: string | null;
  seeded: boolean;
  demo: boolean;
}

const first = (reasons: Reason[], outcome: Reason["outcome"]) => reasons.find((r) => r.outcome === outcome)?.text;

// One line for the grid: why the claim is where it is.
export function reasonOf(c: Pick<Claim, "decision" | "reasons" | "photos" | "payout">, recall: Pick<Recall, "autoPay">): string {
  switch (c.decision) {
    case "paid":
      return c.reasons.some((r) => r.check === "review") ? "Approved on review" : "Every check passed";
    case "held":
      return first(c.reasons, "hold") ?? (recall.autoPay ? "Every check passed; held for a person" : "Every check passed; auto-pay is off");
    case "rejected":
    case "blocked":
      return first(c.reasons, "reject") ?? "Refused";
    case "pending":
      return c.photos.length ? "Checking the photos" : "Waiting for photos";
  }
}

export function toRow(c: Claim, recall: Recall): ClaimRow {
  return {
    id: c.id,
    createdAt: c.createdAt,
    payer: maskPayer(c.payerId),
    verified: c.payerVerified,
    decision: c.decision,
    reason: reasonOf(c, recall),
    payoutStatus: c.payout?.status ?? null,
    amount: c.decision === "paid" || c.decision === "held" ? formatMoney(amountOf(c, recall)) : null,
    seeded: Boolean(c.seeded),
    demo: Boolean(c.demo),
  };
}

export interface Stats {
  total: number;
  remedied: number;
  unitsSold: number;
  paidCents: number;
  // Paid claims whose payout PayPal hasn't confirmed yet.
  settling: number;
  held: number;
  rejected: number;
  blocked: number;
  pending: number;
}

const SETTLED = new Set(["SUCCESS"]);

export function statsOf(claims: Pick<Claim, "decision" | "payout">[], recall: Pick<Recall, "refund" | "unitsSold">): Stats {
  const count = (d: Decision) => claims.filter((c) => c.decision === d).length;
  const paid = claims.filter((c) => c.decision === "paid");
  return {
    total: claims.length,
    remedied: paid.length,
    unitsSold: recall.unitsSold,
    paidCents: paid.reduce((sum, c) => sum + cents(amountOf(c, recall)), 0),
    settling: paid.filter((c) => !SETTLED.has(c.payout?.status ?? "")).length,
    held: count("held"),
    rejected: count("rejected"),
    blocked: count("blocked"),
    pending: count("pending"),
  };
}

// "0.13%", or "<0.01%" for a sliver, so a first claim never reads as 0%.
export function percent(value: number, of: number): string {
  if (of <= 0) return "—";
  const p = (value / of) * 100;
  if (p > 0 && p < 0.01) return "<0.01%";
  return `${p.toLocaleString("en-US", { maximumFractionDigits: p < 10 ? 2 : 1 })}%`;
}

// The rule's decision in one sentence, for the evidence drawer.
export function decisionSentence(c: Pick<Claim, "decision" | "reasons" | "photos" | "payout">, recall: Pick<Recall, "autoPay" | "refund">): string {
  const amount = formatMoney(amountOf(c, recall));
  const reviewed = c.reasons.find((r) => r.check === "review");
  switch (c.decision) {
    case "paid":
      return reviewed ? `Approved on review, so Remedy paid ${amount} through PayPal.` : `Every check passed, so Remedy paid ${amount} through PayPal.`;
    case "held": {
      const hold = first(c.reasons, "hold");
      if (hold) return `One answer was unclear, so a person decides: ${lower(hold)}.`;
      return recall.autoPay ? "Every check passed, but the claim is held for a person." : `Every check passed. Auto-pay is off, so a person approves the ${amount} refund.`;
    }
    case "rejected":
      return reviewed ? `Rejected on review: ${stripPrefix(reviewed.text).replace(/[.\s]+$/, "")}.` : `A check failed, so no money moves: ${lower(first(c.reasons, "reject") ?? "refused")}.`;
    case "blocked":
      return `Stopped before the photos reached the model: ${lower(first(c.reasons, "reject") ?? "a pre-check failed")}.`;
    case "pending":
      return c.photos.length ? "The photos are with the model; the rule decides when it answers." : "The owner has a code and an open camera session, but no photos yet.";
  }
}

const REVIEW_PREFIX = "Rejected on review: ";
export const reviewReasonText = (reason: string) => `${REVIEW_PREFIX}${reason}`;
const stripPrefix = (t: string) => (t.startsWith(REVIEW_PREFIX) ? t.slice(REVIEW_PREFIX.length) : t);
const lower = (t: string) => (t ? t[0].toLowerCase() + t.slice(1) : t).replace(/[.\s]+$/, "");

export type PreCheckState = "pass" | "hold" | "reject" | "waiting" | "skipped";
export interface PreCheckRow {
  id: string;
  label: string;
  state: PreCheckState;
  detail: string;
}

// The four cheap checks that run before any photo reaches the model, rebuilt from the claim's reasons.
export function preChecksOf(c: Pick<Claim, "decision" | "reasons" | "photos" | "payerVerified" | "seeded">): PreCheckRow[] {
  const ran = c.photos.length > 0 || c.decision === "blocked";
  // preCheck rejects (the claim is blocked); sendCheck, run again right before a payout, holds.
  const failed = (check: string) => c.reasons.find((r) => r.check === check && r.outcome !== "pass");
  const row = (id: string, label: string, pass: string): PreCheckRow => {
    const f = failed(id);
    if (f) return { id, label, state: f.outcome === "reject" ? "reject" : "hold", detail: f.text };
    return ran ? { id, label, state: "pass", detail: pass } : { id, label, state: "waiting", detail: "Runs when the photos arrive" };
  };
  return [
    row("session", "Live camera session", "Taken in this claim's camera session, before it expired"),
    // Seeded claims share a handful of sample photos, so the fingerprint check was never run on them: say so rather
    // than show a pass next to another claim with the same photo.
    c.seeded
      ? { id: "duplicate_photo", label: "Photo not seen before", state: "skipped", detail: "Sample photo shared by the seeded claims, so this check wasn't run" }
      : row("duplicate_photo", "Photo not seen before", "No other claim used these photos"),
    row("payer", "First claim for this account", "No other live claim from this PayPal account"),
    row("payer_verified", "Verified PayPal account", "PayPal says the account is verified"),
  ];
}
