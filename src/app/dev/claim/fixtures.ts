import { LIMIT_HOLD } from "@/app/api/claims/_lib/pipeline";
import { demoRecall } from "@/lib/demo";
import storedVerdicts from "@/lib/demo/verdicts.json";
import { decide } from "@/lib/rule";
import { Verdict, type Claim, type Reason, type Recall } from "@/lib/types";

// Dev-only fixtures for /dev/claim: every step and result of the claim flow without PayPal, a camera or the model.
// Model answers are real stored ones from the eval (src/lib/demo/verdicts.json), decided by the app's own rule. Decided
// fixtures keep the eval's codes (K7Q, R8D), which are written in their photos, though Remedy no longer issues Q or 8.

export const NOW = Date.parse("2026-11-07T14:32:00.000Z");
const at = (s: number) => new Date(NOW + s * 1000).toISOString();

export const recall: Recall = demoRecall(new Date("2026-11-05T09:00:00Z"));

const stored = (prefix: string, model = "gpt-6.1-sol") => {
  const v = (storedVerdicts as { case: string; model: string; code: string; photos: string[]; verdict: unknown }[]).find((x) => x.case.startsWith(prefix) && x.model === model)!;
  return { code: v.code, photos: v.photos, verdict: Verdict.parse(v.verdict) };
};

function base(code: string, over: Partial<Claim> = {}): Claim {
  return {
    id: "RM-4127",
    recallId: recall.id,
    payerId: "8WQ3JX5KPUJ3Q",
    payerVerified: true,
    payoutKey: "5b1d7c1e-3f0a-4a7e-9c2b-8d4e6f1a2b3c",
    code,
    captureSession: { id: "cs_preview", expiresAt: at(9 * 60 + 41) },
    photos: [],
    verdict: null,
    decision: "pending",
    reasons: [],
    payout: null,
    events: [
      { at: at(-19), type: "created", detail: "Logged in with PayPal (verified account)" },
      { at: at(-19), type: "code_issued", detail: `Code ${code} issued; camera session open for 10 minutes` },
    ],
    createdAt: at(-19),
    ...over,
  };
}

const photosOf = (names: string[]) => names.map((n, i) => ({ key: `preview/${i + 1}.jpg`, hash: `00000000000000${i}${i}`.slice(-16) }));

function decided(prefix: string, model?: string, over: Partial<Claim> = {}) {
  const s = stored(prefix, model);
  const { outcome, reasons } = decide(s.verdict, { spec: recall.spec, code: s.code, photos: s.photos.length });
  const claim = base(s.code, { photos: photosOf(s.photos), verdict: s.verdict, reasons, decision: outcome === "pass" ? "paid" : outcome === "hold" ? "held" : "rejected", ...over });
  claim.events.push(
    { at: at(0), type: "photos_received", detail: `${s.photos.length} photos from the live camera` },
    { at: at(0.4), type: "prechecked", detail: "Live session, new photos, first claim for this account" },
    { at: at(16.8), type: "checked", detail: "Photo check answered in 16.4 s (gpt-6.1-sol)" },
  );
  if (outcome !== "pass") claim.events.push({ at: at(17.1), type: "decided", detail: "Decided by the rule" });
  return { claim, photoUrls: s.photos.map((p) => `/demo/${p}`) };
}

export const open = base("M4T");

// The model is reading the photo: received and pre-checked, 18 s in.
export const checkingModel = base("M4T", { photos: photosOf(["c02-1.jpg"]) });
checkingModel.events.push(
  { at: at(0), type: "photos_received", detail: "1 photo from the live camera" },
  { at: at(0.4), type: "prechecked", detail: "Live session, new photos, first claim for this account" },
);

export const paid = (() => {
  const d = decided("c01");
  d.claim.payout = { batchId: "5UXD2E8A7NQ6G", status: "PENDING", updatedAt: at(19) };
  d.claim.events.push(
    { at: at(19), type: "payout_sent", detail: "Payout of $29.99 sent through PayPal" },
    { at: at(19.2), type: "decided", detail: "Every check passed" },
  );
  return d;
})();

// A repost: stopped by the duplicate-photo check alone.
export const blockedDuplicate = (() => {
  const claim = base("M4T", {
    photos: photosOf(["c02-1.jpg"]),
    decision: "blocked",
    reasons: [{ check: "duplicate_photo", outcome: "reject", text: "Photo 1 was already used in another claim" }],
  });
  claim.events.push({ at: at(0), type: "photos_received", detail: "1 photo from the live camera" }, { at: at(0.3), type: "blocked", detail: "Blocked before the photo check" });
  return { claim, photoUrls: ["/demo/c02-1.jpg"] };
})();

/** One demo round, as the index rows give it: which samples ran, and what each got. */
export const roundAfter = (ids: string[]) => ({
  runs: ids.map((sample) => ({ sample, decision: ({ genuine: "paid", "wrong-code": "rejected", "ai-no-session": "blocked", reposted: "blocked" } as const)[sample as "genuine"] })),
});

export const held = decided("c03", "gpt-6.1-terra");

const model: Reason = { check: "model", outcome: "hold", text: "The photo check didn't answer, so a person will look at your photos instead" };
export const heldModel = { claim: base("M4T", { photos: photosOf(["c02-1.jpg"]), decision: "held", reasons: [model] }), photoUrls: ["/demo/c02-1.jpg"] };
const limit: Reason = { check: "model", outcome: "hold", text: LIMIT_HOLD };
export const heldLimit = { claim: base("M4T", { photos: photosOf(["c02-1.jpg"]), decision: "held", reasons: [limit] }), photoUrls: ["/demo/c02-1.jpg"] };

export const heldPayout = (() => {
  const d = decided("c01");
  d.claim.decision = "held";
  d.claim.reasons = [...d.claim.reasons, { check: "payout", outcome: "hold", text: "PayPal didn't accept the payout, so a person will send it" }];
  return d;
})();

export const rejected = decided("c09");
export const rejectedScreen = decided("c10");

export const blocked = {
  claim: base("H6W", {
    photos: photosOf(["c08-1.jpg"]),
    decision: "blocked",
    reasons: [{ check: "session", outcome: "reject", text: "This photo wasn't taken in this claim's camera session" }],
  }),
  photoUrls: ["/demo/c08-1.jpg"],
};
blocked.claim.events.push({ at: at(0), type: "photos_received", detail: "1 photo sent from outside the session" }, { at: at(0.2), type: "blocked", detail: "Blocked before the photo check" });

export const blockedAccount = {
  claim: base("T6K", {
    photos: photosOf(["c02-1.jpg"]),
    decision: "blocked",
    reasons: [
      { check: "duplicate_photo", outcome: "reject", text: "Photo 1 was already used in another claim" },
      { check: "payer", outcome: "reject", text: "This PayPal account already has a claim for this recall (RM-0412)" },
    ],
  }),
  photoUrls: ["/demo/c02-1.jpg"],
};
