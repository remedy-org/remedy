import { describe, expect, it, vi } from "vitest";
import { studioExpiry, studioLicence } from "./agStudioLicence";

// Made-up keys in AG's shape: words, bracketed tags, the expiry as base64 epoch millis, then a 32-character hash.
const EXPIRY = Date.UTC(2026, 11, 22);
const HASH = "0123456789abcdef0123456789abcdef";
const key = (ms: number, hash = HASH) => `Remedy_Insights_[TRIAL]_[v3]_[03C]_${btoa(String(ms))}${hash}`;
const BEFORE = Date.UTC(2026, 10, 9);
const AFTER = Date.UTC(2026, 11, 23);

describe("studioLicence", () => {
  it("is null when the key is unset", () => {
    // Passing undefined falls back to the env default, so a build env with the key set must not leak in here.
    vi.stubEnv("NEXT_PUBLIC_AG_STUDIO_LICENSE", undefined);
    expect(studioLicence(BEFORE, undefined)).toBeNull();
  });

  it("is null when the key is blank", () => {
    expect(studioLicence(BEFORE, "")).toBeNull();
    expect(studioLicence(BEFORE, "   \n")).toBeNull();
  });

  it("returns a valid key before its expiry", () => {
    expect(studioExpiry(key(EXPIRY))?.toISOString()).toBe("2026-12-22T00:00:00.000Z");
    expect(studioLicence(BEFORE, key(EXPIRY))).toBe(key(EXPIRY));
    expect(studioLicence(BEFORE, ` ${key(EXPIRY)} `)).toBe(key(EXPIRY));
  });

  it("reads a last segment that is the expiry alone, with no hash after it", () => {
    expect(studioLicence(BEFORE, key(EXPIRY, ""))).toBe(key(EXPIRY, ""));
    expect(studioLicence(AFTER, key(EXPIRY, ""))).toBeNull();
  });

  it("is null once the key has expired", () => {
    expect(studioLicence(AFTER, key(EXPIRY))).toBeNull();
    expect(studioLicence(EXPIRY, key(EXPIRY))).toBeNull();
  });

  it("trusts a key whose expiry it can't read", () => {
    const odd = "an-unrecognised-key-format-without-a-date";
    expect(studioExpiry(odd)).toBeNull();
    expect(studioLicence(AFTER, odd)).toBe(odd);
  });

  it("reads NEXT_PUBLIC_AG_STUDIO_LICENSE by default", () => {
    vi.stubEnv("NEXT_PUBLIC_AG_STUDIO_LICENSE", key(EXPIRY));
    expect(studioLicence(BEFORE)).toBe(key(EXPIRY));
    expect(studioLicence(AFTER)).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_AG_STUDIO_LICENSE", "");
    expect(studioLicence(BEFORE)).toBeNull();
  });
});
