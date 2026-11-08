import { describe, expect, it } from "vitest";
import { limitCopy } from "./LimitNotice";
import { resetWords } from "./model";

const now = new Date("2026-11-07T18:30:00.000Z");
const tomorrow = new Date("2026-11-08T00:00:00.000Z");

describe("limitCopy", () => {
  it("tells a real owner nothing was started, and when to come back", () => {
    expect(limitCopy({ kind: "account", limit: 5, until: tomorrow }, { demo: false, now })).toEqual({
      title: "This PayPal account has started today's claims",
      description: "Each PayPal account can start 5 claims a day. Nothing was started and nothing is lost.",
      retry: "in about 6 hours",
    });
  });

  it("never calls it a live demo", () => {
    for (const kind of ["account", "daily", "monthly", "checks"] as const) {
      for (const demo of [true, false]) expect(limitCopy({ kind, limit: 60, until: tomorrow }, { demo, now }).description).not.toMatch(/live demo/);
    }
    expect(limitCopy({ kind: "daily", limit: 60, until: tomorrow }, { demo: false, now }).description).toBe(
      "Remedy starts at most 60 claims a day. Nothing was started and nothing is lost.",
    );
  });

  it("speaks of demo claims in demo mode", () => {
    expect(limitCopy({ kind: "checks", limit: 100, until: tomorrow }, { demo: true, now }).description).toBe(
      "Remedy runs at most 100 photo checks a day. No demo claim was started and nothing was paid.",
    );
  });

  it("tells an account that ran its demo claims what happened, that nothing was paid, and when it resets", () => {
    expect(limitCopy({ kind: "account", limit: 60, until: tomorrow }, { demo: true, now })).toEqual({
      title: "This PayPal account has run today's demo claims",
      description: "Each PayPal account can run 60 demo claims a day. No demo claim was started and nothing was paid.",
      retry: "in about 6 hours",
    });
  });

  it("gives days for the 30-day limit", () => {
    expect(limitCopy({ kind: "monthly", limit: 150, until: new Date("2026-11-10T09:00:00.000Z") }, { demo: false, now }).retry).toBe("in 3 days");
  });
});

describe("resetWords", () => {
  it("says the UTC midnight reset in the viewer's own time", () => {
    const evening = new Date("2026-11-07T15:00:00.000Z");
    expect(resetWords(tomorrow, evening, "Asia/Kolkata")).toBe("05:30 tomorrow");
    expect(resetWords(tomorrow, evening, "America/New_York")).toBe("19:00 today");
    expect(resetWords(tomorrow, new Date("2026-11-06T12:00:00.000Z"), "UTC")).toBe("8 Nov, 00:00");
  });
});
