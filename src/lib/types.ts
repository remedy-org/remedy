import { z } from "zod";

// CPSC recall number as CPSC prints it, e.g. "27-071".
export const RecallId = z.string().regex(/^\d{2}-\d{3,4}$/);
export const ClaimId = z.string().regex(/^RM-\d{4}$/);

// Amounts stay strings ("29.99") end to end, as PayPal takes them; never floats.
export const Money = z.object({
  value: z.string().regex(/^\d+\.\d{2}$/),
  currency: z.literal("USD"),
});
export type Money = z.infer<typeof Money>;

// What a claim's photos must show. Same shape as eval/specs/*.json.
export const CheckSpec = z.object({
  recall: z.string(),
  source: z.url(),
  product: z.string(),
  label_must_show: z.array(z.string()),
  proof_steps: z.array(z.string()).min(1),
  note: z.string().optional(),
});
export type CheckSpec = z.infer<typeof CheckSpec>;

export const Recall = z.object({
  id: RecallId,
  title: z.string(),
  url: z.url(),
  recallDate: z.string(),
  product: z.string(),
  // CPSC's own wording, e.g. "About 19,596".
  units: z.string(),
  remedy: z.string(),
  images: z.array(z.object({ url: z.url(), caption: z.string() })),
  refund: Money,
  spec: CheckSpec,
  createdAt: z.iso.datetime(),
});
export type Recall = z.infer<typeof Recall>;

// The vision model's answer. Field names are the ones evaluated in spike 2: do not rename.
const Tri = z.enum(["yes", "no", "unclear"]);
export const Verdict = z.object({
  label: z.object({ text_seen: z.string().nullable(), matches_recalled_product: Tri, evidence: z.string() }),
  steps: z.array(z.object({ step: z.string(), status: z.enum(["done", "not_done", "unclear"]), evidence: z.string() })),
  challenge_code: z.object({ text_seen: z.string().nullable(), matches: Tri, evidence: z.string() }),
  same_item_in_all_photos: Tri,
  looks_like_photo_of_screen_or_print: Tri,
  summary: z.string(),
});
export type Verdict = z.infer<typeof Verdict>;

export const Outcome = z.enum(["pass", "hold", "reject"]);
export type Outcome = z.infer<typeof Outcome>;

export const Reason = z.object({ check: z.string(), outcome: Outcome, text: z.string() });
export type Reason = z.infer<typeof Reason>;

// "blocked" = stopped by a pre-check before the photos reached the model.
export const Decision = z.enum(["paid", "held", "rejected", "blocked", "pending"]);
export type Decision = z.infer<typeof Decision>;

export const CaptureSession = z.object({ id: z.string(), expiresAt: z.iso.datetime() });
export type CaptureSession = z.infer<typeof CaptureSession>;

export const Payout = z.object({
  batchId: z.string(),
  itemId: z.string().optional(),
  // PayPal's own status string: batch status until the item status is known.
  status: z.string(),
  updatedAt: z.iso.datetime(),
});
export type Payout = z.infer<typeof Payout>;

export const Claim = z.object({
  id: ClaimId,
  recallId: RecallId,
  payerId: z.string(),
  payerVerified: z.boolean(),
  // Set once at creation and saved before the first send: PayPal's request id and sender_batch_id for this claim.
  // The RM- id is display only; it repeats across stores and resets that pay from the same PayPal account.
  payoutKey: z.uuid(),
  code: z.string(),
  captureSession: CaptureSession.nullable(),
  photos: z.array(z.object({ key: z.string(), hash: z.string().regex(/^[0-9a-f]{16}$/) })),
  verdict: Verdict.nullable(),
  decision: Decision,
  reasons: z.array(Reason),
  payout: Payout.nullable(),
  events: z.array(z.object({ at: z.iso.datetime(), type: z.string(), detail: z.string() })),
  createdAt: z.iso.datetime(),
});
export type Claim = z.infer<typeof Claim>;
