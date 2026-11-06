import type { CheckState } from "@/components/ui";
import type { CheckSpec, Claim, Decision, Reason, Recall } from "@/lib/types";

// Pure view logic for the claim flow, shared by the pages, the API's JSON and the dev previews. No server imports.

export type RowGroup = "pre" | "model" | "pay";

export interface CheckRow {
  id: string;
  group: RowGroup;
  label: string;
  state: CheckState;
  /** The result in a sentence. */
  detail?: string;
  /** The model's own words for this check, quoted in mono. */
  quote?: string;
}

/** What the browser polls: never the payout key or the capture session id. */
export interface ClaimView {
  id: string;
  decision: Decision;
  code: string;
  demo: boolean;
  photos: number;
  rows: CheckRow[];
}

export type ClaimLike = Pick<Claim, "decision" | "reasons" | "photos" | "verdict" | "payout" | "code" | "demo">;

const PRE = [
  { id: "session", label: "Live camera session", checks: ["session"], pass: "Taken on this page's camera before the code expired" },
  { id: "duplicate_photo", label: "Photo not seen before", checks: ["duplicate_photo"], pass: "No match among earlier claims' photos" },
  { id: "account", label: "First claim for this PayPal account", checks: ["state", "payer_verified", "payer"], pass: "A verified PayPal account with no other claim for this recall" },
] as const;

const OUTCOME: Record<Reason["outcome"], CheckState> = { pass: "pass", hold: "hold", reject: "reject" };

// The checks decide() reports, in the order the screen shows them: label, steps, code, then the photo itself.
function modelChecks(claim: ClaimLike, spec: CheckSpec) {
  const steps = Math.max(spec.proof_steps.length, claim.verdict?.steps.length ?? 0);
  const v = claim.verdict;
  const list: { id: string; label: string; quote?: string }[] = [
    { id: "label", label: spec.label_must_show.length ? "Label matches the recall" : "Looks like the recalled product", quote: v?.label.evidence },
    ...Array.from({ length: steps }, (_, i) => ({ id: `step_${i + 1}`, label: spec.proof_steps[i] ?? v?.steps[i]?.step ?? `Step ${i + 1}`, quote: v?.steps[i]?.evidence })),
    { id: "code", label: `Code ${claim.code} written by hand`, quote: v?.challenge_code.evidence },
  ];
  if (claim.photos.length > 1) list.push({ id: "same_item", label: "The same item in every photo" });
  list.push({ id: "screen", label: "A real photo, not a screen or a print" });
  return list;
}

const MODEL_IDS = (claim: ClaimLike, spec: CheckSpec) => new Set(modelChecks(claim, spec).map((c) => c.id));

/** Every check for this claim, in the order they run, with each one's state as far as it is known. */
export function checkRows(claim: ClaimLike, spec: CheckSpec): CheckRow[] {
  const received = claim.photos.length > 0;
  const blocked = claim.decision === "blocked";

  const rows: CheckRow[] = PRE.map((p) => {
    if (!received) return { id: p.id, group: "pre", label: p.label, state: "waiting" };
    const fails = blocked ? claim.reasons.filter((r) => (p.checks as readonly string[]).includes(r.check) && r.outcome === "reject") : [];
    return fails.length
      ? { id: p.id, group: "pre", label: p.label, state: "blocked", detail: fails.map((f) => f.text).join(". ") }
      : { id: p.id, group: "pre", label: p.label, state: "pass", detail: claim.demo && p.id === "session" ? "Sent inside this claim's 10-minute session" : p.pass };
  });
  if (blocked) return rows;

  const modelFailed = claim.reasons.find((r) => r.check === "model");
  if (modelFailed) return [...rows, { id: "model", group: "model", label: "Photo check", state: "hold", detail: modelFailed.text }];

  for (const c of modelChecks(claim, spec)) {
    const reason = claim.verdict ? claim.reasons.find((r) => r.check === c.id) : undefined;
    rows.push({
      id: c.id,
      group: "model",
      label: c.label,
      state: reason ? OUTCOME[reason.outcome] : "waiting",
      ...(reason ? { detail: reason.text } : {}),
      ...(reason && c.quote ? { quote: c.quote } : {}),
    });
  }

  // The payout row only means something while the claim can still be paid.
  const ids = MODEL_IDS(claim, spec);
  const modelOutcomes = claim.reasons.filter((r) => ids.has(r.check)).map((r) => r.outcome);
  if (claim.decision === "rejected" || (claim.verdict && modelOutcomes.some((o) => o !== "pass"))) return rows;

  const payHolds = claim.reasons.filter((r) => !ids.has(r.check) && r.outcome === "hold");
  if (claim.decision === "paid") {
    rows.push({ id: "payout", group: "pay", label: "Refund sent through PayPal", state: "pass", detail: claim.payout ? `PayPal batch ${claim.payout.batchId}` : undefined });
  } else if (claim.decision === "held" && payHolds.length) {
    rows.push({ id: "payout", group: "pay", label: "Refund sent through PayPal", state: "hold", detail: payHolds.map((r) => r.text).join(". ") });
  } else {
    rows.push({ id: "payout", group: "pay", label: "Refund sent through PayPal", state: "waiting" });
  }
  return rows;
}

export function toView(claim: Claim, spec: CheckSpec): ClaimView {
  return { id: claim.id, decision: claim.decision, code: claim.code, demo: Boolean(claim.demo), photos: claim.photos.length, rows: checkRows(claim, spec) };
}

export const isDecided = (d: Decision) => d !== "pending";

/** The reasons that decided a refused or held claim, most important first. */
export function decidingReasons(claim: Pick<Claim, "decision" | "reasons">): Reason[] {
  const want = claim.decision === "held" ? "hold" : "reject";
  return claim.reasons.filter((r) => r.outcome === want);
}

// What to do next, per failed check. Keys are rule.ts check names (step_N share one).
const ADVICE: Record<string, string> = {
  session: "Photos only count when they're taken on this page's camera within 10 minutes of getting the code. Start a new claim for a fresh code.",
  duplicate_photo: "Each claim needs new photos of your own product. Start a new claim and take them on this page's camera.",
  payer: "Each PayPal account can claim once per recall, so your earlier claim is the one that counts.",
  payer_verified: "Verify your account with PayPal, then start a new claim.",
  state: "This claim was already decided. Its result stands.",
  code: "Write the code exactly as shown, large and in marker, and keep it in focus. A new claim gives you a new code.",
  label: "Make sure the label is in the photo, in focus and readable, then start a new claim.",
  step: "Finish that step, then photograph it on a new claim.",
  screen: "Photograph the product itself, not a screen or a printout.",
  same_item: "Keep the same item in every photo.",
};

export function adviceFor(check: string): string {
  return ADVICE[check.startsWith("step_") ? "step" : check] ?? "Start a new claim and take new photos on this page's camera.";
}

/** Whether starting over can help: a second claim from the same account never can. */
export const canRetry = (reasons: Reason[]) => !reasons.some((r) => r.check === "payer" || r.check === "state");

export type Tone = "pay" | "hold" | "stop" | "muted";

/** PayPal's payout status in words. Batch statuses (PENDING, PROCESSING, SUCCESS, DENIED) and item statuses mix here. */
export function payoutWords(status: string | null | undefined): { label: string; tone: Tone; note: string } {
  switch ((status ?? "").toUpperCase()) {
    case "SUCCESS":
      return { label: "Received", tone: "pay", note: "The money is in your PayPal account." };
    case "UNCLAIMED":
      return { label: "Waiting for you at PayPal", tone: "hold", note: "PayPal emailed you a link to claim it." };
    case "ONHOLD":
      return { label: "On hold at PayPal", tone: "hold", note: "PayPal is reviewing it; it usually clears within a day." };
    case "FAILED":
    case "RETURNED":
    case "BLOCKED":
    case "DENIED":
    case "REVERSED":
    case "REFUNDED":
    case "CANCELED":
      return { label: "Didn't go through", tone: "stop", note: "The company's recall team has been told and will send it again." };
    case "":
      return { label: "Unknown", tone: "muted", note: "" };
    default:
      return { label: "Processing at PayPal", tone: "hold", note: "Most payouts land within a few minutes." };
  }
}

/** "Kikea Store Recalls X-VESOLJE Nursing Pillows Due to Risk of …" -> "Kikea Store". */
export function companyName(recall: Pick<Recall, "title">): string {
  const m = recall.title.match(/^(.+?)\s+Recalls?\s/);
  return m ? m[1] : "The company";
}

/** "… Due to Risk of Serious Injury or Death from Suffocation; Violate …" -> "Risk of serious injury or death from suffocation". */
export function recallReason(recall: Pick<Recall, "title">): string | null {
  const m = recall.title.match(/\sDue to\s(.+?)(;|$)/);
  if (!m) return null;
  const s = m[1].toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function money({ value, currency }: { value: string; currency: string }): string {
  return currency === "USD" ? `$${value}` : `${value} ${currency}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "7 Nov 2026, 14:32 UTC": the same on server and client, so it never mismatches on hydration. */
export function stamp(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

export function day(isoDate: string): string {
  const d = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00Z` : isoDate);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Seconds between two events of a claim, or null if either is missing. */
export function secondsBetween(events: Claim["events"], from: string, to: string): number | null {
  const a = events.find((e) => e.type === from);
  const b = events.find((e) => e.type === to);
  if (!a || !b) return null;
  return Math.max(0, Math.round((Date.parse(b.at) - Date.parse(a.at)) / 1000));
}

/** "••••PUJ3Q": enough to recognise your own account, not enough to copy it. */
export const maskPayer = (payerId: string) => `••••${payerId.slice(-5)}`;
