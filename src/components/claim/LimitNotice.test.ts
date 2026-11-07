import { describe, expect, it } from "vitest";
import { limitCopy } from "./LimitNotice";

const now = new Date("2026-11-07T18:30:00.000Z");
const tomorrow = new Date("2026-11-08T00:00:00.000Z");

describe("limitCopy", () => {
  it("tells a real owner nothing was started, and when to come back", () => {
    expect(limitCopy({ kind: "account", limit: 5, until: tomorrow }, { demo: false, now })).toEqual({
      title: "This PayPal account has started today's claims",
      description: "Each PayPal account can start 5 claims a day, which keeps this live demo affordable. Nothing was started and nothing is lost. Try again in about 6 hours, after 00:00 UTC.",
    });
  });

  it("speaks of sample claims in demo mode", () => {
    expect(limitCopy({ kind: "checks", limit: 100, until: tomorrow }, { demo: true, now }).description).toBe(
      "Remedy runs at most 100 photo checks a day so this live demo stays affordable. No sample claim was started. Try again in about 6 hours, after 00:00 UTC.",
    );
    expect(limitCopy({ kind: "account", limit: 60, until: tomorrow }, { demo: true, now }).title).toBe("This PayPal account has run today's sample claims");
  });

  it("gives days, not a UTC time, for the 30-day limit", () => {
    expect(limitCopy({ kind: "monthly", limit: 150, until: new Date("2026-11-10T09:00:00.000Z") }, { demo: false, now }).description).toMatch(/in any 30 days .* Try again in 3 days\.$/);
  });
});
