import { describe, expect, it } from "vitest";
import { sampleClaim, sampleRecall } from "@/lib/__fixtures__/claim";
import { summarize } from "@/lib/store/store";
import { buildReport } from "./report";

const recall = { ...sampleRecall(), refund: { value: "29.99", currency: "USD" as const }, unitsSold: 19_596, autoPay: true };
const at = "2026-11-07T10:00:00.000Z";

describe("the progress report", () => {
  it("counts a unit corrected by refund only once PayPal sent its refund, and an approved one with nothing sent apart", () => {
    const claims = [
      sampleClaim({ decision: "paid", payout: { batchId: "B", status: "SUCCESS", updatedAt: at } }),
      sampleClaim({ decision: "paid", payout: { batchId: "C", status: "PENDING", updatedAt: at } }),
      // Approved, no payout: remedied, not yet corrected.
      sampleClaim({ decision: "paid" }),
      sampleClaim({ decision: "held" }),
    ].map(summarize);
    const r = buildReport(claims, recall);
    expect(r.stats.remedied).toBe(3);
    expect(r).toMatchObject({ correctedByRefund: 2, approvedUnsent: 1, sent: 2 });
    expect(r.outcomes.find((o) => o.verdict === "approved")).toMatchObject({ count: 1 });
  });

  it("corrects nothing when the one approved claim has no payout", () => {
    const r = buildReport([summarize(sampleClaim({ decision: "paid" }))], recall);
    expect(r).toMatchObject({ correctedByRefund: 0, approvedUnsent: 1, sentCents: 0, sent: 0 });
    expect(r.stats.remedied).toBe(1);
  });
});
