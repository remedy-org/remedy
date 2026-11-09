import type { CheckState } from "@/components/ui";
import { reviewAsked } from "@/lib/appeal";
import { oneClaimChecked } from "@/lib/demo/samples";
import { CHECK_NAMES } from "@/lib/fiveChecks";
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

export type ClaimLike = Pick<Claim, "decision" | "reasons" | "photos" | "verdict" | "payout" | "code" | "demo" | "events">;

const PRE = [
  { id: "session", label: CHECK_NAMES.session, checks: ["session"], pass: "Taken on this page’s camera before the code expired" },
  { id: "duplicate_photo", label: CHECK_NAMES.duplicate, checks: ["duplicate_photo"], pass: "No match among earlier claims' photos" },
  { id: "account", label: CHECK_NAMES.account, checks: ["state", "payer_verified", "payer"], pass: "A verified PayPal account with no other paid or open claim for this recall" },
] as const;

const OUTCOME: Record<Reason["outcome"], CheckState> = { pass: "pass", hold: "hold", reject: "reject" };

// The checks decide() reports, in the order the screen shows them: grouped under the homepage's checks 4 (the label and
// the code) and 5 (each step, then the photo itself), as src/lib/fiveChecks.ts numbers them.
function modelChecks(claim: ClaimLike, spec: CheckSpec) {
  const steps = Math.max(spec.proof_steps.length, claim.verdict?.steps.length ?? 0);
  const v = claim.verdict;
  const list: { id: string; label: string; quote?: string }[] = [
    { id: "label", label: spec.label_must_show.length ? "Label matches the recall" : "Looks like the recalled product", quote: v?.label.evidence },
    { id: "code", label: `Code ${claim.code} written by hand`, quote: v?.challenge_code.evidence },
    ...Array.from({ length: steps }, (_, i) => ({ id: `step_${i + 1}`, label: spec.proof_steps[i] ?? v?.steps[i]?.step ?? `Step ${i + 1}`, quote: v?.steps[i]?.evidence })),
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
    if (fails.length) return { id: p.id, group: "pre", label: p.label, state: "blocked", detail: readableReasons(fails, claim.photos.length).map((f) => f.text).join(". ") };
    // A demo claim meets only its own round, and only the genuine sample is held to one claim (pipeline.ts): say so.
    if (claim.demo && p.id === "account") {
      return oneClaimChecked(claim)
        ? { id: p.id, group: "pre", label: p.label, state: "pass", detail: "A verified PayPal account. Checked within this demo round: no other paid or open genuine claim" }
        : { id: p.id, group: "pre", label: p.label, state: "skipped", detail: "A verified PayPal account. Skipped on the demo: one demo account runs all four claims, so this check would stop the rest" };
    }
    return { id: p.id, group: "pre", label: p.label, state: "pass", detail: claim.demo && p.id === "session" ? "Sent inside this claim’s 10-minute session" : p.pass };
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
    rows.push({ id: "payout", group: "pay", label: "Refund sent through PayPal", state: "pass", detail: claim.payout ? `PayPal reference ${claim.payout.batchId}` : undefined });
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

/**
 * The reasons that decided a refused or held claim, most important first. A claim the owner asked a person to look at
 * is held on the rule's refusal, so those reasons are what the person looks at; once a person has refused a claim,
 * their reason is the one that stands.
 */
export function decidingReasons(claim: Pick<Claim, "decision" | "reasons">): Reason[] {
  const reviewed = claim.reasons.find((r) => r.check === "review" && r.outcome === "reject");
  if (claim.decision !== "held" && reviewed) return [reviewed];
  const want = claim.decision === "held" && !reviewAsked(claim) ? "hold" : "reject";
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
      ? `${photos === 2 ? "Both photos" : `All ${["", "one", "two", "three"][photos] ?? photos} photos`} were already used in another claim`
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

/**
 * A claim the checks passed, held only because its payout failed (pipeline.ts): "network" when Remedy couldn't reach
 * PayPal, "refused" when PayPal didn't take it. Null for any other hold.
 */
export function payoutHold(claim: Pick<Claim, "decision" | "reasons" | "events">): "network" | "refused" | null {
  if (claim.decision !== "held" || !claim.reasons.some((r) => r.check === "payout" && r.outcome === "hold")) return null;
  const failed = [...claim.events].reverse().find((e) => e.type === "payout_failed");
  return failed?.detail.startsWith("Remedy couldn't reach PayPal") ? "network" : "refused";
}

// What to do next, per failed check. Keys are rule.ts check names (step_N share one).
const ADVICE: Record<string, string> = {
  session: "Only photos taken in the claim, within 10 minutes of its code, count. A new claim gives you a new code.",
  duplicate_photo: "Start a new claim with new photos of your own product.",
  payer: "Each PayPal account can claim once per recall, so your earlier claim is the one that counts.",
  payer_verified: "Verify your account with PayPal, then start a new claim.",
  state: "This claim was already decided. Its result stands.",
  code: "Write the code exactly as shown, large and in marker, and keep it in focus. A new claim gives you a new code.",
  label: "Make sure the label is in the photo, in focus and readable, then start a new claim.",
  step: "Finish that step, then photograph it on a new claim.",
  screen: "If this was the real pillow, try again in brighter light, with your paper tag and both halves filling the frame.",
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
      return { label: "Didn’t go through", tone: "stop", note: "The company’s recall team has been told and will send it again." };
    case "":
      return { label: "Unknown", tone: "muted", note: "" };
    // Sent, and PayPal hasn't finished: said as the fact it is (it's coming), not as a doubt beside the PAID stamp. One
    // line, so the receipt keeps its height when it turns to Received.
    default:
      return { label: "On its way", tone: "muted", note: "" };
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

/**
 * One alt for a claim's photo at every size (the laptop's photo, the phone's thumbnail): "Your photo for claim RM-0442,
 * tag reads X-VESOLJE M4T", the tag's words once the photo check has read them. `n` numbers one of several photos.
 */
export function photoAlt(claimId: string, read?: { label?: string | null; code?: string | null }, n?: number): string {
  const label = read?.label?.replace(/\s+/g, " ").trim() ?? "";
  const code = read?.code?.trim() ?? "";
  const tag = [label, code && !label.includes(code) ? code : ""].filter(Boolean).join(" ");
  return `Your photo${n ? ` ${n}` : ""} for claim ${claimId}${tag ? `, tag reads ${tag}` : ""}`;
}

/** "••••PUJ3Q": enough to recognise your own account, not enough to copy it. */
export const maskPayer = (payerId: string) => `••••${payerId.slice(-5)}`;

/**
 * "p••@o••••.com": the PayPal login's email, enough for its owner to recognise (the first letter of each part and the
 * domain's ending), not enough to copy or to guess the provider.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return `${email[0] ?? ""}••`;
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  return `${email[0]}••@${domain[0] ?? ""}••••${dot > 0 ? domain.slice(dot) : ""}`;
}

/** The calendar day a time falls on in a zone (undefined: the device's), as "2026-11-08". */
const dayIn = (d: Date, timeZone?: string) => d.toLocaleDateString("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * When a daily limit resets, in the viewer's own time, as a person says it: "5:30 am tomorrow", "11:00 pm today",
 * "10 Nov, 5:30 am" (the time and its am/pm joined by a no-break space, so they never part at a line's end). Client only
 * (the server doesn't know the viewer's zone); `timeZone` pins it in tests.
 */
export function resetWords(until: Date, now: Date, timeZone?: string): string {
  const time = until.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).toLowerCase().replace(/\s+/g, "\u00a0");
  const day = dayIn(until, timeZone);
  if (day === dayIn(now, timeZone)) return `${time} today`;
  if (day === dayIn(new Date(now.getTime() + 86_400_000), timeZone)) return `${time} tomorrow`;
  return `${until.toLocaleDateString("en-GB", { timeZone, day: "numeric", month: "short" })}, ${time}`;
}

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

/**
 * What the hand-written tag goes on, from the proof step that says so ("The X-VESOLJE tag is on the cut pillow" ->
 * "cut pillow"), so the owner's shot list names the tag once.
 */
export function taggedThing(spec: Pick<CheckSpec, "proof_steps">): string | null {
  for (const s of spec.proof_steps) {
    const m = s.match(/\btag is on the (.+?)\.?$/i);
    if (m) return m[1];
  }
  return null;
}

/** "Pillow", from the shot list's "cut pillow"; "Product" when the notice names no tagged thing. */
export const nounOf = (spec: Pick<CheckSpec, "proof_steps">) => {
  const word = taggedThing(spec)?.split(" ").pop() ?? "product";
  return word.charAt(0).toUpperCase() + word.slice(1);
};

/**
 * sessionStorage: this tab took photos on this claim that weren't sent yet. A reload (or iOS reclaiming the tab) drops
 * them, so the code step says so. Set and cleared by the camera; read by the code step.
 */
export const photosTakenKey = (claimId: string) => `remedy:unsent-photos:${claimId}`;

/**
 * The part of a `vw`×`vh` feed that object-cover shows in a `bw`×`bh` box: the centre, cropped to the box's shape. With
 * no box size (not laid out yet), the whole feed.
 */
export function coverCrop(vw: number, vh: number, bw: number, bh: number): { sx: number; sy: number; sw: number; sh: number } {
  if (!bw || !bh) return { sx: 0, sy: 0, sw: vw, sh: vh };
  const box = bw / bh;
  if (vw / vh > box) {
    const sw = Math.round(vh * box);
    return { sx: Math.round((vw - sw) / 2), sy: 0, sw, sh: vh };
  }
  const sh = Math.round(vw / box);
  return { sx: 0, sy: Math.round((vh - sh) / 2), sw: vw, sh };
}

/** A refusal's headline, from the check that decided it: specific where it can be, the general sentence otherwise. */
export function refusalHeadline(claim: Pick<Claim, "decision" | "reasons" | "photos">, spec: Pick<CheckSpec, "proof_steps">): string {
  const check = decidingReasons(claim)[0]?.check ?? "";
  const photo = claim.photos.length > 1 ? "The photos don’t" : "The photo doesn’t";
  const step = /^step_(\d+)$/.exec(check);
  if (step) {
    const text = spec.proof_steps[Number(step[1]) - 1] ?? "";
    return cutInHalf({ proof_steps: [text] }) ? `${photo} show it cut fully in half` : `${photo} show a step the notice asks for`;
  }
  switch (check) {
    case "code":
      return "The code on the tag doesn’t match";
    case "label":
      return "We couldn’t read the recall label";
    case "screen":
      return "This looks like a photo of a screen or a print";
    case "same_item":
      return "The photos show different items";
    case "session":
      return claim.photos.length > 1 ? "These photos weren’t sent from Remedy’s camera" : "This photo wasn’t sent from Remedy’s camera";
    case "duplicate_photo":
      return claim.photos.length > 1 ? "These photos were already used in another claim" : "This photo was already used in another claim";
    case "payer":
      return "This PayPal account already has a claim for this recall";
    case "payer_verified":
      return "This PayPal account isn’t verified";
    case "state":
      return "This claim was already decided";
  }
  return claim.decision === "blocked" ? "Stopped before the photo check" : `${claim.photos.length > 1 ? "These photos don’t" : "This photo doesn’t"} prove the claim`;
}

export interface CodeCell {
  yours: string;
  seen: string;
  same: boolean;
}

const ORDINAL = ["first", "second", "third", "fourth", "fifth", "sixth"];
const DIGITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** One character of a code in words, so O and 0 (or I and 1, S and 5) can't be mistaken: "the letter O", "a zero". */
export const charName = (c: string) => (/^[0-9]$/.test(c) ? `${c === "8" ? "an" : "a"} ${DIGITS[Number(c)]}` : `the letter ${c}`);

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
  if (!off.length) return { cells, caption: `The tag reads ${read}, but the photo check couldn’t confirm it’s your code.`, readable: true };
  const [i] = off;
  if (off.length === 1 && cells[i].yours && cells[i].seen) {
    return { cells, caption: `The ${ORDINAL[i] ?? `character ${i + 1}`} character: ${charName(cells[i].yours)} in your code, ${charName(cells[i].seen)} on the tag.`, readable: true };
  }
  return { cells, caption: `${off.length} of ${n} characters differ: ${yours} in your code, ${read} on the tag.`, readable: true };
}

/**
 * An uncertain code read, in the owner's terms: "We read the letter O where your code has the letter Q", each character
 * named in words, and the way to contest it. Null when nothing was readable or the read matches (nothing specific to say).
 */
export function misreadOf(code: string, seen: string | null | undefined): { headline: string; ask: string } | null {
  const { cells, readable } = codeDiff(code, seen);
  const off = cells.filter((c) => !c.same);
  if (!readable || !off.length) return null;
  const one = off.length === 1 && off[0].yours && off[0].seen ? off[0] : null;
  const wrote = code.toUpperCase();
  return {
    headline: one ? `We read ${charName(one.seen)} where your code has ${charName(one.yours)}` : `We read ${cells.map((c) => c.seen).join("")} where your code is ${wrote}`,
    ask: `If your tag says ${wrote}, ask a person to look. They decide from your photos, and you can ask once.`,
  };
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

/** How long the paid receipt takes to feed out of its slot; the PAID stamp lands after it, once PayPal says Received. */
export const FEED_MS = 900;

/** How long a paid result's passed checks take to fold into their one line, before the receipt starts to print. */
export const FOLD_MS = 320;
