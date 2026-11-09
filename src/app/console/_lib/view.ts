import { APPEAL_CHECK } from "@/lib/appeal";
import { oneClaimChecked } from "@/lib/demo/samples";
import { cutInHalf, handWrittenLabel, nounOf } from "@/components/claim/model";
import { CHECK_NAMES, fiveNames, fiveOutcomes } from "@/lib/fiveChecks";
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
  /** The five checks' names for this claim (fiveChecks.ts fiveNames), as the evidence lists them. */
  checkNames?: string[];
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
  // Photos to PayPal sending the money, in seconds.
  toPay: number | null;
  // Photos to the model's answer, in seconds (the eval run's own time on a sample claim).
  modelSec: number | null;
}

// The pre-checks every claim goes through before the model, in order, and their labels.
const PRE_CHECKS: [string, string][] = [
  ["session", CHECK_NAMES.session],
  ["duplicate_photo", CHECK_NAMES.duplicate],
  ["payer", CHECK_NAMES.account],
  ["payer_verified", "Verified PayPal account"],
];
const PRE_IDS = new Set(PRE_CHECKS.map(([id]) => id));
/** One of the four checks that run before the model. */
export const isPreCheck = (id: string) => PRE_IDS.has(id);

/** A proof step named by what it asks for: "The pillow is cut fully in half, so it…" -> "Pillow cut fully in half". */
export function stepName(text: string): string {
  const clause = text.split(/[,.;:(]/)[0].trim().replace(/^the\s+/i, "").replace(/\s+(?:is|are)\s+/, " ");
  return clause ? clause[0].toUpperCase() + clause.slice(1) : text;
}

/** A model check's name: "Label", "Code K7Q", and a proof step by its content ("Pillow cut fully in half"), or
 * "Step 1" when the recall's steps aren't at hand. */
export function checkLabel(check: string, code: string, steps?: readonly string[]): string {
  if (check === "label") return "Label";
  if (check === "code") return `Code ${code}`;
  if (check === "same_item") return "Same item";
  if (check === "screen") return "Real photo";
  // Holds that come from the process, not from reading the photo.
  if (check === "model") return "Photo check";
  if (check === "payout") return "PayPal payout";
  if (check === "auto_pay") return "Auto-pay";
  const step = check.match(/^step_(\d+)$/);
  if (!step) return check;
  const text = steps?.[Number(step[1]) - 1];
  return text ? stepName(text) : `Step ${step[1]}`;
}

/** The evidence barcode, from the index row alone: the four pre-checks, then each model check the rule recorded (or
 * the ones it would run, waiting or skipped, when the model hasn't answered). */
export function barsOf(c: Pick<ClaimSummary, "decision" | "checks" | "photoHashes" | "seeded" | "code" | "demo" | "sample">, recall: Pick<Recall, "spec">): CheckBar[] | null {
  if (!c.checks) return null;
  const code = c.code ?? "";
  const ran = c.photoHashes.length > 0 || c.decision === "blocked";
  const failed = (id: string) => c.checks?.find((r) => r.check === id && r.outcome !== "pass");
  // A pre-check that doesn't apply to a claim keeps its place in the strip as a skipped slot (a dash), so every row
  // draws the same four account slots in the same place; the drawer leaves it out of the list (preChecksOf): one claim
  // per account on a demo sample but the genuine one.
  const pre = PRE_CHECKS.map(([id, label]): CheckBar => {
    const f = failed(id);
    if (f) return { id, label, state: f.outcome };
    if (id === "payer" && c.demo && c.sample !== "genuine" && ran) return { id, label, state: "skipped" };
    return { id, label, state: ran ? "pass" : "waiting" };
  });
  const answered = c.checks.filter((r) => !PRE_IDS.has(r.check) && r.check !== "review" && r.check !== APPEAL_CHECK);
  const steps = recall.spec.proof_steps;
  if (answered.length) {
    const bars: CheckBar[] = answered.map((r) => ({ id: r.check, label: checkLabel(r.check, code, steps), state: r.outcome }));
    // "Same item" is only asked of two or more photos. A one-photo claim keeps its place in the strip as a skipped
    // check, so every row of a recall draws the same track and none looks as if it got fewer checks.
    if (!answered.some((r) => r.check === "same_item")) {
      const at = bars.findIndex((b) => b.id === "code") + 1 || bars.findIndex((b) => b.id === "label") + 1;
      bars.splice(at, 0, { id: "same_item", label: checkLabel("same_item", code, steps), state: "skipped" });
    }
    return [...pre, ...bars];
  }
  const expected = ["label", "code", "same_item", "screen", ...steps.map((_, i) => `step_${i + 1}`)];
  const state: BarState = c.decision === "blocked" ? "skipped" : "waiting";
  return [...pre, ...expected.map((id) => ({ id, label: checkLabel(id, code, steps), state }))];

}

/** The five checks a row's recorded answers fall under, each as its worst answer ("Same item" isn't asked of one photo,
 * so it never keeps "Really destroyed" from passing). The strip draws one bar for each. */
export const fiveOf = (bars: Pick<CheckBar, "id" | "state">[]) => fiveOutcomes(bars.filter((b) => !(b.id === "same_item" && b.state === "skipped")));

/** The strip as a sentence, in the evidence panel's words: "3 of 5 checks passed · 1 held · 1 not run". The hover card,
 * screen readers and the CSV say it, so the console counts five checks everywhere. */
export function barsSentence(bars: Pick<CheckBar, "id" | "state">[]): string {
  const five = fiveOf(bars);
  const n = (o: string) => five.filter((x) => x.outcome === o).length;
  const rest = ([["fail", "failed"], ["hold", "held"], ["skipped", "not run"], ["open", "waiting"]] as const).filter(([o]) => n(o)).map(([o, w]) => `${n(o)} ${w}`);
  return [`${n("pass")} of ${five.length} checks passed`, ...rest].join(" · ");
}

const since = (from: string | undefined, to: string | undefined) => (from && to ? Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000)) : null);

function timelineOf(c: Pick<ClaimSummary, "decision" | "times">): RowTimeline | null {
  const t = c.times;
  if (!t?.photos) return null;
  const end = c.decision === "paid" ? "paid" : c.decision === "held" ? "held" : c.decision === "pending" ? "open" : "stopped";
  return {
    answered: since(t.photos, t.answered),
    decided: since(t.photos, t.decided),
    sent: since(t.photos, t.sent),
    // A starter claim's payout settled with the workspace's other payouts: its row says so as theirs do.
    settled: since(t.photos, t.settled ?? t.sent),
    end,
  };
}

// A held claim a person approved, where the checks run again before the payout found a conflict (review.ts): the claim
// keeps the reason it was held for, and the conflict is the newest thing about it, so the grid leads with it.
const REFUSED_NOTE: Record<string, string> = {
  payer: "Not paid on review: this account has another claim",
  duplicate_photo: "Not paid on review: a photo is in another claim",
  payer_verified: "Not paid on review: account not verified",
};

/** The verdict column's muted line: the reason, or that a paid claim passed every check (the bars beside it count them).
 * A refused claim's line leads with its category, the words the Verdict filter, Insights and the report use, then the
 * detail that tells this claim apart. copiedFrom: the earlier claim a reused photo matches. */
function noteOf(c: Pick<ClaimSummary, "decision" | "reason" | "photoHashes" | "checks">, bars: CheckBar[] | null, recall: Pick<Recall, "autoPay">, copiedFrom?: string | null): string | null {
  if (c.decision === "paid" && !c.reason) {
    return bars?.some((b) => b.state === "pass") ? "All checks passed" : null;
  }
  const refused = c.decision === "held" && c.reason && !(c.reason.check in REFUSED_NOTE) ? c.checks?.find((r) => r.outcome === "hold" && r.check in REFUSED_NOTE) : undefined;
  if (refused) return REFUSED_NOTE[refused.check];
  if ((c.decision === "rejected" || c.decision === "blocked") && c.reason && c.reason.check !== "review") return refusalLine(c.reason, copiedFrom);
  return reasonOf(c, recall);
}

/** "Code missing or wrong · reads K7O, expected K7Q": a refusal in the company's words, short enough for the grid. */
export function refusalLine(r: Pick<Reason, "check" | "text">, copiedFrom?: string | null): string {
  const lead = refusalLabel(r.check);
  if (lead === "Other") return r.text;
  const id = r.text.match(/\bRM-\d{4}\b/)?.[0] ?? copiedFrom ?? null;
  if (r.check === "code") {
    const read = r.text.match(/reads (\S+?);? this claim's code is (\S+)/);
    if (read) return `${lead} · reads ${read[1]}, expected ${read[2]}`;
    const none = r.text.match(/^No code written.*code is (\S+)/);
    if (none) return `${lead} · none written, expected ${none[1]}`;
  }
  return id && (r.check === "payer" || r.check === "duplicate_photo") ? `${lead} · ${id}` : lead;
}

export type PhotoUrls = (key: string, n: number) => RowPhoto;

/** What search matches a row on: the claim id, the code, the PayPal account's last four, the reason and the verdict line. */
export const searchText = (r: Pick<ClaimRow, "id" | "code" | "payer" | "reason" | "note">) => `${r.id} ${r.code ?? ""} ${r.payer} ${r.reason} ${r.note ?? ""}`;

/** Search's one comparison: case aside, and O and 0 as one character, so "K70" finds the tag the photo check read as
 * "K7O" (a reviewer types what they see, and the two look alike). */
export const searchKey = (t: string) => t.toLowerCase().replace(/o/g, "0");

const first = (reasons: Reason[], outcome: Reason["outcome"]) => reasons.find((r) => r.outcome === outcome)?.text;

// One line for the grid: why the claim is where it is. reason is the row's decidingReason.
export function reasonOf(c: Pick<ClaimSummary, "decision" | "reason" | "photoHashes">, recall: Pick<Recall, "autoPay">): string {
  switch (c.decision) {
    case "paid":
      return c.reason ? "Approved on review" : "All checks passed";
    case "held":
      return c.reason ? companyReasonText(c.reason, "held", true) : recall.autoPay ? "All checks passed; held for a person" : "All checks passed; auto-pay is off";
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
  // A proof step the photos showed is the step itself, without the rule's "Done:" before it.
  if (/^step_\d+$/.test(r.check) && r.text.startsWith("Done: ")) return r.text.slice(6, 7).toUpperCase() + r.text.slice(7);
  if (r.check !== "model") return r.text;
  if (decision === "held" && short) return `${modelHoldCause(r.text, true)}: needs your review`;
  const cause = modelHoldCause(r.text);
  if (decision !== "held") return `${cause}, so a person at the company reviewed it.`;
  return `${cause}, so this claim needs your review. Nothing has been paid.`;
}

/** A grid row from an index row. photoUrls turns each photo's store key into the URLs the grid loads (the console
 * seals them per company; the homepage preview uses public sample photos); without it a row shows no thumbnails. */
export function toRow(c: ClaimSummary, recall: Recall, photoUrls?: PhotoUrls, copiedFrom?: string | null): ClaimRow {
  const owed = c.decision === "paid" || c.decision === "held" ? amountOf(c.payoutAmount, recall) : null;
  const bars = barsOf(c, recall);
  const timeline = timelineOf(c);
  const failedAt = c.decision === "held" ? (c.payoutFailedAt ?? null) : null;
  return {
    id: c.id,
    checkNames: fiveNames(c.code ?? "", handWrittenLabel(recall.spec), nounOf(recall.spec), cutInHalf(recall.spec)),
    createdAt: c.createdAt,
    payer: maskPayer(c.payerId),
    verified: c.payerVerified,
    decision: c.decision,
    reason: reasonOf(c, recall),
    // Paid only where PayPal confirmed the payout; a claim the rule passed with nothing sent reads Approved.
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
    note: failedAt ? "Payout not sent: retry or reject" : noteOf(c, bars, recall, copiedFrom),
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
  // Money PayPal paid (payouts it confirmed).
  paidCents: number;
  // Median seconds from photos to PayPal over claims whose payout was sent, and how many that is.
  medianToPay: number | null;
  timed: number;
  held: number;
  refused: number;
  settling: number;
  samples: number;
  demos: number;
}

/** The middle value, or the lower of the two middle ones for an even count: the rule AG Studio's median measure uses,
 * so the console's ledger and Insights always print the same median. Null for none. */
export function median(values: number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[(sorted.length - 1) >> 1] : null;
}

/** The ledger strip over the grid, from the rows the grid shows, so it updates with each poll. */
export function ledgerOf(rows: ClaimRow[], recall: Pick<Recall, "unitsSold">): Ledger {
  const paid = rows.filter((r) => r.decision === "paid");
  const times = paid.flatMap((r) => (r.toPay === null ? [] : [r.toPay]));
  return {
    total: rows.length,
    remedied: paid.length,
    unitsSold: recall.unitsSold,
    // Paid through PayPal: only payouts PayPal confirmed, never a claim approved with nothing sent.
    paidCents: paid.filter((r) => r.payoutStatus === "SUCCESS").reduce((s, r) => s + (r.cents ?? 0), 0),
    medianToPay: median(times),
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

/** One format for every span the console shows (grid, timeline, history, ledger): "11 s", "7 min 28 s", "1 h 06 min"
 * past an hour (a held claim a person approved later). */
export function duration(sec: number): string {
  const s = Math.round(sec);
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`;
  if (s >= 60) return s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`;
  return `${s} s`;
}

// Why a claim was refused, by the check that refused it: one wording for the grid's filter and grouping, Insights and
// the CPSC report, so the three never disagree.
const REFUSAL: Record<string, string> = {
  code: "Code missing or wrong",
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
export function decisionSentence(c: Pick<Claim, "decision" | "reasons" | "photos" | "payout">, recall: Pick<Recall, "autoPay" | "refund">): string {
  const amount = formatMoney(amountOf(c.payout?.amount, recall));
  const reviewed = c.reasons.find((r) => r.check === "review");
  switch (c.decision) {
    case "paid":
      // Approved with nothing sent: no PayPal payout to name.
      if (!c.payout) return reviewed ? `Approved on review: ${amount} approved, nothing sent yet.` : `All checks passed: ${amount} approved, nothing sent yet.`;
      return reviewed ? `Approved on review, so Remedy paid ${amount} through PayPal.` : `All checks passed, so Remedy paid ${amount} through PayPal.`;
    case "held": {
      // The rule refused it and the owner asked a person to look (src/lib/appeal.ts): the rule's reason stands beside it.
      const refused = c.reasons.find((r) => r.outcome === "reject");
      if (refused && c.reasons.some((r) => r.check === APPEAL_CHECK)) {
        return `The rule refused it (${lower(refused.text)}), and the owner asked for a review, so a person decides: approve sends the ${amount} refund, reject keeps it refused.`;
      }
      // A hold is the model's unclear answer, or a step of the process: auto-pay off, PayPal refusing the payout, or a
      // conflict the checks before the payout found. Each gets its own sentence.
      const holds = c.reasons.filter((r) => r.outcome === "hold");
      const hold = holds.find((r) => !PROCESS_HOLD.has(r.check)) ?? holds[0];
      if (hold?.check === "auto_pay") return `All checks passed. Auto-pay is off, so a person approves the ${amount} refund.`;
      if (hold?.check === "payout") return "All checks passed, but PayPal didn't accept the payout, so a person will send it.";
      if (hold && PROCESS_HOLD.has(hold.check)) return `A check before the payout found a conflict, so a person decides: ${lower(hold.text)}.`;
      if (hold?.check === "model") return `The photo check gave no answer, so the rule couldn't decide: a person approves or rejects the ${amount} refund.`;
      if (hold) return `One answer was unclear, so a person decides: ${lower(hold.text)}.`;
      return recall.autoPay ? "All checks passed, but the claim is held for a person." : `All checks passed. Auto-pay is off, so a person approves the ${amount} refund.`;
    }
    case "rejected":
      return reviewed ? `Rejected on review: ${stripPrefix(reviewed.text).replace(/[.\s]+$/, "")}.` : `A check failed, so no money moves: ${lower(first(c.reasons, "reject") ?? "refused")}.`;
    case "blocked":
      return `Stopped by the account checks before the photo check: ${lower(first(c.reasons, "reject") ?? "an account check failed")}.`;
    case "pending":
      return c.photos.length ? "The photo check is reading the photos; the rule decides when it answers." : "The owner has a code and an open camera session, but no photos yet.";
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

// The four cheap checks that run before any photo reaches the model, rebuilt from the claim's reasons. A check that
// doesn't apply to this claim is left out, never listed as "not run" (the strip leaves it out too, barsOf).
export function preChecksOf(c: Pick<Claim, "decision" | "reasons" | "photos" | "payerVerified" | "seeded" | "demo" | "events">): PreCheckRow[] {
  return allPreChecks(c).filter((r) => r.state !== "skipped");
}

/** Every pre-check, those that don't apply to this claim included (skipped): the panel's five checks say why. */
export function allPreChecks(c: Pick<Claim, "decision" | "reasons" | "photos" | "payerVerified" | "seeded" | "demo" | "events">): PreCheckRow[] {
  const ran = c.photos.length > 0 || c.decision === "blocked";
  // preCheck rejects (the claim is blocked); sendCheck, run again right before a payout, holds.
  const failed = (check: string) => c.reasons.find((r) => r.check === check && r.outcome !== "pass");
  const row = (id: string, label: string, pass: string): PreCheckRow => {
    const f = failed(id);
    if (f) return { id, label, state: f.outcome === "reject" ? "reject" : "hold", detail: f.text };
    return ran ? { id, label, state: "pass", detail: pass } : { id, label, state: "waiting", detail: "" };
  };
  return [
    row("session", CHECK_NAMES.session, "Taken in this claim's camera session, before it expired"),
    // A demo claim is checked only against its own demo round (pipeline.ts othersFor), so every judge can send the same
    // sample photo once: say that, next to the other rounds' claims with the same photo and code. The company reads a
    // round as a demo session.
    c.demo
      ? row("duplicate_photo", CHECK_NAMES.duplicate, "No other claim in this session used these photos")
      : row("duplicate_photo", CHECK_NAMES.duplicate, "No other claim used these photos"),
    // In the demo only the genuine sample is held to one claim, within its round (pipeline.ts receivePhotos). A person's
    // approve checks every sample (review.ts), and a conflict it found shows here.
    !c.demo
      ? row("payer", CHECK_NAMES.account, "No other paid or open claim for this recall from this PayPal account")
      : oneClaimChecked(c) || failed("payer")
        ? row("payer", CHECK_NAMES.account, "Checked within this session: no other paid or open claim from this PayPal account")
        : ran
          ? { id: "payer", label: CHECK_NAMES.account, state: "skipped", detail: "" }
          : row("payer", CHECK_NAMES.account, ""),
    row("payer_verified", "Verified PayPal account", "PayPal says the account is verified"),
  ];
}

/**
 * A recall's photo checks as the console shows them. The shared recall's spec is written for the pillow its claims
 * photograph (and the model reads it that way); on screen its label is the product's label and its scope note goes.
 */
export const shownSpec = <T extends { product: string; label_must_show: string[]; note?: string }>(spec: T): T => ({
  ...spec,
  // The shared recall accepts a plain stand-in pillow (the real one isn't sold any more): said as the product's own rule,
  // so an approved claim's sage pillow never contradicts the three prints above it.
  product: spec.product.replace(/\.?\s*In this demo recall,? a plain ([^.]*?) stand-in pillow of any colour counts when it carries the ([^.]*?) tag\.?$/, ". A plain $1 pillow of any colour also counts when it carries the $2 tag.").replace(/\.?\s*In this demo recall[^.]*\.?$/, "."),
  label_must_show: spec.label_must_show.map((l) => l.replace(/\(this demo stand-in's label\)/, "(the product's label)")),
  ...(spec.note !== undefined && /\bdemo\b/.test(spec.note) ? { note: "" } : {}),
});
