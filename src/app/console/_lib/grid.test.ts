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
  it("draw the barcode: four pre-checks, then the model's checks", () => {
    const row = toRow(summarize(seededPaid), recall);
    expect(row.bars?.map((b) => `${b.id}:${b.state}`)).toEqual([
      "session:pass",
      // Seeded claims share sample photos: their fingerprint check never ran, so it has no bar.
      "payer:pass",
      "payer_verified:pass",
      "label:pass",
      "code:pass",
      "screen:pass",
      "step_1:pass",
    ]);
    expect(row.note).toBe("All checks passed");
    // Each group counts what passed of what ran: the seeded claim's fingerprint check wasn't run, so it isn't counted.
    expect(barsSentence(row.bars!)).toBe("Pre-checks 3 of 3 · Model answers 4 of 4");
  });

  it("show the checks a claim will run as waiting, and a blocked claim's model checks as not run", () => {
    expect(toRow(summarize(sampleClaim({ photos: [] })), recall).bars?.every((b) => b.state === "waiting")).toBe(true);
    const blocked = toRow(summarize(sampleClaim({ decision: "blocked", reasons: [reject("session", "Not taken in this session")] })), recall);
    expect(blocked.bars?.slice(0, 4).map((b) => b.state)).toEqual(["reject", "pass", "pass", "pass"]);
    // label, code, screen and the recall's one step, none of them run.
    expect(blocked.bars?.slice(4).map((b) => b.state)).toEqual(["skipped", "skipped", "skipped", "skipped"]);
    expect(barsSentence(blocked.bars!)).toBe("Pre-checks 3 of 4 · Model answers not run");
  });

  it("count a demo sample's checks as its receipt does: one claim per account is skipped unless it's the genuine one", () => {
    const demo = (sample: string) =>
      toRow(summarize(sampleClaim({ decision: "rejected", demo: true, reasons: [{ check: "label", outcome: "pass", text: "" }, reject("code", "Written code reads K7Q"), { check: "step_1", outcome: "pass", text: "" }, { check: "screen", outcome: "pass", text: "" }], events: [{ at: "2026-11-07T10:00:00.000Z", type: "demo_sample", detail: sample }] })), recall);
    // A check that didn't run has no bar.
    expect(demo("wrong-code").bars?.find((b) => b.id === "payer")).toBeUndefined();
    expect(barsSentence(demo("wrong-code").bars!)).toBe("Pre-checks 3 of 3 · Model answers 3 of 4");
    expect(demo("genuine").bars?.find((b) => b.id === "payer")?.state).toBe("pass");
  });

  it("tolerate rows written before the index carried the evidence fields", () => {
    const old = summarize(seededPaid);
    for (const k of ["checks", "times", "photoKeys", "code"] as const) delete old[k];
    expect(toRow(old, recall, () => ({ thumb: "t", large: "l" }))).toMatchObject({ bars: null, timeline: null, toPay: null, code: null, photos: [], note: null });
  });

  it("never show a sample claim's made-up payout times, and time a real one", () => {
    const sample = toRow(summarize(seededPaid), recall);
    expect(sample.timeline).toEqual({ answered: 11, decided: 11, sent: null, settled: null, end: "paid" });
    expect(sample).toMatchObject({ toPay: null, modelSec: 11 });
    const real = toRow(summarize({ ...seededPaid, seeded: undefined, payout: { ...seededPaid.payout!, batchId: "LIVE" } }), recall);
    expect(real).toMatchObject({ toPay: 12, timeline: { sent: 12, settled: 52 } });
  });

  it("give each photo the URLs the caller makes from its key", () => {
    const row = toRow(summarize(seededPaid), recall, (key, n) => ({ thumb: `${key}#${n}`, large: key }));
    expect(row.photos).toEqual([{ thumb: "RM-0412/1.jpg#0", large: "RM-0412/1.jpg" }]);
  });
});

describe("the ledger and live updates", () => {
  it("keep sample money apart from money sent through PayPal", () => {
    const rows = [
      toRow(summarize(seededPaid), recall),
      toRow(summarize({ ...seededPaid, id: "RM-0001", seeded: undefined, demo: true }), recall),
      toRow(summarize(sampleClaim({ decision: "held" })), recall),
    ];
    expect(ledgerOf(rows, recall)).toMatchObject({ remedied: 2, sampleRemedied: 1, paidCents: 2999, sampleCents: 2999, medianToPay: 12, timed: 1, held: 1, samples: 1, demos: 1 });
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
    // An abandoned claim (a code, never any photos) and a payout parked at UNCLAIMED or ONHOLD never keep it polling.
    const later = now + 60 * 60_000;
    expect(isLive([row({ photos: [] })], later)).toBe(false);
    expect(isLive([row({ decision: "paid", payout: { batchId: "B", status: "PENDING", updatedAt: "2026-11-07T10:00:00.000Z" } })], later)).toBe(false);
    for (const status of ["UNCLAIMED", "ONHOLD"]) {
      expect(isLive([row({ decision: "paid", payout: { batchId: "B", status, updatedAt: "2026-11-07T10:00:00.000Z" } })], now)).toBe(false);
    }
  });

  it("say a seeded claim's payout was never sent", () => {
    expect(decisionSentence(seededPaid, recall)).toBe("All checks passed, so the rule approved the $29.99 refund.");
  });
});
