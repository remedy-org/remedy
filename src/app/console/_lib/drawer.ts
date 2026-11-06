import type { Claim, Outcome, Recall } from "@/lib/types";
import { decisionSentence, formatMoney, maskPayer, preChecksOf, type PreCheckRow } from "./view";

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
  events: Claim["events"];
  // Approve and reject are offered for held claims; seeded ones can be rejected but never paid.
  review: { approve: boolean; reject: boolean; note: string | null } | null;
  recall: { id: string; autoPay: boolean };
}

const PRE = new Set(["session", "duplicate_photo", "payer", "payer_verified", "state"]);

function checkLabel(check: string, code: string): string {
  if (check === "label") return "Label";
  if (check === "code") return `Code ${code}`;
  if (check === "same_item") return "Same item";
  if (check === "screen") return "Real photo";
  if (check === "review") return "Review";
  const step = check.match(/^step_(\d+)$/);
  return step ? `Step ${step[1]}` : check;
}

function evidenceFor(check: string, verdict: Claim["verdict"]): string | null {
  if (!verdict) return null;
  if (check === "label") return verdict.label.evidence || null;
  if (check === "code") return verdict.challenge_code.evidence || null;
  const step = check.match(/^step_(\d+)$/);
  return step ? (verdict.steps[Number(step[1]) - 1]?.evidence ?? null) : null;
}

export function photoUrl(claimId: string, n: number) {
  return `/api/console/claims/${claimId}/photos/${n}`;
}

export function toDrawerClaim(c: Claim, recall: Recall): DrawerClaim {
  const checks = c.reasons
    .filter((r) => !PRE.has(r.check))
    .map((r) => ({ id: r.check, label: checkLabel(r.check, c.code), outcome: r.outcome, rule: r.text, evidence: evidenceFor(r.check, c.verdict) }));
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
    preChecks: preChecksOf(c),
    checks,
    summary: c.verdict?.summary ?? null,
    sentence: decisionSentence(c, recall),
    amount: formatMoney(recall.refund),
    payout: c.payout ? { batchId: c.payout.batchId, status: c.payout.status, updatedAt: c.payout.updatedAt } : null,
    events: c.events,
    review:
      c.decision === "held"
        ? c.seeded
          ? { approve: false, reject: true, note: "Seeded sample: its PayPal account is made up, so it can be rejected but not paid." }
          : { approve: true, reject: true, note: null }
        : null,
    recall: { id: recall.id, autoPay: recall.autoPay },
  };
}
