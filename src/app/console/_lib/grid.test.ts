import { describe, expect, it } from "vitest";
import { sampleClaim, sampleRecall } from "@/lib/__fixtures__/claim";
import { summarize } from "@/lib/store/store";
import type { Claim, Reason } from "@/lib/types";
import { barsSentence, decisionSentence, isLive, ledgerOf, toRow } from "./view";

// The claims grid's evidence cells (barcode, timeline, verdict line, ledger) come from index.json's rows alone.

const recall = { ...sampleRecall(), autoPay: true };
const reject = (check: string, text: string): Reason => ({ check, outcome: "reject", text });

const seededPaid: Claim = sampleClaim({
  decision: "paid",
  seeded: true,
  reasons: [
    { check: "label", outcome: "pass", text: "ok" },
    { check: "code", outcome: "pass", text: "ok" },
    { check: "screen", outcome: "pass", text: "ok" },
    { check: "step_1", outcome: "pass", text: "ok" },
  ],
  payout: { batchId: "SEEDX", status: "SUCCESS", updatedAt: "2026-11-07T10:00:52.000Z" },
  events: [
    { at: "2026-11-07T10:00:00.000Z", type: "photos_received", detail: "" },
    { at: "2026-11-07T10:00:11.000Z", type: "checked", detail: "" },
    { at: "2026-11-07T10:00:11.050Z", type: "decided", detail: "" },
    { at: "2026-11-07T10:00:12.000Z", type: "payout_sent", detail: "" },
    { at: "2026-11-07T10:00:52.000Z", type: "payout_updated", detail: "PayPal: SUCCESS" },
  ],
});

describe("the grid's evidence cells", () => {
  it("draw the barcode: the pre-checks, then the photo check's", () => {
    const row = toRow(summarize(seededPaid), recall);
    expect(row.bars?.map((b) => `${b.id}:${b.state}`)).toEqual([
      "session:pass",
      // Every demo claim has its own photos, so the fingerprint check ran and passed.
      "duplicate_photo:pass",
      "payer:pass",
      "payer_verified:pass",
      "label:pass",
      "code:pass",
      // One photo: the same-item comparison had nothing to compare, so its bar is drawn as not needed.
      "same_item:skipped",
      "screen:pass",
      "step_1:pass",
    ]);
    expect(row.note).toBe("All checks passed");
    // Each group counts what passed of what ran.
    expect(barsSentence(row.bars!)).toBe("5 of 5 checks passed");
  });

  it("show the checks a claim will run as waiting, and a blocked claim's photo checks as not run", () => {
    expect(toRow(summarize(sampleClaim({ photos: [] })), recall).bars?.every((b) => b.state === "waiting")).toBe(true);
    const blocked = toRow(summarize(sampleClaim({ decision: "blocked", reasons: [reject("session", "Not taken in this session")] })), recall);
    expect(blocked.bars?.slice(0, 4).map((b) => b.state)).toEqual(["reject", "pass", "pass", "pass"]);
    // label, code, same item, screen and the recall's one step, none of them run.
    expect(blocked.bars?.slice(4).map((b) => b.state)).toEqual(["skipped", "skipped", "skipped", "skipped", "skipped"]);
    expect(barsSentence(blocked.bars!)).toBe("2 of 5 checks passed · 1 failed · 2 not run");
  });

  it("count a demo sample's checks as its receipt does: one claim per account is skipped unless it's the genuine one", () => {
    const demo = (sample: string) =>
      toRow(summarize(sampleClaim({ decision: "rejected", demo: true, reasons: [{ check: "label", outcome: "pass", text: "" }, reject("code", "Written code reads K7Q"), { check: "step_1", outcome: "pass", text: "" }, { check: "screen", outcome: "pass", text: "" }], events: [{ at: "2026-11-07T10:00:00.000Z", type: "demo_sample", detail: sample }] })), recall);
    // A check that didn't run keeps its slot, drawn as not run.
    expect(demo("wrong-code").bars?.find((b) => b.id === "payer")?.state).toBe("skipped");
    expect(barsSentence(demo("wrong-code").bars!)).toBe("3 of 5 checks passed · 1 failed · 1 not run");
    expect(demo("genuine").bars?.find((b) => b.id === "payer")?.state).toBe("pass");
  });

  it("tolerate rows written before the index carried the evidence fields", () => {
    const old = summarize(seededPaid);
    for (const k of ["checks", "times", "photoKeys", "code"] as const) delete old[k];
    expect(toRow(old, recall, () => ({ thumb: "t", large: "l" }))).toMatchObject({ bars: null, timeline: null, toPay: null, code: null, photos: [], note: null });
  });

  it("time a starter claim's payout as every other claim's, and read its status as PayPal recorded it", () => {
    const starter = toRow(summarize(seededPaid), recall);
    expect(starter.timeline).toEqual({ answered: 11, decided: 11, sent: 12, settled: 52, end: "paid" });
    expect(starter).toMatchObject({ toPay: 12, modelSec: 11, payoutStatus: "SUCCESS" });
    // Paid only where PayPal confirmed: a payout PENDING in its record reads as not yet paid, and none at all as approved.
    expect(toRow(summarize({ ...seededPaid, payout: { ...seededPaid.payout!, status: "PENDING" } }), recall).payoutStatus).toBe("PENDING");
    expect(toRow(summarize({ ...seededPaid, payout: null }), recall).payoutStatus).toBeNull();
    const real = toRow(summarize({ ...seededPaid, seeded: undefined, payout: { ...seededPaid.payout!, batchId: "LIVE" } }), recall);
    expect(real).toMatchObject({ toPay: 12, timeline: { sent: 12, settled: 52 } });
  });

  it("give each photo the URLs the caller makes from its key", () => {
    const row = toRow(summarize(seededPaid), recall, (key, n) => ({ thumb: `${key}#${n}`, large: key }));
    expect(row.photos).toEqual([{ thumb: "RM-0412/1.jpg#0", large: "RM-0412/1.jpg" }]);
  });
});

describe("the ledger and live updates", () => {
  it("count every payout sent through PayPal", () => {
    const rows = [
      toRow(summarize(seededPaid), recall),
      toRow(summarize({ ...seededPaid, id: "RM-0001", seeded: undefined, demo: true }), recall),
      toRow(summarize(sampleClaim({ decision: "held" })), recall),
    ];
    expect(ledgerOf(rows, recall)).toMatchObject({ remedied: 2, paidCents: 5998, medianToPay: 12, timed: 2, held: 1, samples: 1, demos: 1 });
  });

  it("poll only while a claim that isn't a sample can still change", () => {
    const now = Date.parse("2026-11-07T10:05:00.000Z");
    const row = (c: Partial<Claim>) => toRow(summarize(sampleClaim(c)), recall);
    // The seed's two pending samples never move.
    expect(isLive([row({ seeded: true, photos: [] })], now)).toBe(false);
    expect(isLive([row({ photos: [] })], now)).toBe(true);
    expect(isLive([row({ decision: "paid", payout: { batchId: "B", status: "PENDING", updatedAt: "2026-11-07T10:00:00.000Z" } })], now)).toBe(true);
    expect(isLive([row({ decision: "paid", payout: { batchId: "B", status: "SUCCESS", updatedAt: "2026-11-07T10:00:00.000Z" } })], now)).toBe(false);
    // A demo claim filed in the last 10 minutes, then not.
    expect(isLive([row({ decision: "rejected", demo: true })], now)).toBe(true);
    expect(isLive([row({ decision: "rejected", demo: true })], now + 10 * 60_000)).toBe(false);
    // The 8 s interval leaves a decided demo claim out: only a tab coming back into view asks again.
    expect(isLive([row({ decision: "rejected", demo: true })], now, { demo: false })).toBe(false);
    // An abandoned claim (a code, never any photos) and a payout parked at UNCLAIMED or ONHOLD never keep it polling.
    const later = now + 60 * 60_000;
    expect(isLive([row({ photos: [] })], later)).toBe(false);
    expect(isLive([row({ decision: "paid", payout: { batchId: "B", status: "PENDING", updatedAt: "2026-11-07T10:00:00.000Z" } })], later)).toBe(false);
    for (const status of ["UNCLAIMED", "ONHOLD"]) {
      expect(isLive([row({ decision: "paid", payout: { batchId: "B", status, updatedAt: "2026-11-07T10:00:00.000Z" } })], now)).toBe(false);
    }
  });

  it("say a starter claim's payout in the words every claim's uses", () => {
    expect(decisionSentence(seededPaid, recall)).toBe("All checks passed, so Remedy paid $29.99 through PayPal.");
  });
});
