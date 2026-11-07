import { duplicateOf } from "@/app/api/claims/_lib/pipeline";
import { APPEAL_CHECK, reviewAsked } from "@/lib/appeal";
import type { ClaimSummary } from "@/lib/store";
import type { Claim, Outcome, Reason, Recall } from "@/lib/types";
import { isSandboxBuild } from "@/lib/demo/allowed";
import { demoSample } from "@/lib/demo/samples";
import { SAMPLE_PRECHECKED, samplePayoutDetail, samplePhotosDetail } from "@/lib/demo/sampleCopy";
import { amountOf, checkLabel, companyReasonText, decisionSentence, formatMoney, maskPayer, preChecksOf, type PreCheckRow } from "./view";

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
export type DrawerEvent = Claim["events"][number] & { raw?: string };

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
  sentence: string;
  amount: string;
  payout: { batchId: string; status: string; updatedAt: string } | null;
  events: DrawerEvent[];
  // A held claim whose last approve the checks stopped before the payout (review.ts): when, and what they found.
  refused: { at: string; text: string } | null;
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
 * A seeded sample's history in the words of a sample: claims seeded before the wording changed still say "live camera"
 * and "sent through PayPal", which never happened. Their made-up PayPal status is left out.
 */
function sampleEvents(c: Claim, amount: string): Claim["events"] {
  return c.events
    .filter((e) => e.type !== "payout_updated")
    .map((e) =>
      e.type === "photos_received"
        ? { ...e, detail: samplePhotosDetail(c.photos.length) }
        : e.type === "prechecked"
          ? { ...e, detail: SAMPLE_PRECHECKED }
          : e.type === "payout_sent"
            ? { ...e, detail: samplePayoutDetail(amount) }
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
const RAW: [RegExp, string][] = [
  [/^Held for a person: photo check failed \(([\s\S]*)\)$/, "Held for a person: the photo check service didn't answer"],
  [/^PayPal didn't take the payout: ([\s\S]*)$/, "PayPal didn't take the payout; nothing was paid"],
];

/** The history in the company's words: no internal ids, and a service's raw answer kept apart. */
function plainEvents(events: Claim["events"]): DrawerEvent[] {
  return events.map((e) => {
    if (e.type === "demo_sample") {
      const title = demoSample(e.detail)?.title;
      return { ...e, detail: title ? `Filed with the judges' sample "${title}"` : "Filed with a judges' sample" };
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

export function toDrawerClaim(c: Claim, recall: Recall): DrawerClaim {
  const amount = formatMoney(amountOf(c.payout?.amount, recall));
  const refused = refusedOf(c);
  const checks = c.reasons
    .filter((r) => !NOT_MODEL.has(r.check))
    .map((r) => ({ id: r.check, label: checkLabel(r.check, c.code), outcome: r.outcome, rule: companyReasonText(r, c.decision), evidence: evidenceFor(r.check, r.outcome, c.verdict) }));
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
    preChecks: preChecksOf(refusedReasons(c, refused).length ? { ...c, reasons: [...c.reasons, ...refusedReasons(c, refused)] } : c),
    checks,
    summary: c.verdict?.summary ?? null,
    sentence: decisionSentence(c, recall),
    appealedAt: reviewAsked(c) ? (c.events.find((e) => e.type === "review_requested")?.at ?? c.createdAt) : null,
    amount,
    // A seeded sample's PayPal batch and status are made up by the seed: nothing was sent, so there is none to show.
    payout: c.payout && !c.seeded ? { batchId: c.payout.batchId, status: c.payout.status, updatedAt: c.payout.updatedAt } : null,
    events: plainEvents(c.seeded ? sampleEvents(c, amount) : c.events),
    refused,
    rejected: rejectedOf(c),
    duplicate: null,
    review:
      c.decision === "held"
        ? c.seeded
          ? { sample: true, note: "Seeded sample, in every company's console, with a made-up PayPal account. Approve or reject shows what each does; no money moves and nothing is saved." }
          : { sample: false, note: null }
        : null,
    recall: { id: recall.id, autoPay: recall.autoPay },
    sandbox: isSandboxBuild(),
  };
}
