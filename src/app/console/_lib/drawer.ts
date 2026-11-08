import { duplicateOf } from "@/app/api/claims/_lib/pipeline";
import { APPEAL_CHECK, reviewAsked } from "@/lib/appeal";
import type { ClaimSummary } from "@/lib/store";
import type { Claim, Outcome, Reason, Recall } from "@/lib/types";
import { isSandboxBuild } from "@/lib/demo/allowed";
import { demoSample } from "@/lib/demo/samples";
import { amountOf, checkCount, checkLabel, companyReasonText, decisionSentence, formatMoney, maskPayer, preChecksOf, type PreCheckRow } from "./view";

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
  // The checks in one line, as the grid's barcode counts them: "Pre-checks 4 of 4 · Model answers 4 of 5".
  five: string;
  sentence: string;
  amount: string;
  payout: { batchId: string; status: string; updatedAt: string } | null;
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
  // Approve and reject for held claims. A seeded one's review is a sample: answered, but never paid or saved.
  review: { sample: boolean; note: string | null } | null;
  recall: { id: string; autoPay: boolean };
  // Payouts in this build go to PayPal's sandbox: the approve step says so beside the amount.
  sandbox: boolean;
}

// What approve and reject answer: the claim, and for a seeded claim what the review would have done.
export type ReviewedClaim = DrawerClaim & { sample?: string };

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
 * A seeded claim's history as it happened: it came with the console and never pays out, so no payout left and no PayPal
 * status exists. The stored lines (lib/demo/sampleCopy.ts) are rewritten in the console's words.
 */
function sampleEvents(c: Claim, amount: string): Claim["events"] {
  const n = c.photos.length;
  return c.events
    .filter((e) => e.type !== "payout_updated")
    .map((e) =>
      e.type === "photos_received"
        ? { ...e, detail: `${n} ${n === 1 ? "photo" : "photos"} received` }
        : e.type === "prechecked"
          ? { ...e, detail: "Pre-checks passed" }
          : e.type === "payout_sent"
            ? { ...e, detail: `Approved for ${amount}. No payout: this claim came with your console.` }
            : e,
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
  if (c.decision !== "blocked" || !c.reasons.some((r) => r.check === "duplicate_photo")) return null;
  const match = duplicateOf(c, rows);
  const row = match && rows.find((r) => r.id === match.id);
  if (!match || !row || row.recallId !== c.recallId) return null;
  return { photo: match.photo, id: match.id, theirs: match.theirs, of: row.photoHashes.length, src: null };
}

// A check that approve would stop the payout on, said on its pre-check row before anyone decides.
const willStop = (rows: PreCheckRow[], stops: string[]): PreCheckRow[] =>
  rows.map((row) => {
    const text = stops.find((t) => CONFLICT.some(([re, check]) => check === row.id && re.test(t)));
    return text && row.state !== "hold" && row.state !== "reject" ? { ...row, state: "hold", detail: `Approve won't pay: ${text.charAt(0).toLowerCase()}${text.slice(1)}. Remedy runs this check again on approve.` } : row;
  });

/** The claim as the panel shows it. stops: what approve would be stopped for now (approveConflicts' texts). */
export function toDrawerClaim(c: Claim, recall: Recall, { stops = [] }: { stops?: string[] } = {}): DrawerClaim {
  const amount = formatMoney(amountOf(c.payout?.amount, recall));
  const refused = refusedOf(c);
  const pre = preChecksOf(refusedReasons(c, refused).length ? { ...c, reasons: [...c.reasons, ...refusedReasons(c, refused)] } : c);
  const checks = c.reasons
    .filter((r) => !NOT_MODEL.has(r.check))
    .map((r) => ({ id: r.check, label: checkLabel(r.check, c.code, recall.spec.proof_steps), outcome: r.outcome, rule: companyReasonText(r, c.decision), evidence: evidenceFor(r.check, r.outcome, c.verdict) }));
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
    // What was recorded, as the grid's barcode counts it (barsSentence), not what approve would find now.
    five: checkCount([...pre.map((p) => ({ id: p.id, state: p.state })), ...checks.map((r) => ({ id: r.id, state: r.outcome }))]),
    sentence: decisionSentence(c, recall),
    appealedAt: reviewAsked(c) ? (c.events.find((e) => e.type === "review_requested")?.at ?? c.createdAt) : null,
    amount,
    // A seeded sample's PayPal batch and status are made up by the seed: nothing was sent, so there is none to show.
    payout: c.payout && !c.seeded ? { batchId: c.payout.batchId, status: c.payout.status, updatedAt: c.payout.updatedAt } : null,
    events: plainEvents(c.seeded ? sampleEvents(c, amount) : c.events),
    refused,
    stops: c.decision === "held" && !c.seeded ? stops : [],
    rejected: rejectedOf(c),
    duplicate: null,
    review:
      c.decision === "held"
        ? { sample: Boolean(c.seeded), note: null }
        : null,
    recall: { id: recall.id, autoPay: recall.autoPay },
    sandbox: isSandboxBuild(),
  };
}
