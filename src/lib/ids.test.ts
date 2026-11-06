import { describe, expect, it } from "vitest";
import { CAPTURE_SESSION_MINUTES, newCaptureSession, newClaimId, newPayoutKey } from "./ids";

describe("newClaimId", () => {
  it("looks like RM-0412", () => {
    expect(newClaimId(new Set())).toMatch(/^RM-\d{4}$/);
  });

  it("never returns a taken id", () => {
    const taken = new Set(Array.from({ length: 10_000 }, (_, i) => `RM-${String(i).padStart(4, "0")}`));
    expect(() => newClaimId(taken)).toThrow(/No free claim id/);
    taken.clear();
    for (let i = 0; i < 5000; i++) taken.add(`RM-${String(i * 2).padStart(4, "0")}`);
    for (let i = 0; i < 100; i++) expect(taken.has(newClaimId(taken))).toBe(false);
  });
});

describe("newPayoutKey", () => {
  it("is a fresh UUID each time", () => {
    const a = newPayoutKey();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newPayoutKey()).not.toBe(a);
  });
});

describe("newCaptureSession", () => {
  it("expires after the session window", () => {
    const now = new Date("2026-11-07T10:00:00Z");
    const s = newCaptureSession(now);
    expect(s.id).toMatch(/^cs_[\w-]{22}$/);
    expect(new Date(s.expiresAt).getTime() - now.getTime()).toBe(CAPTURE_SESSION_MINUTES * 60_000);
  });
});
