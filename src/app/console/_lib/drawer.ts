import { duplicateOf } from "@/app/api/claims/_lib/pipeline";
import { cutInHalf, handWrittenLabel, nounOf } from "@/components/claim/model";
import { APPEAL_CHECK, reviewAsked } from "@/lib/appeal";
import type { ClaimSummary } from "@/lib/store";
import type { Claim, Outcome, Reason, Recall } from "@/lib/types";
import { isSandboxBuild } from "@/lib/demo/allowed";
import { datasetTagSpot } from "@/lib/demo/dataset";
import { demoSample } from "@/lib/demo/samples";
import { PAYPAL_CONFIRMED } from "@/lib/payoutWords";
import { checkOf, fiveNames, type CheckNumber } from "@/lib/fiveChecks";
import { summarize } from "@/lib/store/store";
import { allPreChecks, amountOf, checkLabel, companyReasonText, decisionSentence, formatMoney, maskPayer, preChecksOf, toRow, type PreCheckRow, type PreCheckState } from "./view";

// Everything the evidence drawer shows for one claim, built on the server so the client never sees a full payer id.

export interface DrawerCheck {
  id: string;
  // What was checked: "Label", "Step 1".
  label: string;
  outcome: Outcome;
  // The rule's sentence for this check.
  rule: string;
  // The model's quoted evidence, verbatim.
  evidence: string | null;
}

/**
 * One of the five checks, as the owner's result and the homepage name it, with what was recorded under it: the account
 * checks' rows (check 3 holds "Verified PayPal account" too) and the photo check's answers (the label, the code and the
 * tag's own step under check 4, the other proof steps, the same item and a real photo under check 5: fiveChecks.ts
 * checkOf).
 */
export interface FiveRow {
  n: CheckNumber;
  /** What the row is headed with, always (fiveChecks.ts): what is in doubt under it leads its detail lines. */
  name: string;
  state: PreCheckState;
  /** Skipped: it was never run, because an earlier check stopped the claim (else it doesn't apply to this claim). */
  unrun: boolean;
  /** Why it was skipped, when nothing recorded says it. */
  note: string | null;
  parts: { id: string; label: string; state: PreCheckState; text: string; evidence: string | null }[];
}

// Worst first: a check is as bad as its worst answer; one that didn't apply (skipped) isn't a pass.
const RANK: PreCheckState[] = ["reject", "hold", "waiting", "skipped", "pass"];

/** The five checks from the pre-checks (all of them, skipped included) and the photo check's answers. */
export function fiveRowsOf(c: Pick<Claim, "code" | "decision" | "photos" | "seeded" | "demo">, recall: Pick<Recall, "spec">, pre: PreCheckRow[], checks: DrawerCheck[]): FiveRow[] {
  const [n1, n2, n3, n4, n5] = fiveNames(c.code, handWrittenLabel(recall.spec), nounOf(recall.spec), cutInHalf(recall.spec));
  const names: Record<CheckNumber, string> = { 1: n1, 2: n2, 3: n3, 4: n4, 5: n5 };
  const parts: FiveRow["parts"] = [
    ...pre.map((p) => ({ id: p.id, label: p.label, state: p.state, text: p.detail, evidence: null })),
    ...checks.map((r) => ({ id: r.id, label: r.label, state: r.outcome as PreCheckState, text: r.rule, evidence: r.evidence })),
  ];
  // The photo check that never answered stands for both of its checks.
  const under = (n: CheckNumber) => parts.filter((p) => (p.id === "model" ? n === 4 || n === 5 : checkOf(p.id, recall.spec.proof_steps) === n));
  const ran = c.photos.length > 0 || c.decision === "blocked";
  return ([1, 2, 3, 4, 5] as const).map((n) => {
    const own = under(n);
    if (!own.length) {
      return ran && c.decision !== "pending"
        ? { n, name: names[n], state: "skipped", unrun: true, note: "An earlier check stopped the claim.", parts: [] }
        : { n, name: names[n], state: "waiting", unrun: false, note: null, parts: [] };
    }
    const state = RANK.find((s) => own.some((p) => p.state === s)) ?? "pass";
    // A demo claim after the genuine one: the account check counts once, on the genuine claim, as the owner was told. Any
    // other check not run says so once, in its row's state ("Not run"), with no note repeating it.
    const note = state === "skipped" && n === 3 && c.demo ? "Counted once, on the genuine claim." : null;
    const kept = own.filter((p) => p.state !== "skipped");
    return { n, name: names[n], state, unrun: false, note, parts: kept };
  });
}

/** The five in one line: "4 of 5 checks passed · 1 not run", in the rows' own words. */
export function fiveLine(rows: FiveRow[]): string {
  const count = (pred: (r: FiveRow) => boolean) => rows.filter(pred).length;
  const passed = count((r) => r.state === "pass");
  const rest: [number, string][] = [
    [count((r) => r.state === "reject"), "failed"],
    [count((r) => r.state === "hold"), "held"],
    [count((r) => r.state === "skipped"), "not run"],
    [count((r) => r.state === "waiting"), "waiting"],
  ];
  return [`${passed} of ${rows.length} checks passed`, ...rest.filter(([k]) => k > 0).map(([k, w]) => `${k} ${w}`)].join(" · ");
}

// A history line as the company reads it: plain words, with a service's raw answer (an API error, PayPal's message)
// kept apart, behind a toggle.
// A failed payout's event also says which failure it was (Remedy not reaching PayPal, or PayPal refusing it) in two
// parts: what happened, and what it means now.
export type DrawerEvent = Claim["events"][number] & { raw?: string; failure?: PayoutFailureWords };

export interface PayoutFailureWords {
  kind: "network" | "paypal";
  what: string;
  next: string;
}

export interface DrawerClaim {
  id: string;
  createdAt: string;
  decision: Claim["decision"];
  payer: string;
  verified: boolean;
  code: string;
  seeded: boolean;
  demo: boolean;
  photos: string[];
  preChecks: PreCheckRow[];
  checks: DrawerCheck[];
  // The model's own one-line summary, when it answered.
  summary: string | null;
  // The five checks in one line, as the owner's result counts them: "4 of 5 checks passed · 1 skipped".
  five: string;
  // The five checks, each with what was recorded under it.
  fiveRows: FiveRow[];
  // What the photo shows, in a few words from the checks (never the model's prose): the photo's accessible name.
  /** Each photo's description, in order (photoAltsOf). */
  photoAlt: (string | null)[];
  /** Where the tag is, when Remedy knows it: the photo (0-based) and the spot (0 to 1), for the panel's Zoom to tag; and
   * the tag cut from the photo's full-size original at 4x (a public file), which Zoom to tag shows when there is one. */
  tagSpot: { photo: number; x: number; y: number; enlarged?: string } | null;
  sentence: string;
  /** The grid row's line for this claim (view.ts toRow's note), word for word: the panel's headline for a held or
   * refused claim, so the row and the panel say one reason ("Tag reads K7Q · code is K7P"). */
  note: string | null;
  amount: string;
  // itemId: PayPal's id for this one payout (older claims have only the batch's).
  payout: { batchId: string; itemId?: string; status: string; updatedAt: string } | null;
  events: DrawerEvent[];
  // A held claim whose last approve the checks stopped before the payout (review.ts): when, and what they found.
  refused: { at: string; text: string } | null;
  // What the checks run again on approve would stop the payout for now (review.ts approveConflicts), in the history's
  // words: filled by the route for a held claim, so the evidence says before the decision what approve will do.
  stops: string[];
  // A claim a person rejected: who, when and the reason they gave the owner.
  rejected: { at: string; by: string | null; reason: string } | null;
  // A repost blocked as a duplicate photo: the earlier claim on this recall that has it, and its matching photo
  // (filled by the route, which has the index).
  duplicate: { photo: number; id: string; theirs: number; of: number; src: string | null } | null;
  // The owner asked a person to look at a claim the rule refused (src/lib/appeal.ts): when, or null.
  appealedAt: string | null;
  // Approve and reject for held claims.
  review: { note: string | null } | null;
  recall: { id: string; autoPay: boolean };
  // Payouts in this build go to PayPal's sandbox: the approve step says so beside the amount.
  sandbox: boolean;
}

// What approve and reject answer: the claim as decided.
export type ReviewedClaim = DrawerClaim;

// Pre-check reasons, a person's review, the owner's ask for one, auto-pay and the PayPal payout aren't model answers:
// the drawer shows them elsewhere (the pre-checks, what decided it, and the decision sentence).
const NOT_MODEL = new Set(["session", "duplicate_photo", "payer", "payer_verified", "state", "review", APPEAL_CHECK, "auto_pay", "payout"]);


function evidenceFor(check: string, outcome: Outcome, verdict: Claim["verdict"]): string | null {
  if (!verdict) return null;
  if (check === "label") return verdict.label.evidence || null;
  if (check === "code") return verdict.challenge_code.evidence || null;
  // The verdict has no quote of its own for these two answers: when one held or failed the claim, the model's summary
  // is its reasoning.
  if ((check === "same_item" || check === "screen") && outcome !== "pass") return verdict.summary || null;
  const step = check.match(/^step_(\d+)$/);
  return step ? (verdict.steps[Number(step[1]) - 1]?.evidence ?? null) : null;
}

export function photoUrl(claimId: string, n: number) {
  return `/api/console/claims/${claimId}/photos/${n}`;
}

/**
 * A seeded claim's history in the console's words, as every other claim's reads. Claims seeded before lib/demo/claims.ts
 * stored other lines; a payout line only where the claim has a payout, so nothing reads as sent that wasn't.
 */
function starterEvents(c: Claim, amount: string): Claim["events"] {
  const n = c.photos.length;
  return c.events.flatMap((e) =>
    e.type === "photos_received"
      ? [{ ...e, detail: `${n} ${n === 1 ? "photo" : "photos"} received` }]
      : e.type === "prechecked"
        ? [{ ...e, detail: "Live session, new photos, no other paid or open claim from this account" }]
        : e.type === "payout_sent"
          ? c.payout?.status === "SUCCESS"
            ? [{ ...e, detail: `Payout of ${amount} sent through PayPal` }]
            : []
          : e.type === "payout_updated"
            ? c.payout?.status === "SUCCESS"
              ? [{ ...e, detail: PAYPAL_CONFIRMED }]
              : []
            : [e],
  );
}

const REFUSED_PREFIX = "Not paid on review: ";
// The conflicts sendCheck words (lib/rule.ts), for claims refused before review.ts kept them as reasons.
const CONFLICT: [RegExp, string][] = [
  [/already has a claim for this recall/, "payer"],
  [/was already used in another claim/, "duplicate_photo"],
  [/isn't verified/, "payer_verified"],
];

/** The last approve the checks stopped, if nothing was approved or decided after it. */
function refusedOf(c: Claim): DrawerClaim["refused"] {
  if (c.decision !== "held") return null;
  const last = [...c.events].reverse().find((e) => e.type === "approve_refused" || e.type === "approved" || e.type === "payout_sent");
  return last?.type === "approve_refused" ? { at: last.at, text: last.detail.replace(REFUSED_PREFIX, "") } : null;
}

/** A refused approve's conflicts as holds, so the pre-checks show them. */
function refusedReasons(c: Claim, refused: DrawerClaim["refused"]): Reason[] {
  if (!refused) return [];
  return refused.text.split("; ").flatMap((text): Reason[] => {
    const check = CONFLICT.find(([re]) => re.test(text))?.[1];
    return check && !c.reasons.some((r) => r.check === check && r.outcome !== "pass") ? [{ check, outcome: "hold", text }] : [];
  });
}

function rejectedOf(c: Claim): DrawerClaim["rejected"] {
  if (c.decision !== "rejected") return null;
  const reason = c.reasons.find((r) => r.check === "review" && r.outcome === "reject");
  if (!reason) return null;
  const e = [...c.events].reverse().find((e) => e.type === "rejected");
  return { at: e?.at ?? c.createdAt, by: e?.detail.match(/\(by (.+)\)$/)?.[1] ?? null, reason: reason.text.replace(/^Rejected on review:\s*/, "") };
}

// Raw answers some events carry after their plain words: a failed photo check's API error, PayPal's message.
const RAW: [RegExp, string][] = [[/^Held for a person: photo check failed \(([\s\S]*)\)$/, "Held for a person: the photo check service didn't answer"]];

// A failed payout's history line (pipeline.ts payoutFailedDetail; older claims say "PayPal refused the payout", and
// called a network error PayPal's answer).
const PAYOUT_FAILED = /^(?:Remedy couldn't reach PayPal|PayPal didn't take the payout|PayPal refused the payout): ([\s\S]*)$/;
// What a request that never reached PayPal says: Node's fetch, DNS and socket errors, a timeout.
const NETWORK = /fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|socket|network|timed? ?out|aborted/i;
// PayPal's refusals a company can act on, in words.
const ISSUES: Record<string, string> = {
  RECEIVER_UNREGISTERED: "the owner's PayPal account can't receive payouts",
  INSUFFICIENT_FUNDS: "the paying PayPal account's balance is too low",
  RECEIVER_ACCOUNT_LOCKED: "the owner's PayPal account is locked",
};

/** A failed payout's history line as people read it: what happened and that nothing was sent, the raw answer apart. */
export function payoutFailureWords(detail: string): (PayoutFailureWords & { raw: string }) | null {
  const m = detail.match(PAYOUT_FAILED);
  if (!m) return null;
  const raw = m[1];
  if (detail.startsWith("Remedy couldn't reach PayPal") || NETWORK.test(raw)) {
    return { kind: "network", what: "Remedy couldn't reach PayPal (a network error)", next: "Nothing was sent, so it's safe to try again.", raw };
  }
  const issue = raw.match(/^[A-Z][A-Z_]+/)?.[0];
  const why = issue && ISSUES[issue];
  return { kind: "paypal", what: `PayPal didn't take the payout${why ? `: ${why}` : issue ? ` (${issue})` : ""}`, next: "Nothing was sent.", raw };
}

/** The history in the company's words: no internal ids, and a service's raw answer kept apart. */
function plainEvents(events: Claim["events"]): DrawerEvent[] {
  return events.map((e) => {
    // PayPal's raw status for a settled payout ("PayPal: SUCCESS", lib/paypal/status.ts) in the console's words.
    if (e.type === "payout_updated" && e.detail === "PayPal: SUCCESS") return { ...e, detail: PAYPAL_CONFIRMED };
    if (e.type === "demo_sample") {
      const title = demoSample(e.detail)?.title;
      return { ...e, detail: title ? `Filed from the demo: "${title}"` : "Filed from the demo" };
    }
    const failed = e.type === "payout_failed" ? payoutFailureWords(e.detail) : null;
    if (failed) {
      const { raw, ...failure } = failed;
      return { ...e, detail: `${failure.what}. ${failure.next}`, raw, failure };
    }
    for (const [re, plain] of RAW) {
      const m = e.detail.match(re);
      if (m) return { ...e, detail: plain, raw: m[1] };
    }
    return e;
  });
}

/** A blocked repost's earlier claim, when it is on the same recall (another company's claim never shows). */
export function duplicateFor(c: Claim, rows: ClaimSummary[]): DrawerClaim["duplicate"] {
  const reason = c.reasons.find((r) => r.check === "duplicate_photo");
  if (c.decision !== "blocked" || !reason) return null;
  const match = duplicateOf(c, rows) ?? namedCopy(c, reason.text, rows);
  const row = match && rows.find((r) => r.id === match.id);
  if (!match || !row || row.recallId !== c.recallId) return null;
  return { photo: match.photo, id: match.id, theirs: match.theirs, of: row.photoHashes.length, src: null };
}

/** A claim that came with the console isn't checked against the others (they share sample photos), so its one repost
 * names the claim it copied in its reason ("…already used in another claim, RM-6276"): that claim's matching photo. */
function namedCopy(c: Claim, text: string, rows: ClaimSummary[]): { photo: number; id: string; theirs: number } | null {
  if (!c.seeded) return null;
  const id = text.match(/\bRM-\d{4}\b/)?.[0];
  const row = id ? rows.find((r) => r.id === id && r.seeded) : undefined;
  if (!row) return null;
  for (const [i, p] of c.photos.entries()) {
    const j = row.photoHashes.indexOf(p.hash);
    if (j >= 0) return { photo: i + 1, id: row.id, theirs: j + 1 };
  }
  return null;
}

// A check that approve would stop the payout on, said on its pre-check row before anyone decides.
const willStop = (rows: PreCheckRow[], stops: string[]): PreCheckRow[] =>
  rows.map((row) => {
    const text = stops.find((t) => CONFLICT.some(([re, check]) => check === row.id && re.test(t)));
    return text && row.state !== "hold" && row.state !== "reject" ? { ...row, state: "hold", detail: `Approve won't pay: ${text.charAt(0).toLowerCase()}${text.slice(1)}. Remedy runs this check again on approve.` } : row;
  });

const ORDINAL: Record<string, number> = { first: 0, second: 1, third: 2 };

/** Each photo in a few words, from what the checks read: "Claim photo: pillow cut in half, tag reads X-VESOLJE K7Q".
 * With more than one photo the cut is said only of the photos the step's evidence names ("The second photo shows two
 * separated pillow sections"), so a close-up of the tag is never described as the cut pillow. */
function photoAltsOf(c: Pick<Claim, "verdict" | "reasons" | "photos">, recall: Pick<Recall, "spec">): (string | null)[] {
  const v = c.verdict;
  if (!v) return c.photos.map(() => null);
  const done = v.steps.length > 0 && v.steps.every((s) => s.status === "done");
  const thing = nounOf(recall.spec).toLowerCase();
  // The label as read often carries the code too ("X-VESOLJE K7Q"): said once.
  const code = v.challenge_code.text_seen ?? "";
  const read = [(v.label.text_seen ?? "").replace(code, "").trim(), code].filter(Boolean).join(" ");
  const named = new Set(
    v.steps.flatMap((s) => [...s.evidence.matchAll(/\b(first|second|third) photo\b|\bphoto (\d)\b/gi)].map((m) => (m[1] ? ORDINAL[m[1].toLowerCase()] : Number(m[2]) - 1))),
  );
  return c.photos.map((_, i) => {
    const cut = done && (c.photos.length === 1 || named.has(i));
    const parts = [cut ? `${thing} ${cutInHalf(recall.spec) ? "cut in half" : "destroyed"}` : null, read ? `tag reads ${read}` : null].filter(Boolean);
    return parts.length ? `Claim photo: ${parts.join(", ")}` : null;
  });
}

/** The claim as the panel shows it. stops: what approve would be stopped for now (approveConflicts' texts); copiedFrom:
 * the earlier claim a blocked repost's photo matches (queue.ts copiedFrom), which the grid's line names. */
export function toDrawerClaim(c: Claim, recall: Recall, { stops = [], copiedFrom = null }: { stops?: string[]; copiedFrom?: string | null } = {}): DrawerClaim {
  const amount = formatMoney(amountOf(c.payout?.amount, recall));
  const refused = refusedOf(c);
  const pre = preChecksOf(refusedReasons(c, refused).length ? { ...c, reasons: [...c.reasons, ...refusedReasons(c, refused)] } : c);
  const checks = c.reasons
    .filter((r) => !NOT_MODEL.has(r.check))
    .map((r) => ({ id: r.check, label: checkLabel(r.check, c.code, recall.spec.proof_steps), outcome: r.outcome, rule: companyReasonText(r, c.decision), evidence: evidenceFor(r.check, r.outcome, c.verdict) }));
  const all = allPreChecks(refusedReasons(c, refused).length ? { ...c, reasons: [...c.reasons, ...refusedReasons(c, refused)] } : c);
  // The rows say what approve would be stopped for now; the count line is what was recorded.
  const rows = fiveRowsOf(c, recall, willStop(all, stops), checks);
  return {
    id: c.id,
    createdAt: c.createdAt,
    decision: c.decision,
    payer: maskPayer(c.payerId),
    verified: c.payerVerified,
    code: c.code,
    seeded: Boolean(c.seeded),
    demo: Boolean(c.demo),
    photos: c.photos.map((_, i) => photoUrl(c.id, i)),
    preChecks: willStop(pre, stops),
    checks,
    summary: c.verdict?.summary ?? null,
    // What was recorded, not what approve would find now.
    five: fiveLine(fiveRowsOf(c, recall, all, checks)),
    fiveRows: rows,
    photoAlt: photoAltsOf(c, recall),
    tagSpot: datasetTagSpot(c.photos.map((p) => p.key)),
    // A starter claim a person approved sends nothing, ever: the decision is what was recorded, never "nothing sent yet".
    sentence: c.seeded && c.decision === "paid" && !c.payout && c.reasons.some((r) => r.check === "review") ? "Approved on review: your decision is recorded." : decisionSentence(c, recall),
    note: toRow(summarize(c), recall, undefined, copiedFrom).note,
    appealedAt: reviewAsked(c) ? (c.events.find((e) => e.type === "review_requested")?.at ?? c.createdAt) : null,
    amount,
    // A starter claim's payout has settled; its batch ids are the workspace's own, so the panel shows no PayPal ids for it.
    payout: !c.payout ? null : c.seeded ? { batchId: "", status: c.payout.status, updatedAt: c.payout.updatedAt } : { batchId: c.payout.batchId, ...(c.payout.itemId ? { itemId: c.payout.itemId } : {}), status: c.payout.status, updatedAt: c.payout.updatedAt },
    events: plainEvents(c.seeded ? starterEvents(c, amount) : c.events),
    refused,
    stops: c.decision === "held" && !c.seeded ? stops : [],
    rejected: rejectedOf(c),
    duplicate: null,
    review: c.decision === "held" ? { note: null } : null,
    recall: { id: recall.id, autoPay: recall.autoPay },
    sandbox: isSandboxBuild(),
  };
}
