import { describe, expect, it } from "vitest";
import { sampleClaim, sampleRecall } from "@/lib/__fixtures__/claim";
import { summarize } from "@/lib/store/store";
import type { Reason } from "@/lib/types";
import { duplicateFor, payoutFailureWords, toDrawerClaim } from "./drawer";
import { PublishInput, RefundValue, slugify, summarizeCpsc, uniqueSlug } from "./recalls";
import { buildReport } from "./report";
import { companyReasonText, decisionSentence, duration, formatCents, maskPayer, median, percent, preChecksOf, reasonOf, shownSpec, statsOf, toRow } from "./view";
import { DEMO_SPEC } from "@/lib/demo/kikea";
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
    expect(toRow(summarize(sampleClaim({ decision: "held" })), { ...recall, autoPay: false }).reason).toBe("All checks passed; auto-pay is off");
    expect(reasonOf(summarize(sampleClaim({ decision: "pending", photos: [] })), recall)).toBe("Waiting for photos");
  });

  it("says the rule's decision in one sentence", () => {
    const payout = { batchId: "B1", status: "SUCCESS" as const, updatedAt: "2026-11-07T10:01:00Z" };
    expect(decisionSentence(sampleClaim({ decision: "paid", payout }), recall)).toBe("All checks passed, so Remedy paid $29.99 through PayPal.");
    // Approved with nothing sent: no payout named.
    expect(decisionSentence(sampleClaim({ decision: "paid" }), recall)).toBe("All checks passed: $29.99 approved, nothing sent yet.");
    expect(decisionSentence(sampleClaim({ decision: "blocked", reasons: [reject("payer_verified", "This PayPal account isn't verified")] }), recall)).toBe(
      "Stopped before the photo check: this PayPal account isn't verified.",
    );
    expect(decisionSentence(sampleClaim({ decision: "rejected", reasons: [reject("review", "Rejected on review: PayPal name doesn't match.")] }), recall)).toBe(
      "Rejected on review: PayPal name doesn't match.",
    );
  });

  it("says why a claim is held: the model, auto-pay, PayPal or a conflict before the payout", () => {
    const held = (check: string, text: string) => sampleClaim({ decision: "held", reasons: [{ check: "label", outcome: "pass", text: "ok" }, { check, outcome: "hold", text }] });
    expect(decisionSentence(held("payout", "PayPal didn't accept the payout, so a person will send it"), recall)).toBe(
      "All checks passed, but PayPal didn't accept the payout, so a person will send it.",
    );
    expect(decisionSentence(held("auto_pay", "Auto-pay is off for this recall, so a person approves each refund"), recall)).toBe(
      "All checks passed. Auto-pay is off, so a person approves the $29.99 refund.",
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
    // Every demo claim has its own photos: the fingerprint check ran on a seeded claim too.
    expect(preChecksOf(sampleClaim({ seeded: true })).find((r) => r.id === "duplicate_photo")?.state).toBe("pass");
  });

  it("says what the one-claim check covered: paid or open claims, the round for the genuine sample, nothing for the others", () => {
    const payer = (c: Parameters<typeof sampleClaim>[0]) => preChecksOf(sampleClaim(c)).find((r) => r.id === "payer")!;
    const demo = (sample: string) => ({ demo: true, events: [{ at: "2026-11-07T10:00:00.000Z", type: "demo_sample", detail: sample }] });
    expect(payer({})).toMatchObject({ state: "pass", detail: "No other paid or open claim for this recall from this PayPal account" });
    expect(payer(demo("genuine"))).toMatchObject({ state: "pass", detail: expect.stringMatching(/^Checked within this session/) });
    expect(payer(demo("wrong-code"))).toBeUndefined();
    expect(payer({ ...demo("wrong-code"), photos: [] }).state).toBe("waiting");
  });

  it("offers review only on held claims, starter claims as every other", () => {
    expect(toDrawerClaim(sampleClaim({ decision: "held" }), recall).review).toEqual({ note: null });
    expect(toDrawerClaim(sampleClaim({ decision: "held", seeded: true }), recall).review).toEqual({ note: null });
    expect(toDrawerClaim(sampleClaim({ decision: "paid" }), recall).review).toBeNull();
    expect(toDrawerClaim(sampleClaim(), recall).photos).toEqual(["/api/console/claims/RM-0412/photos/0"]);
  });

  it("says a photo check that never answered in the company's words, not the owner's", () => {
    const model = { check: "model", text: "The photo check didn't answer, so a person will look at your photos instead" };
    expect(companyReasonText(model, "held")).toBe("The photo check didn’t answer (a service error), so this claim needs your review. Nothing has been paid.");
    // The grid's line is short enough to read whole beside the pill; the panel keeps the full sentence.
    expect(companyReasonText(model, "held", true)).toBe("Photo check errored: needs your review");
    expect(companyReasonText({ check: "model", text: "Remedy's daily photo-check limit is reached; a person will review this claim" }, "held", true)).toBe("Daily check limit reached: needs your review");
    expect(companyReasonText(model, "paid")).toBe("The photo check didn’t answer (a service error), so a person at the company reviewed it.");
    expect(companyReasonText({ check: "same_item", text: "Couldn't tell" }, "held")).toBe("Couldn’t tell");
    const claim = sampleClaim({ decision: "held", reasons: [{ ...model, outcome: "hold" }] });
    expect(decisionSentence(claim, recall)).toBe("The photo check gave no answer, so the rule couldn't decide: a person approves or rejects the $29.99 refund.");
    expect(toDrawerClaim(claim, recall).checks[0].rule).not.toContain("your photos");
  });

  it("shows a held claim whose payout PayPal refused, until a payout goes through", () => {
    const events = [
      { at: "2026-11-07T10:00:20.000Z", type: "photos_received", detail: "" },
      { at: "2026-11-07T10:05:00.000Z", type: "approved", detail: "" },
      { at: "2026-11-07T10:05:01.000Z", type: "payout_failed", detail: "PayPal didn't take the payout: fetch failed" },
    ];
    const failed = toRow(summarize(sampleClaim({ decision: "held", events })), recall);
    expect(failed.payoutFailedAt).toBe("2026-11-07T10:05:01.000Z");
    // The row says what it means for the reviewer; the panel says which failure it was (payoutFailureWords).
    expect(failed.note).toBe("Payout not sent: retry or reject");
    expect(toRow(summarize(sampleClaim({ decision: "held", events: events.slice(0, 2) })), recall).payoutFailedAt).toBeNull();
    // Seeded claims never reach PayPal, and the index row of a refused claim doesn't carry it.
    expect(summarize(sampleClaim({ decision: "held", seeded: true, events }))).not.toHaveProperty("payoutFailedAt");
    expect(summarize(sampleClaim({ decision: "rejected", events }))).not.toHaveProperty("payoutFailedAt");
  });

  it("shows what the checks found when a person's approve was refused, without changing why it was held", () => {
    const model: Reason = { check: "model", outcome: "hold", text: "The photo check didn't answer, so a person will look at your photos instead" };
    const conflict = "This PayPal account already has a claim for this recall (RM-3497)";
    const demo = { demo: true, events: [{ at: "2026-11-07T10:00:00.000Z", type: "demo_sample", detail: "wrong-code" }] };
    const refused = { at: "2026-11-07T10:05:00.000Z", type: "approve_refused", detail: `Not paid on review: ${conflict}` };
    // As review.ts saves it now: the conflict a hold after the reason it was held for.
    const claim = sampleClaim({ decision: "held", ...demo, reasons: [model, { check: "payer", outcome: "hold", text: conflict }], events: [...demo.events, refused] });
    const row = toRow(summarize(claim), recall);
    expect(summarize(claim).reason?.check).toBe("model");
    expect(row.note).toBe("Not paid on review: this account has another claim");
    expect(row.bars?.find((b) => b.id === "payer")?.state).toBe("hold");
    const drawer = toDrawerClaim(claim, recall);
    expect(drawer.refused).toEqual({ at: refused.at, text: conflict });
    expect(drawer.preChecks.find((p) => p.id === "payer")).toMatchObject({ state: "hold", detail: conflict });
    // A claim refused before the conflict was kept as a reason: the panel reads it from the refusal.
    const older = toDrawerClaim(sampleClaim({ decision: "held", ...demo, reasons: [model], events: [...demo.events, refused] }), recall);
    expect(older.preChecks.find((p) => p.id === "payer")).toMatchObject({ state: "hold", detail: conflict });
    // An approve after it moves on.
    const later = { at: "2026-11-07T10:06:00.000Z", type: "approved", detail: "Approved on review by x" };
    expect(toDrawerClaim(sampleClaim({ decision: "held", reasons: [model], events: [refused, later] }), recall).refused).toBeNull();
  });

  it("says a failed payout in words, telling a network error from PayPal's refusal, the raw answer apart", () => {
    expect(payoutFailureWords("Remedy couldn't reach PayPal: fetch failed")).toMatchObject({ kind: "network", next: expect.stringContaining("Nothing was sent"), raw: "fetch failed" });
    // Older claims called a network error PayPal's answer.
    expect(payoutFailureWords("PayPal didn't take the payout: getaddrinfo ENOTFOUND api-m.sandbox.paypal.com")?.kind).toBe("network");
    expect(payoutFailureWords("PayPal refused the payout: RECEIVER_UNREGISTERED, debug id dbg-9")).toEqual({
      kind: "paypal",
      what: "PayPal didn't take the payout: the owner's PayPal account can't receive payouts",
      next: "Nothing was sent.",
      raw: "RECEIVER_UNREGISTERED, debug id dbg-9",
    });
    expect(payoutFailureWords("PayPal didn't take the payout: SOMETHING_NEW")?.what).toBe("PayPal didn't take the payout (SOMETHING_NEW)");
    expect(payoutFailureWords("Payout of $29.99 sent through PayPal")).toBeNull();
  });

  it("says on the pre-check, before anyone decides, that approve would be stopped, and counts the five checks as recorded", () => {
    const model: Reason = { check: "model", outcome: "hold", text: "The photo check didn't answer, so a person will look at your photos instead" };
    const conflict = "This PayPal account already has a claim for this recall (RM-2584)";
    const claim = sampleClaim({ decision: "held", reasons: [model] });
    const before = toDrawerClaim(claim, recall);
    expect(before.stops).toEqual([]);
    expect(before.preChecks.find((p) => p.id === "payer")?.state).toBe("pass");
    const d = toDrawerClaim(claim, recall, { stops: [conflict] });
    expect(d.stops).toEqual([conflict]);
    expect(d.preChecks.find((p) => p.id === "payer")).toMatchObject({ state: "hold", detail: expect.stringMatching(/^Approve won't pay: this PayPal account already has a claim for this recall \(RM-2584\)/) });
    // The five-check line is what was recorded, as the grid's barcode counts it, not the forecast.
    expect(d.five).toBe(before.five);
    // Only a held claim a person can pay has a forecast.
    expect(toDrawerClaim(sampleClaim({ decision: "held", seeded: true, reasons: [model] }), recall, { stops: [conflict] }).stops).toEqual([]);
  });

  it("says a person's reject with who and when, and keeps raw service answers and sample ids out of the history", () => {
    const rejected = sampleClaim({
      decision: "rejected",
      reasons: [{ check: "review", outcome: "reject", text: "Rejected on review: The tag reads K7Q." }],
      events: [
        { at: "2026-11-07T10:00:00.000Z", type: "demo_sample", detail: "wrong-code" },
        { at: "2026-11-07T10:01:00.000Z", type: "decided", detail: "Held for a person: photo check failed (401 Incorrect API key provided: sk-****)" },
        { at: "2026-11-07T10:02:00.000Z", type: "payout_failed", detail: "PayPal didn't take the payout: fetch failed" },
        { at: "2026-11-07T10:03:00.000Z", type: "rejected", detail: "Rejected on review: The tag reads K7Q. (by Kikea Store)" },
      ],
    });
    const d = toDrawerClaim(rejected, recall);
    expect(d.rejected).toEqual({ at: "2026-11-07T10:03:00.000Z", by: "Kikea Store", reason: "The tag reads K7Q." });
    expect(d.events.map((e) => e.detail)).toEqual([
      'Filed from the demo: "The wrong code"',
      "Held for a person: the photo check service didn't answer",
      "Remedy couldn't reach PayPal (a network error). Nothing was sent, so it's safe to try again.",
      "Rejected on review: The tag reads K7Q. (by Kikea Store)",
    ]);
    expect(d.events[2].failure?.kind).toBe("network");
    expect(d.events.map((e) => e.raw)).toEqual([undefined, "401 Incorrect API key provided: sk-****", "fetch failed", undefined]);
  });

  it("finds a blocked repost's earlier claim on the same recall only", () => {
    const photos = [{ key: "b/1.jpg", hash: "0123456789abcdef" }];
    const earlier = sampleClaim({ id: "RM-0001", decision: "paid", createdAt: "2026-11-07T09:00:00.000Z", photos: [{ key: "a/1.jpg", hash: "0123456789abcdef" }] });
    const repost = sampleClaim({ id: "RM-0002", payerId: "OTHERPAYER01", decision: "blocked", photos, reasons: [reject("duplicate_photo", "Photo 1 was already used in another claim")] });
    expect(duplicateFor(repost, [summarize(earlier), summarize(repost)])).toEqual({ photo: 1, id: "RM-0001", theirs: 1, of: 1, src: null });
    const elsewhere = summarize({ ...earlier, recallId: "another-recall" });
    expect(duplicateFor(repost, [elsewhere, summarize(repost)])).toBeNull();
  });

  it("says a demo claim's duplicate check covers only its own demo round", () => {
    const photos = [{ key: "a/1.jpg", hash: "0123456789abcdef" }];
    const dup = (c: Parameters<typeof sampleClaim>[0]) => preChecksOf(sampleClaim({ decision: "held", photos, ...c })).find((p) => p.id === "duplicate_photo")!;
    expect(dup({ demo: true }).detail).toContain("this session");
    expect(dup({ demo: true }).detail).not.toMatch(/round/);
    expect(dup({}).detail).toBe("No other claim used these photos");
  });

  it("quotes the model's summary under a held same-item check, which has no evidence of its own", () => {
    const verdict = {
      label: { text_seen: "X", matches_recalled_product: "yes" as const, evidence: "Label reads X" },
      steps: [],
      challenge_code: { text_seen: "R8D", matches: "yes" as const, evidence: "Tag reads R8D" },
      same_item_in_all_photos: "unclear" as const,
      looks_like_photo_of_screen_or_print: "no" as const,
      summary: "Cannot be confirmed from the close-up alone.",
    };
    const claim = sampleClaim({ decision: "held", verdict, reasons: [{ check: "same_item", outcome: "hold", text: "Couldn't tell" }, { check: "screen", outcome: "pass", text: "A real photo" }] });
    const checks = toDrawerClaim(claim, recall).checks;
    expect(checks.find((c) => c.id === "same_item")?.evidence).toBe("Cannot be confirmed from the close-up alone.");
    expect(checks.find((c) => c.id === "screen")?.evidence).toBeNull();
  });
});

describe("timing", () => {
  it("takes the middle time, the faster of the two middle ones for an even count, as Insights' median does", () => {
    expect(median([])).toBeNull();
    expect(median([4007, 3, 2])).toBe(3);
    expect(median([2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4007])).toBe(3);
    expect(median([4, 3, 2, 4007])).toBe(3);
  });

  it("prints a duration in seconds, minutes, and hours and minutes past an hour", () => {
    expect(duration(3)).toBe("3 s");
    expect(duration(10.8)).toBe("11 s");
    expect(duration(120)).toBe("2 min");
    expect(duration(448)).toBe("7 min 28 s");
    expect(duration(4007)).toBe("1 h 06 min");
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
    expect(r.outcomes.find((o) => o.decision === "rejected")).toMatchObject({ count: 2, share: "50%", note: "A photo check failed, or a person rejected it on review" });
    expect(r.outcomes.find((o) => o.decision === "held")?.note).toContain("PayPal refused an approved payout");
    expect(r.refusals).toEqual([
      { reason: "Code missing or wrong", count: 2 },
      { reason: "Destruction not shown", count: 1 },
    ]);
    // A starter claim's payout has settled with the workspace's others: the report counts it as sent.
    expect(r).toMatchObject({ sentCents: 2999, settledCents: 2999, settling: 0, sent: 1 });
  });
});

describe("recall import", () => {
  it("reads the firm and a slug from CPSC's record", () => {
    const n = summarizeCpsc(CpscRecord.parse(cpsc27071));
    expect(n).toMatchObject({ id: "27-071", unitsSold: 19_596, firm: "Kikea Store", slug: "x-vesolje-nursing-pillows" });
  });

  it("makes slugs unique and short", () => {
    expect(slugify("Gourmia Stainless Steel Digital 9 Slice Digital Air Fryer Ovens")).toBe("gourmia-stainless-steel-digital-9-slice-digital");
    expect(slugify("Ekouaer Girls’ Nightgowns")).toBe("ekouaer-girls-nightgowns");
    expect(shownSpec(DEMO_SPEC).label_must_show[0]).toBe("X-VESOLJE, hand-written on a paper tag tied to the pillow (the product’s label)");
    expect(shownSpec(DEMO_SPEC).product).not.toMatch(/demo|stand-in/);
    expect(shownSpec(DEMO_SPEC).note).toBe("");
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
