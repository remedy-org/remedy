import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { openPhoto, sealPhoto, sealedPhotoUrl } = await import("./photoToken");

const ticket = { claimId: "RM-0412", n: 0, key: "5b1d7c1e-3f0a-4a7e-9c2b-8d4e6f1a2b3c/1.jpg", payerId: "COMPANY00001" };
const now = Date.parse("2026-11-07T23:59:00.000Z");

beforeEach(() => {
  for (const k of ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "OPENAI_API_KEY"]) vi.stubEnv(k, "unused");
  vi.stubEnv("SESSION_SECRET", "a-test-secret-that-is-at-least-32-characters");
});

describe("photo tickets", () => {
  it("open for the company they were sealed for, and hide the store key", () => {
    const token = sealPhoto(ticket, now);
    expect(openPhoto(token, "COMPANY00001", now)).toEqual(ticket);
    expect(token).not.toContain("5b1d7c1e");
    expect(Buffer.from(token, "base64url").toString("latin1")).not.toContain("1.jpg");
    expect(openPhoto(token, "ANOTHERCOMP1", now)).toBeNull();
  });

  it("stay the same all day, so the browser's cache keeps working, and expire after tomorrow", () => {
    expect(sealPhoto(ticket, now)).toBe(sealPhoto(ticket, now - 23 * 3_600_000));
    const token = sealPhoto(ticket, now);
    expect(openPhoto(token, "COMPANY00001", now + 24 * 3_600_000)).not.toBeNull();
    expect(openPhoto(token, "COMPANY00001", now + 25 * 3_600_000)).toBeNull();
  });

  it("refuse anything tampered with or sealed with another secret", () => {
    const token = sealPhoto(ticket, now);
    const flipped = Buffer.from(token, "base64url");
    flipped[20] ^= 1;
    expect(openPhoto(flipped.toString("base64url"), "COMPANY00001", now)).toBeNull();
    expect(openPhoto("not-a-ticket", "COMPANY00001", now)).toBeNull();
    vi.stubEnv("SESSION_SECRET", "another-secret-that-is-at-least-32-characters");
    expect(openPhoto(token, "COMPANY00001", now)).toBeNull();
  });

  it("make the photo route's URL", () => {
    expect(sealedPhotoUrl("RM-0412", 0, ticket.key, ticket.payerId, now)).toMatch(/^\/api\/console\/claims\/RM-0412\/photos\/0\?t=[A-Za-z0-9_-]+$/);
  });
});
