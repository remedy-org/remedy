import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_SPEC } from "../demo/kikea";
import { mockPayPal, tokenResponse } from "../paypal/test-helpers";
import { decide } from "../rule";
import { isReplayBatch, recordedAnswer, replayNotice, replayPayout, replayPayoutStatus, replayRefusal, replayVision, reviewReplay, SETTLE_MS, unsureAnswer } from "./replay";

const photo = (name: string) => readFileSync(join(process.cwd(), "public/demo", name));
const LOCAL = { REMEDY_REVIEW_REPLAY: "1", PAYPAL_API_BASE: "http://sandbox.invalid:9" };

describe("replay guard", () => {
  it("runs only when asked, against a non-PayPal host, off Vercel and off the shared store", () => {
    expect(replayRefusal(LOCAL)).toBeNull();
    expect(reviewReplay(LOCAL)).toBe(true);
    expect(reviewReplay({ ...LOCAL, REMEDY_REVIEW_REPLAY: "true" })).toBe(false);
    expect(reviewReplay({ PAYPAL_API_BASE: LOCAL.PAYPAL_API_BASE })).toBe(false);
    expect(replayRefusal({ ...LOCAL, VERCEL: "1" })).toMatch(/VERCEL/);
    expect(replayRefusal({ ...LOCAL, BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x" })).toMatch(/BLOB/);
    expect(replayRefusal({ REMEDY_REVIEW_REPLAY: "1" })).toMatch(/unset/);
    expect(replayRefusal({ ...LOCAL, PAYPAL_API_BASE: "not a url" })).toMatch(/URL/);
    for (const base of ["https://api-m.paypal.com", "https://api-m.sandbox.paypal.com", "https://API-M.PAYPAL.COM", "https://paypal.com.", "https://paypal.com/v1"]) {
      expect(reviewReplay({ ...LOCAL, PAYPAL_API_BASE: base })).toBe(false);
    }
    expect(replayRefusal({ ...LOCAL, PAYPAL_API_BASE: "http://notpaypal.com.test" })).toBeNull();
  });

  it("logs one line when asked: on, or why not", () => {
    expect(replayNotice({})).toBeNull();
    expect(replayNotice(LOCAL)).toMatch(/REVIEW REPLAY ON/);
    expect(replayNotice({ ...LOCAL, VERCEL: "1" })).toMatch(/ignored: VERCEL is set/);
  });
});

describe("replayed photo check", () => {
  it("replays the eval's answer for the demo samples' photos, picked by the claim's code", () => {
    expect(recordedAnswer([photo("c02-1.jpg")], "M4T")?.case).toBe("c02-pillow-cut-lamplight");
    // c11 is c01's photo under another code.
    expect(recordedAnswer([photo("c11-1.jpg")], "K7P")?.case).toBe("c11-wrong-code-K7P");
    expect(recordedAnswer([photo("c01-1.jpg")], "K7Q")?.case).toBe("c01-pillow-cut-daylight");
    expect(recordedAnswer([photo("c03-1.jpg"), photo("c03-2.jpg")], "R8D")?.case).toBe("c03-pillow-two-photos");
    expect(recordedAnswer([photo("c03-2.jpg"), photo("c03-1.jpg")], "R8D")).toBeNull();
    expect(recordedAnswer([Buffer.from("a live camera frame")], "M4T")).toBeNull();
  });

  it("decides the demo samples as the eval did: genuine paid, wrong code rejected on the code", async () => {
    const genuine = await replayVision({ images: [photo("c02-1.jpg")], spec: DEMO_SPEC, code: "M4T" }, 0);
    expect(decide(genuine.verdict, { spec: DEMO_SPEC, code: "M4T", photos: 1 }).outcome).toBe("pass");
    expect(genuine.model).toMatch(/recorded answer/);
    const wrong = await replayVision({ images: [photo("c11-1.jpg")], spec: DEMO_SPEC, code: "K7P" }, 0);
    const { outcome, reasons } = decide(wrong.verdict, { spec: DEMO_SPEC, code: "K7P", photos: 1 });
    expect(outcome).toBe("reject");
    expect(reasons.filter((r) => r.outcome === "reject").map((r) => r.check)).toEqual(["code"]);
  });

  it("holds any other photo for a person, never rejects it", async () => {
    for (const [code, photos] of [["M4T", 1], [null, 1], ["M4T", 3]] as const) {
      const { outcome, reasons } = decide(unsureAnswer(DEMO_SPEC, code, photos), { spec: DEMO_SPEC, code, photos });
      expect(outcome).toBe("hold");
      expect(reasons.some((r) => r.outcome === "reject")).toBe(false);
    }
    const live = await replayVision({ images: [Buffer.from("frame")], spec: DEMO_SPEC, code: "M4T" }, 0);
    expect(live.model).toBe("no model call");
  });
});

describe("replayed payouts", () => {
  it("sends a PENDING batch that settles to SUCCESS", () => {
    const sent = replayPayout(Date.parse("2026-11-07T10:00:00Z"));
    expect(sent.batchStatus).toBe("PENDING");
    expect(sent.batchId).toMatch(/^RPLY[0-9A-Z]{9}$/);
    expect(isReplayBatch(sent.batchId)).toBe(true);
    expect(isReplayBatch("WXEU2FXY2NKXJ")).toBe(false);
    const sentAt = Date.parse("2026-11-07T10:00:00Z");
    const early = replayPayoutStatus(sent.batchId, sentAt + 1000);
    const later = replayPayoutStatus(sent.batchId, sentAt + SETTLE_MS);
    expect(early).toMatchObject({ batchStatus: "PENDING", itemStatus: "PENDING" });
    expect(later).toMatchObject({ batchId: sent.batchId, batchStatus: "SUCCESS", itemStatus: "SUCCESS" });
    expect(later.itemId).toBe(early.itemId);
  });

  describe("through payouts.ts", () => {
    beforeEach(() => vi.resetModules());
    const send = async () => (await import("../paypal/payouts")).sendPayout({ claimId: "RM-0412", payoutKey: "k", payerId: "P", amount: { value: "29.99", currency: "USD" }, note: "n" });

    it("never calls PayPal on replay", async () => {
      const calls = mockPayPal();
      vi.stubEnv("REMEDY_REVIEW_REPLAY", "1");
      vi.stubEnv("PAYPAL_API_BASE", LOCAL.PAYPAL_API_BASE);
      const sent = await send();
      expect(isReplayBatch(sent.batchId)).toBe(true);
      expect((await (await import("../paypal/payouts")).getPayoutStatus(sent.batchId)).batchId).toBe(sent.batchId);
      expect(calls).toEqual([]);
    });

    it("calls PayPal when the guard refuses", async () => {
      const calls = mockPayPal(tokenResponse, { status: 201, body: { batch_header: { payout_batch_id: "WXEU2FXY2NKXJ", batch_status: "PENDING" } } });
      vi.stubEnv("REMEDY_REVIEW_REPLAY", "1");
      vi.stubEnv("VERCEL", "1");
      vi.stubEnv("PAYPAL_API_BASE", "https://api-m.sandbox.paypal.com");
      expect((await send()).batchId).toBe("WXEU2FXY2NKXJ");
      expect(calls[1].url).toBe("https://api-m.sandbox.paypal.com/v1/payments/payouts");
    });
  });
});
