import { oneClaimChecked } from "@/lib/demo/samples";
import type { ClaimSummary } from "@/lib/store";
import type { Claim, Decision, Money, Reason, Recall } from "@/lib/types";

// Pure view helpers for the console: grid rows, header numbers, the rule's sentence. No I/O, so they are unit-tested.
// The grid, the stats and the report work from index.json's rows (ClaimSummary); only the drawer opens a claim.

export const cents = (m: Pick<Money, "value">) => Math.round(Number(m.value) * 100);

export function formatCents(c: number): string {
  return `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const formatMoney = (m: Pick<Money, "value">) => formatCents(cents(m));

/** What a claim pays or paid, given its payout's amount: the amount fixed at pay time, else the recall's current
 * refund (held, or paid before amounts were recorded). Changing the refund never reprices money already sent. */
export const amountOf = (paid: Money | null | undefined, recall: Pick<Recall, "refund">): Money => paid ?? recall.refund;

// PayPal payer ids are 13 characters; the console shows the last four, enough to tell accounts apart.
export const maskPayer = (payerId: string) => `•••• ${payerId.slice(-4)}`;

/** One bar of the evidence barcode: a check and how it came out. */
export type BarState = "pass" | "hold" | "reject" | "waiting" | "skipped";
export interface CheckBar {
  id: string;
  label: string;
  state: BarState;
}

/** Seconds after the photos arrived that each later money step happened, and where the claim stands. */
export interface RowTimeline {
  answered: number | null;
  decided: number | null;
  sent: number | null;
  settled: number | null;
  // paid: money sent (settled or settling); held: waiting for a person; stopped: refused; open: still checking.
  end: "paid" | "held" | "stopped" | "open";
}

/** A photo as the grid shows it: a 96px thumbnail and a 240px hover view. */
export interface RowPhoto {
  thumb: string;
  large: string;
}

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
  cents: number | null;
  seeded: boolean;
  demo: boolean;
  // The code written on the tag; null on rows from before the index carried it.
  code: string | null;
  // The index row's version (event count): the drawer asks for the claim at this version.
  version: number | null;
  photoCount: number;
  photos: RowPhoto[];
  // The pre-checks, then the model's checks; null on rows from before the index carried them.
  bars: CheckBar[] | null;
  // The verdict's muted line, only when it says more than the pill.
  note: string | null;
  // A held claim whose last approve PayPal refused: when (ISO). Null otherwise.
  payoutFailedAt: string | null;
  // Null until photos arrive (or on rows from before the index carried times).
  timeline: RowTimeline | null;
  // Photos to PayPal sending the money, in seconds. Null for sample claims: their payouts were never sent.
  toPay: number | null;
  // Photos to the model's answer, in seconds (the eval run's own time on a sample claim).
  modelSec: number | null;
}

// The pre-checks every claim goes through before the model, in order, and their labels.
const PRE_CHECKS: [string, string][] = [
  ["session", "Live camera session"],
  ["duplicate_photo", "Photo not seen before"],
  ["payer", "One claim per account"],
  ["payer_verified", "Verified PayPal account"],
];
const PRE_IDS = new Set(PRE_CHECKS.map(([id]) => id));

/** A model check's name: "Label", "Code K7Q", "Step 1". */
export function checkLabel(check: string, code: string): string {
  if (check === "label") return "Label";
  if (check === "code") return `Code ${code}`;
  if (check === "same_item") return "Same item";
  if (check === "screen") return "Real photo";
  // Holds that come from the process, not from reading the photo.
  if (check === "model") return "Photo check";
  if (check === "payout") return "PayPal payout";
  if (check === "auto_pay") return "Auto-pay";
  const step = check.match(/^step_(\d+)$/);
  return step ? `Step ${step[1]}` : check;
}

/** The evidence barcode, from the index row alone: the four pre-checks, then each model check the rule recorded (or
 * the ones it would run, waiting or skipped, when the model hasn't answered). */
export function barsOf(c: Pick<ClaimSummary, "decision" | "checks" | "photoHashes" | "seeded" | "code">, recall: Pick<Recall, "spec">): CheckBar[] | null {
  if (!c.checks) return null;
  const code = c.code ?? "";
  const ran = c.photoHashes.length > 0 || c.decision === "blocked";
  const failed = (id: string) => c.checks?.find((r) => r.check === id && r.outcome !== "pass");
  const pre = PRE_CHECKS.map(([id, label]): CheckBar => {
    const f = failed(id);
    if (f) return { id, label, state: f.outcome };
    // Seeded claims share a few sample photos, so their fingerprint check was never run (preChecksOf says so too).
    if (id === "duplicate_photo" && c.seeded) return { id, label, state: "skipped" };
    return { id, label, state: ran ? "pass" : "waiting" };
  });
  const answered = c.checks.filter((r) => !PRE_IDS.has(r.check) && r.check !== "review");
  if (answered.length) return [...pre, ...answered.map((r) => ({ id: r.check, label: checkLabel(r.check, code), state: r.outcome }))];
  const expected = ["label", "code", ...(c.photoHashes.length > 1 ? ["same_item"] : []), "screen", ...recall.spec.proof_steps.map((_, i) => `step_${i + 1}`)];
  const state: BarState = c.decision === "blocked" ? "skipped" : "waiting";
  return [...pre, ...expected.map((id) => ({ id, label: checkLabel(id, code), state }))];
}

/** "9 checks: 8 passed, 1 held (Same item)": the barcode as a sentence, for screen readers and the tooltip. */
export function barsSentence(bars: CheckBar[]): string {
  const words: Record<BarState, string> = { pass: "passed", hold: "held", reject: "failed", waiting: "waiting", skipped: "not run" };
  const parts = (Object.keys(words) as BarState[]).flatMap((s) => {
    const of = bars.filter((b) => b.state === s);
    if (!of.length) return [];
    const named = s === "hold" || s === "reject" ? ` (${of.map((b) => b.label).join(", ")})` : "";
    return [`${of.length} ${words[s]}${named}`];
  });
  return `${bars.length} checks: ${parts.join(", ")}`;
}

const since = (from: string | undefined, to: string | undefined) => (from && to ? Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000)) : null);

function timelineOf(c: Pick<ClaimSummary, "decision" | "times" | "seeded">): RowTimeline | null {
  const t = c.times;
  if (!t?.photos) return null;
  // A seeded claim's payout was never sent: its sent and settled events are made up by the seed, so they don't show.
  const sample = Boolean(c.seeded);
  const end = c.decision === "paid" ? "paid" : c.decision === "held" ? "held" : c.decision === "pending" ? "open" : "stopped";
  return {
    answered: since(t.photos, t.answered),
    decided: since(t.photos, t.decided),
    sent: sample ? null : since(t.photos, t.sent),
    settled: sample ? null : since(t.photos, t.settled),
    end,
  };
}

/** The verdict column's muted line: the reason, or that a paid claim passed every check (the bars beside it count them). */
function noteOf(c: Pick<ClaimSummary, "decision" | "reason" | "photoHashes">, bars: CheckBar[] | null, recall: Pick<Recall, "autoPay">): string | null {
  if (c.decision === "paid" && !c.reason) {
    return bars?.some((b) => b.state === "pass") ? "All checks passed" : null;
  }
  return reasonOf(c, recall);
}

export type PhotoUrls = (key: string, n: number) => RowPhoto;

const first = (reasons: Reason[], outcome: Reason["outcome"]) => reasons.find((r) => r.outcome === outcome)?.text;

// One line for the grid: why the claim is where it is. reason is the row's decidingReason.
export function reasonOf(c: Pick<ClaimSummary, "decision" | "reason" | "photoHashes">, recall: Pick<Recall, "autoPay">): string {
  switch (c.decision) {
    case "paid":
      return c.reason ? "Approved on review" : "Every check passed";
    case "held":
      return c.reason ? companyReasonText(c.reason, "held", true) : recall.autoPay ? "Every check passed; held for a person" : "Every check passed; auto-pay is off";
    case "rejected":
    case "blocked":
      return c.reason?.text ?? "Refused";
    case "pending":
      return c.photoHashes.length ? "Checking the photos" : "Waiting for photos";
  }
}

// The "model" holds are the pipeline's own (pipeline.ts): the photo check errored, timed out, hit the daily limit or
// had no settings. They're written for the owner ("a person will look at your photos"); the console says the cause in
// the company's words, and that the claim is waiting for them: in full in the panel, and short enough for the grid's
// verdict column (about 40 characters beside the pill at 1440 with the panel open), so each cause reads whole there.
const MODEL_HOLD: [RegExp, string, string][] = [
  [/^The photo check didn't answer/, "The photo check didn't answer (a service error)", "Photo check errored"],
  [/^The photo check didn't finish/, "The photo check didn't finish in time", "Photo check timed out"],
  [/^The recall's check settings couldn't be loaded/, "The recall's check settings couldn't be loaded, so the photos weren't checked", "Check settings didn't load"],
  [/^Remedy's daily photo-check limit/, "Remedy's daily photo-check limit was reached, so the photos weren't checked", "Daily check limit reached"],
];
const modelHoldCause = (text: string, short = false) => {
  const known = MODEL_HOLD.find(([re]) => re.test(text));
  if (known) return short ? known[2] : known[1];
  return text.replace(/[,;]\s*(?:so )?a person will (?:look at your photos|review this claim)(?: instead)?\.?$/, "");
};

/** A reason as the company reads it: the "model" holds in the reviewer's words, every other reason as written. short:
 * the grid's one line. */
export function companyReasonText(r: Pick<Reason, "check" | "text">, decision: Decision, short = false): string {
  if (r.check !== "model") return r.text;
  if (decision === "held" && short) return `${modelHoldCause(r.text, true)}: needs your review`;
  const cause = modelHoldCause(r.text);
  if (decision !== "held") return `${cause}, so a person at the company reviewed it.`;
  return `${cause}, so this claim needs your review. Nothing has been paid.`;
}

/** A grid row from an index row. photoUrls turns each photo's store key into the URLs the grid loads (the console
 * seals them per company; the homepage preview uses public sample photos); without it a row shows no thumbnails. */
export function toRow(c: ClaimSummary, recall: Recall, photoUrls?: PhotoUrls): ClaimRow {
  const owed = c.decision === "paid" || c.decision === "held" ? amountOf(c.payoutAmount, recall) : null;
  const bars = barsOf(c, recall);
  const timeline = timelineOf(c);
  const failedAt = c.decision === "held" ? (c.payoutFailedAt ?? null) : null;
  return {
    id: c.id,
    createdAt: c.createdAt,
    payer: maskPayer(c.payerId),
    verified: c.payerVerified,
    decision: c.decision,
    reason: reasonOf(c, recall),
    payoutStatus: c.payoutStatus,
    amount: owed ? formatMoney(owed) : null,
    cents: owed ? cents(owed) : null,
    seeded: Boolean(c.seeded),
    demo: Boolean(c.demo),
    code: c.code ?? null,
    version: c.version ?? null,
    photoCount: c.photoHashes.length,
    photos: photoUrls ? (c.photoKeys ?? []).map(photoUrls) : [],
    bars,
    // A refused payout is the newest thing about a held claim, and what the reviewer acts on: it leads the verdict.
    note: failedAt ? "PayPal didn't take the payout: retry or reject" : noteOf(c, bars, recall),
    payoutFailedAt: failedAt,
    timeline,
    toPay: timeline && c.decision === "paid" ? timeline.sent : null,
    modelSec: timeline?.answered ?? null,
  };
}

// PayPal statuses it never moves on from (lib/paypal/status.ts), repeated here so client code can use them.
const PAYPAL_FINAL = new Set(["SUCCESS", "FAILED", "RETURNED", "BLOCKED", "DENIED", "CANCELED", "REFUNDED", "REVERSED"]);
// Statuses that can sit for weeks (a payee who hasn't claimed it, a PayPal review): not worth a poll.
const PAYPAL_SLOW = new Set(["UNCLAIMED", "ONHOLD"]);

/** A real payout PayPal hasn't settled yet. Sample claims never had one. */
export const isSettling = (r: Pick<ClaimRow, "decision" | "payoutStatus" | "seeded">) => r.decision === "paid" && !r.seeded && r.payoutStatus !== null && !PAYPAL_FINAL.has(r.payoutStatus);

export const LIVE_WINDOW_MS = 10 * 60_000;
// A pending claim can only move inside its camera session plus the time the check gets before it's held for a person:
// CAPTURE_SESSION_MINUTES (10) and STALE_AFTER_MS (150 s), pinned equal in blob-budget.test.ts. Past that it is
// abandoned or stuck, and the page that shows it repairs it, not this poll.
export const PENDING_LIVE_MS = 10 * 60_000 + 150_000;
// A sent payout usually settles in seconds to minutes. A claim is sent within PENDING_LIVE_MS of being filed, so this
// bounds polling to its first half hour after the payout.
export const SETTLING_LIVE_MS = PENDING_LIVE_MS + 30 * 60_000;

/**
 * Whether the queue can still change by itself, which is what the grid polls for: a claim filed in the last 12.5
 * minutes still pending (its photos or its check can still arrive), a payout settling within about half an hour of
 * being sent (never one parked at UNCLAIMED or ONHOLD), or a demo claim filed in the last 10 minutes. Seeded samples
 * never change, so they never count. An abandoned claim or a slow payout never keeps a console polling.
 */
export function isLive(rows: Pick<ClaimRow, "decision" | "payoutStatus" | "seeded" | "demo" | "createdAt">[], now = Date.now()): boolean {
  return rows.some((r) => {
    if (r.seeded) return false;
    const age = now - Date.parse(r.createdAt);
    if (r.decision === "pending") return age < PENDING_LIVE_MS;
    if (isSettling(r) && !PAYPAL_SLOW.has(r.payoutStatus ?? "")) return age < SETTLING_LIVE_MS;
    return r.demo && age < LIVE_WINDOW_MS;
  });
}

export interface Ledger {
  total: number;
  remedied: number;
  unitsSold: number;
  // Of the remedied, the sample claims: counted as the rule decided, but never paid.
  sampleRemedied: number;
  // Real (and demo, sandbox) money sent through PayPal.
  paidCents: number;
  // What the sample claims would have paid.
  sampleCents: number;
  // Median seconds from photos to PayPal over claims whose payout was sent, and how many that is.
  medianToPay: number | null;
  timed: number;
  held: number;
  refused: number;
  settling: number;
  samples: number;
  demos: number;
}

/** The ledger strip over the grid, from the rows the grid shows, so it updates with each poll. */
export function ledgerOf(rows: ClaimRow[], recall: Pick<Recall, "unitsSold">): Ledger {
  const paid = rows.filter((r) => r.decision === "paid");
  const times = paid.flatMap((r) => (r.toPay === null ? [] : [r.toPay])).sort((a, b) => a - b);
  const mid = times.length >> 1;
  return {
    total: rows.length,
    remedied: paid.length,
    unitsSold: recall.unitsSold,
    sampleRemedied: paid.filter((r) => r.seeded).length,
    paidCents: paid.filter((r) => !r.seeded).reduce((s, r) => s + (r.cents ?? 0), 0),
    sampleCents: paid.filter((r) => r.seeded).reduce((s, r) => s + (r.cents ?? 0), 0),
    medianToPay: times.length ? (times.length % 2 ? times[mid] : Math.round((times[mid - 1] + times[mid]) / 2)) : null,
    timed: times.length,
    held: rows.filter((r) => r.decision === "held").length,
    refused: rows.filter((r) => r.decision === "rejected" || r.decision === "blocked").length,
    settling: rows.filter(isSettling).length,
    samples: rows.filter((r) => r.seeded).length,
    demos: rows.filter((r) => r.demo).length,
  };
}

/** "0:41", "1:05", "12:00": a duration as a clock. */
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

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

export function statsOf(claims: Pick<ClaimSummary, "decision" | "payoutStatus" | "payoutAmount">[], recall: Pick<Recall, "refund" | "unitsSold">): Stats {
  const count = (d: Decision) => claims.filter((c) => c.decision === d).length;
  const paid = claims.filter((c) => c.decision === "paid");
  return {
    total: claims.length,
    remedied: paid.length,
    unitsSold: recall.unitsSold,
    paidCents: paid.reduce((sum, c) => sum + cents(amountOf(c.payoutAmount, recall)), 0),
    settling: paid.filter((c) => !SETTLED.has(c.payoutStatus ?? "")).length,
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
export function decisionSentence(c: Pick<Claim, "decision" | "reasons" | "photos" | "payout" | "seeded">, recall: Pick<Recall, "autoPay" | "refund">): string {
  const amount = formatMoney(amountOf(c.payout?.amount, recall));
  const reviewed = c.reasons.find((r) => r.check === "review");
  switch (c.decision) {
    case "paid":
      // A seeded sample was decided by the rule like any claim, but its PayPal account is made up and nothing was sent.
      if (c.seeded) return `Every check passed, so the rule would pay ${amount}. This is a sample claim: no money was sent.`;
      return reviewed ? `Approved on review, so Remedy paid ${amount} through PayPal.` : `Every check passed, so Remedy paid ${amount} through PayPal.`;
    case "held": {
      // A hold is the model's unclear answer, or a step of the process: auto-pay off, PayPal refusing the payout, or a
      // conflict the checks before the payout found. Each gets its own sentence.
      const holds = c.reasons.filter((r) => r.outcome === "hold");
      const hold = holds.find((r) => !PROCESS_HOLD.has(r.check)) ?? holds[0];
      if (hold?.check === "auto_pay") return `Every check passed. Auto-pay is off, so a person approves the ${amount} refund.`;
      if (hold?.check === "payout") return "Every check passed, but PayPal didn't accept the payout, so a person will send it.";
      if (hold && PROCESS_HOLD.has(hold.check)) return `A check before the payout found a conflict, so a person decides: ${lower(hold.text)}.`;
      if (hold?.check === "model") return `The photo check gave no answer, so the rule couldn't decide: a person approves or rejects the ${amount} refund.`;
      if (hold) return `One answer was unclear, so a person decides: ${lower(hold.text)}.`;
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
// Holds that come from the process, not from the model's answers.
const PROCESS_HOLD = new Set(["auto_pay", "payout", "payer", "duplicate_photo"]);
// Lowercases the first letter to run on in a sentence, but never a name like "PayPal" or "CPSC".
const lower = (t: string) => (t && !/^(?:[A-Z]{2}|[A-Z][a-z]+[A-Z])/.test(t) ? t[0].toLowerCase() + t.slice(1) : t).replace(/[.\s]+$/, "");

export type PreCheckState = "pass" | "hold" | "reject" | "waiting" | "skipped";
export interface PreCheckRow {
  id: string;
  label: string;
  state: PreCheckState;
  detail: string;
}

// The four cheap checks that run before any photo reaches the model, rebuilt from the claim's reasons.
export function preChecksOf(c: Pick<Claim, "decision" | "reasons" | "photos" | "payerVerified" | "seeded" | "demo" | "events">): PreCheckRow[] {
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
      : // A demo claim is checked only against its own demo round (pipeline.ts othersFor), so every judge can send the
        // same sample photo once: say that, next to the other rounds' claims with the same photo and code.
        c.demo
        ? row("duplicate_photo", "Photo not seen before", "No other claim in this demo round used these photos. Each judge's round is checked on its own, so other rounds' claims can share the sample photo")
        : row("duplicate_photo", "Photo not seen before", "No other claim used these photos"),
    // In the demo only the genuine sample is held to one claim, within its round (pipeline.ts receivePhotos).
    !c.demo
      ? row("payer", "One claim per account", "No other paid or open claim for this recall from this PayPal account")
      : oneClaimChecked(c)
        ? row("payer", "One claim per account", "Checked within this demo round: no other paid or open genuine claim from this PayPal account")
        : ran
          ? { id: "payer", label: "One claim per account", state: "skipped", detail: "Not checked for this demo sample, so it can show its own check" }
          : row("payer", "One claim per account", ""),
    row("payer_verified", "Verified PayPal account", "PayPal says the account is verified"),
  ];
}
