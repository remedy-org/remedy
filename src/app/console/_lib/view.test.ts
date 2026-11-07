import { describe, expect, it } from "vitest";
import { sampleClaim, sampleRecall } from "@/lib/__fixtures__/claim";
import { summarize } from "@/lib/store/store";
import type { Reason } from "@/lib/types";
import { toDrawerClaim } from "./drawer";
import { PublishInput, RefundValue, slugify, summarizeCpsc, uniqueSlug } from "./recalls";
import { buildReport } from "./report";
import { decisionSentence, formatCents, maskPayer, percent, preChecksOf, reasonOf, statsOf, toRow } from "./view";
import cpsc27071 from "@/lib/__fixtures__/cpsc-27071.json";
import { CpscRecord } from "@/lib/cpsc";

const recall = { ...sampleRecall(), refund: { value: "29.99", currency: "USD" as const }, unitsSold: 19_596, autoPay: true };
const reject = (check: string, text: string): Reason => ({ check, outcome: "reject", text });

describe("console view", () => {
  it("formats money from cents and masks payer ids", () => {
    expect(formatCents(77974)).toBe("$779.74");
    expect(formatCents(123456789)).toBe("$1,234,567.89");
    expect(maskPayer("47KT8H23PUJ3Q")).toBe("•••• UJ3Q");
  });

  it("never shows a first remedied unit as 0%", () => {
    expect(percent(1, 175_951)).toBe("<0.01%");
    expect(percent(26, 19_596)).toBe("0.13%");
    expect(percent(0, 10)).toBe("0%");
    expect(percent(3, 0)).toBe("—");
  });

  it("counts the header numbers from claims and the refund", () => {
    const claims = [
      sampleClaim({ decision: "paid", payout: { batchId: "B", status: "SUCCESS", updatedAt: "2026-11-07T10:00:00.000Z" } }),
      sampleClaim({ decision: "paid", payout: { batchId: "C", status: "PENDING", updatedAt: "2026-11-07T10:00:00.000Z" } }),
      sampleClaim({ decision: "held" }),
      sampleClaim({ decision: "rejected" }),
      sampleClaim({ decision: "blocked" }),
      sampleClaim({ decision: "pending" }),
    ];
    expect(statsOf(claims.map(summarize), recall)).toEqual({ total: 6, remedied: 2, unitsSold: 19_596, paidCents: 5998, settling: 1, held: 1, rejected: 1, blocked: 1, pending: 1 });
  });

  it("keeps a paid claim's recorded amount when the refund changes later", () => {
    const paid = sampleClaim({ decision: "paid", payout: { batchId: "B", status: "SUCCESS", updatedAt: "2026-11-07T10:00:00.000Z", amount: { value: "29.99", currency: "USD" } } });
    const repriced = { ...recall, refund: { value: "50.00", currency: "USD" as const } };
    expect(statsOf([paid, sampleClaim({ decision: "paid" })].map(summarize), repriced).paidCents).toBe(2999 + 5000);
    expect(toRow(summarize(paid), repriced).amount).toBe("$29.99");
    expect(buildReport([summarize(paid)], repriced)).toMatchObject({ settledCents: 2999, paidEachCents: 2999 });
  });

  it("gives each row its reason and amount", () => {
    const row = toRow(summarize(sampleClaim({ decision: "rejected", reasons: [{ check: "label", outcome: "pass", text: "ok" }, reject("code", "Written code reads K7O")] })), recall);
    expect(row).toMatchObject({ decision: "rejected", reason: "Written code reads K7O", amount: null, payer: "•••• UJ3Q" });
    expect(toRow(summarize(sampleClaim({ decision: "held" })), { ...recall, autoPay: false }).reason).toBe("Every check passed; auto-pay is off");
    expect(reasonOf(summarize(sampleClaim({ decision: "pending", photos: [] })), recall)).toBe("Waiting for photos");
  });

  it("says the rule's decision in one sentence", () => {
    expect(decisionSentence(sampleClaim({ decision: "paid" }), recall)).toBe("Every check passed, so Remedy paid $29.99 through PayPal.");
    expect(decisionSentence(sampleClaim({ decision: "blocked", reasons: [reject("payer_verified", "This PayPal account isn't verified")] }), recall)).toBe(
      "Stopped before the photos reached the model: this PayPal account isn't verified.",
    );
    expect(decisionSentence(sampleClaim({ decision: "rejected", reasons: [reject("review", "Rejected on review: PayPal name doesn't match.")] }), recall)).toBe(
      "Rejected on review: PayPal name doesn't match.",
    );
  });

  it("says why a claim is held: the model, auto-pay, PayPal or a conflict before the payout", () => {
    const held = (check: string, text: string) => sampleClaim({ decision: "held", reasons: [{ check: "label", outcome: "pass", text: "ok" }, { check, outcome: "hold", text }] });
    expect(decisionSentence(held("payout", "PayPal didn't accept the payout, so a person will send it"), recall)).toBe(
      "Every check passed, but PayPal didn't accept the payout, so a person will send it.",
    );
    expect(decisionSentence(held("auto_pay", "Auto-pay is off for this recall, so a person approves each refund"), recall)).toBe(
      "Every check passed. Auto-pay is off, so a person approves the $29.99 refund.",
    );
    expect(decisionSentence(held("payer", "PayPal account already has a claim"), recall)).toBe(
      "A check before the payout found a conflict, so a person decides: PayPal account already has a claim.",
    );
    expect(decisionSentence(held("same_item", "Couldn't tell if both photos show the same item"), recall)).toBe(
      "One answer was unclear, so a person decides: couldn't tell if both photos show the same item.",
    );
  });

  it("rebuilds the pre-checks: a blocked claim fails the one that stopped it", () => {
    const rows = preChecksOf(sampleClaim({ decision: "blocked", reasons: [reject("duplicate_photo", "Photo 1 was already used in another claim")] }));
    expect(rows.map((r) => [r.id, r.state])).toEqual([
      ["session", "pass"],
      ["duplicate_photo", "reject"],
      ["payer", "pass"],
      ["payer_verified", "pass"],
    ]);
    expect(preChecksOf(sampleClaim({ photos: [] })).every((r) => r.state === "waiting")).toBe(true);
    expect(preChecksOf(sampleClaim({ seeded: true })).find((r) => r.id === "duplicate_photo")?.state).toBe("skipped");
  });

  it("offers review only on held claims, and only a sample review on a seeded one", () => {
    expect(toDrawerClaim(sampleClaim({ decision: "held" }), recall).review).toEqual({ sample: false, note: null });
    expect(toDrawerClaim(sampleClaim({ decision: "held", seeded: true }), recall).review).toMatchObject({ sample: true, note: expect.stringContaining("nothing is saved") });
    expect(toDrawerClaim(sampleClaim({ decision: "paid" }), recall).review).toBeNull();
    expect(toDrawerClaim(sampleClaim(), recall).photos).toEqual(["/api/console/claims/RM-0412/photos/0"]);
  });
});

describe("report", () => {
  it("tallies outcomes and refusal reasons", () => {
    const claims = [
      sampleClaim({ decision: "paid", payout: { batchId: "B", status: "SUCCESS", updatedAt: "2026-11-07T10:00:00.000Z" }, seeded: true }),
      sampleClaim({ decision: "rejected", reasons: [reject("code", "x")] }),
      sampleClaim({ decision: "rejected", reasons: [reject("step_2", "x")] }),
      sampleClaim({ decision: "blocked", reasons: [reject("code", "x")] }),
    ];
    const r = buildReport(claims.map(summarize), recall);
    expect(r.outcomes.find((o) => o.decision === "rejected")).toMatchObject({ count: 2, share: "50%" });
    expect(r.refusals).toEqual([
      { reason: "One-time code missing or wrong", count: 2 },
      { reason: "Destruction not shown", count: 1 },
    ]);
    // A seeded sample is counted as remedied, but its payout never left: it is not money paid or confirmed.
    expect(r).toMatchObject({ sentCents: 0, settledCents: 0, settling: 0, sampleCents: 2999, samplesPaid: 1 });
    expect(r.seeded).toBe(1);
  });
});

describe("recall import", () => {
  it("reads the firm and a slug from CPSC's record", () => {
    const n = summarizeCpsc(CpscRecord.parse(cpsc27071));
    expect(n).toMatchObject({ id: "27-071", unitsSold: 19_596, firm: "Kikea Store", slug: "x-vesolje-nursing-pillows" });
  });

  it("makes slugs unique and short", () => {
    expect(slugify("Gourmia Stainless Steel Digital 9 Slice Digital Air Fryer Ovens")).toBe("gourmia-stainless-steel-digital-9-slice-digital");
    expect(uniqueSlug("pillows", [{ slug: "pillows", id: "27-071" }], "27-099")).toBe("pillows-2");
    expect(uniqueSlug("pillows", [{ slug: "pillows", id: "27-071" }], "27-071")).toBe("pillows");
  });

  it("normalises refunds to PayPal's two-decimal strings", () => {
    expect(RefundValue.parse("$1,250")).toBe("1250.00");
    expect(RefundValue.parse(" 29.9 ")).toBe("29.90");
    expect(RefundValue.safeParse("0.50").success).toBe(false);
    expect(RefundValue.safeParse("12.345").success).toBe(false);
  });

  it("explains a bad claim link", () => {
    const r = PublishInput.safeParse({ ref: "27-069", refund: "10", autoPay: true, slug: "Bad Slug", spec: {} });
    expect(r.success).toBe(false);
    expect(r.error?.issues.find((i) => i.path[0] === "slug")?.message).toBe("Use lowercase letters and numbers, joined by single dashes");
  });
});
