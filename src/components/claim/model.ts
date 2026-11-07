import type { CheckState } from "@/components/ui";
import type { CheckSpec, Claim, Decision, Reason, Recall } from "@/lib/types";

// Pure view logic for the claim flow, shared by the pages, the API's JSON and the dev previews. No server imports.

export type RowGroup = "pre" | "model" | "pay";

/** PayPal's guide to sandbox test accounts: the judges' demo logs in with one, never a real PayPal account. */
export const SANDBOX_ACCOUNTS_URL = "https://developer.paypal.com/tools/sandbox/accounts/";

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

/** One step of a claim's own history, for the checking screen's stage timeline: a type from TIMELINE and its time. */
export interface TimelineEvent {
  type: string;
  at: string;
}

/** What the browser polls: never the payout key or the capture session id. */
export interface ClaimView {
  id: string;
  decision: Decision;
  code: string;
  demo: boolean;
  photos: number;
  rows: CheckRow[];
  /** The stages the claim has passed and when: no detail text, nothing secret. */
  timeline: TimelineEvent[];
}

/**
 * What the camera step and the paid receipt poll: whether photos arrived from elsewhere, and PayPal's payout status once
 * a payout was sent (absent before).
 */
export type ClaimStatus = Pick<ClaimView, "decision" | "photos"> & { payout?: string };

export type ClaimLike = Pick<Claim, "decision" | "reasons" | "photos" | "verdict" | "payout" | "code" | "demo">;

const PRE = [
  { id: "session", label: "Live camera session", checks: ["session"], pass: "Taken on this page's camera before the code expired" },
  { id: "duplicate_photo", label: "Photo not seen before", checks: ["duplicate_photo"], pass: "No match among earlier claims' photos" },
  { id: "account", label: "One claim per verified PayPal account", checks: ["state", "payer_verified", "payer"], pass: "A verified PayPal account with no other claim for this recall" },
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
      ? { id: p.id, group: "pre", label: p.label, state: "blocked", detail: readableReasons(fails, claim.photos.length).map((f) => f.text).join(". ") }
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
      // A passed step or photo check would only repeat its own label; the model's quote says more.
      ...(reason && !(reason.outcome === "pass" && c.id !== "label" && c.id !== "code") ? { detail: reason.text } : {}),
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

/** The events the checking screen's timeline shows. */
export const TIMELINE = ["photos_received", "prechecked", "checked", "decided", "blocked", "payout_sent"] as const;

export const timelineOf = (events: Claim["events"]): TimelineEvent[] =>
  events.filter((e) => (TIMELINE as readonly string[]).includes(e.type)).map((e) => ({ type: e.type, at: e.at }));

export function toView(claim: Claim, spec: CheckSpec): ClaimView {
  return {
    id: claim.id,
    decision: claim.decision,
    code: claim.code,
    demo: Boolean(claim.demo),
    photos: claim.photos.length,
    rows: checkRows(claim, spec),
    timeline: timelineOf(claim.events),
  };
}

export const isDecided = (d: Decision) => d !== "pending";

/** The reasons that decided a refused or held claim, most important first. */
export function decidingReasons(claim: Pick<Claim, "decision" | "reasons">): Reason[] {
  const want = claim.decision === "held" ? "hold" : "reject";
  return claim.reasons.filter((r) => r.outcome === want);
}

/**
 * The reasons as the owner reads them: one line per photo that was a repost ("Photo 1 was already used…", three times)
 * becomes one ("All 3 photos were already used in another claim").
 */
export function readableReasons(reasons: Reason[], photos: number): Reason[] {
  const dupes = reasons.filter((r) => r.check === "duplicate_photo");
  if (dupes.length < 2) return reasons;
  const which = dupes.map((r) => /^Photo (\d+)\b/.exec(r.text)?.[1]).filter((n): n is string => Boolean(n));
  const text =
    dupes.length === photos
      ? `All ${photos} photos were already used in another claim`
      : which.length === dupes.length
        ? `Photos ${which.slice(0, -1).join(", ")} and ${which[which.length - 1]} were already used in another claim`
        : `${dupes.length} photos were already used in another claim`;
  const at = reasons.indexOf(dupes[0]);
  return reasons.flatMap((r, i) => (i === at ? [{ ...r, text }] : r.check === "duplicate_photo" ? [] : [r]));
}

/**
 * Held because the photo model gave no answer (an error, a timeout, today's limit): Remedy's fallback, not a verdict on
 * the photos. Takes a claim's reasons, or an index row's one deciding reason.
 */
export const noModelAnswer = (decision: Decision, reasons: (Reason | null | undefined)[]) => decision === "held" && reasons.some((r) => r?.check === "model");

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
      return { label: "Processing at PayPal", tone: "muted", note: "Remedy has sent it. PayPal is finishing the transfer, which usually takes a few minutes." };
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

/** "14:30:02": a UTC time to the second, the same on server and client. */
export function clock(iso: string): string {
  const d = new Date(iso);
  return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Tue 10 Nov": `days` business days (Monday to Friday, UTC) after `iso`, for a held claim's decision date. */
export function businessDaysAfter(iso: string, days: number): string {
  const d = new Date(iso);
  for (let left = days; left > 0; ) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left--;
  }
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "X-VESOLJE Nursing Pillows" -> "X-VESOLJE Nursing Pillow": one owner's one product. */
export const productNoun = (recall: Pick<Recall, "product">) => recall.product.trim().replace(/(?<=[a-z])s$/, "");

/** Whether the notice's way to destroy it is cutting it in half (the Kikea pillow), for the short reminders. */
export const cutInHalf = (spec: Pick<CheckSpec, "proof_steps">) => spec.proof_steps.some((s) => /\bcut\b/i.test(s) && /\bhalf\b/i.test(s));

/** A label line as the owner reads it: a closing "(…)" is a note for the photo check, not something to photograph. */
export const ownerLabel = (line: string) => line.replace(/\s*\([^)]*\)\s*$/, "");

/** The label the owner writes by hand on the tag ("X-VESOLJE, hand-written on a paper tag …" -> "X-VESOLJE"), if any. */
export function handWrittenLabel(spec: Pick<CheckSpec, "label_must_show">): string | null {
  for (const line of spec.label_must_show) {
    const m = line.match(/^(.+?),\s*hand-written\b/i);
    if (m) return m[1].trim();
  }
  return null;
}

/** The demo recall accepts a stand-in product (CPSC's pillow has no label), which the code step says once, plainly. */
export const acceptsStandIn = (spec: Pick<CheckSpec, "product">) => /\bstand-in\b/i.test(spec.product);

/** A refusal's headline, from the check that decided it: specific where it can be, the general sentence otherwise. */
export function refusalHeadline(claim: Pick<Claim, "decision" | "reasons" | "photos">, spec: Pick<CheckSpec, "proof_steps">): string {
  const check = decidingReasons(claim)[0]?.check ?? "";
  const photo = claim.photos.length > 1 ? "The photos don't" : "The photo doesn't";
  const step = /^step_(\d+)$/.exec(check);
  if (step) {
    const text = spec.proof_steps[Number(step[1]) - 1] ?? "";
    return cutInHalf({ proof_steps: [text] }) ? `${photo} show it cut fully in half` : `${photo} show a step the notice asks for`;
  }
  switch (check) {
    case "code":
      return "The code on the tag doesn't match";
    case "label":
      return "We couldn't read the recall label";
    case "screen":
      return "This looks like a photo of a screen or a print";
    case "same_item":
      return "The photos show different items";
    case "session":
      return "This photo wasn't taken on this page's camera";
    case "duplicate_photo":
      return claim.photos.length > 1 ? "These photos were already used in another claim" : "This photo was already used in another claim";
    case "payer":
      return "This PayPal account already has a claim for this recall";
    case "payer_verified":
      return "This PayPal account isn't verified";
    case "state":
      return "This claim was already decided";
  }
  return claim.decision === "blocked" ? "Stopped before the photo check" : `${claim.photos.length > 1 ? "These photos don't" : "This photo doesn't"} prove the claim`;
}

export interface CodeCell {
  yours: string;
  seen: string;
  same: boolean;
}

const ORDINAL = ["first", "second", "third", "fourth", "fifth", "sixth"];

/**
 * The claim's code beside what the model read on the tag, character by character, and a caption that says which
 * characters differ. `seen` is the verdict's challenge_code.text_seen: null or empty when nothing was readable.
 */
export function codeDiff(code: string, seen: string | null | undefined): { cells: CodeCell[]; caption: string; readable: boolean } {
  const yours = code.toUpperCase();
  const read = (seen ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!read) return { cells: yours.split("").map((c) => ({ yours: c, seen: "", same: false })), caption: "No code was readable on the tag.", readable: false };
  const n = Math.max(yours.length, read.length);
  const cells = Array.from({ length: n }, (_, i) => ({ yours: yours[i] ?? "", seen: read[i] ?? "", same: yours[i] === read[i] }));
  const off = cells.flatMap((c, i) => (c.same ? [] : [i]));
  if (!off.length) return { cells, caption: `The tag reads ${read}, but the photo check couldn't confirm it's your code.`, readable: true };
  const [i] = off;
  if (off.length === 1 && cells[i].yours && cells[i].seen) {
    return { cells, caption: `The ${ORDINAL[i] ?? `character ${i + 1}`} character: ${cells[i].yours} in your code, ${cells[i].seen} on the tag.`, readable: true };
  }
  return { cells, caption: `${off.length} of ${n} characters differ: ${yours} in your code, ${read} on the tag.`, readable: true };
}

/**
 * When the paid receipt asks for PayPal's status next, in ms, after polling for `elapsed` ms; null to stop. Every 5 s
 * for the first 30 s, every 15 s after, never past 2 minutes: at most 12 polls, each one Blob read.
 */
export function receiptPollDelay(elapsed: number): number | null {
  const next = elapsed < 30_000 ? 5_000 : 15_000;
  return elapsed + next > 120_000 ? null : next;
}

/** A payout the receipt keeps asking about: sent less than 10 minutes ago and not settled. */
export const RECEIPT_LIVE_MS = 10 * 60_000;
