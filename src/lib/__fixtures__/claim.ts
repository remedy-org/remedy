import type { Claim, Recall } from "../types";

// Test-only sample data.
export function sampleClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: "RM-0412",
    recallId: "27-071",
    payerId: "47KT8H23PUJ3Q",
    payerVerified: true,
    payoutKey: "5b1d7c1e-3f0a-4a7e-9c2b-8d4e6f1a2b3c",
    code: "K7M",
    captureSession: { id: "cs_a", expiresAt: "2026-11-07T10:10:00.000Z" },
    photos: [{ key: "RM-0412/1.jpg", hash: "0123456789abcdef" }],
    verdict: null,
    decision: "pending",
    reasons: [],
    payout: null,
    events: [{ at: "2026-11-07T10:00:00.000Z", type: "created", detail: "Logged in with PayPal" }],
    createdAt: "2026-11-07T10:00:00.000Z",
    ...overrides,
  };
}

export function sampleRecall(): Recall {
  return {
    id: "27-071",
    title: "Kikea Store Recalls X-VESOLJE Nursing Pillows",
    url: "https://www.cpsc.gov/Recalls/2027/kikea",
    recallDate: "2026-11-05",
    product: "X-VESOLJE Nursing Pillows",
    units: "About 19,596",
    remedy: "Cut the pillow in half.",
    images: [],
    refund: { value: "29.99", currency: "USD" },
    spec: { recall: "Kikea (CPSC 27-071)", source: "https://www.cpsc.gov/Recalls/2027/kikea", product: "nursing pillow", label_must_show: [], proof_steps: ["Cut in half"] },
    createdAt: "2026-11-06T09:00:00.000Z",
  };
}
