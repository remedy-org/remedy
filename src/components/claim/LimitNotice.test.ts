import { describe, expect, it } from "vitest";
import { limitCopy, retryLabel } from "./LimitNotice";
import { resetWords } from "./model";

const now = new Date("2026-11-07T18:30:00.000Z");
const tomorrow = new Date("2026-11-08T00:00:00.000Z");

describe("limitCopy", () => {
  it("tells a real owner nothing was started, as an honest sandbox limit, and when to come back", () => {
    expect(limitCopy({ kind: "account", limit: 5, until: tomorrow }, { demo: false, now })).toEqual({
      title: "This PayPal account has started today's claims",
      description: "Each PayPal account can start 5 claims a day in this sandbox, to keep its costs down. Nothing was started and nothing is lost.",
      retry: "in about 6 hours",
    });
  });

  it("never calls it a live demo", () => {
    for (const kind of ["account", "daily", "monthly", "checks"] as const) {
      for (const demo of [true, false]) expect(limitCopy({ kind, limit: 60, until: tomorrow }, { demo, now }).description).not.toMatch(/live demo/);
    }
    expect(limitCopy({ kind: "daily", limit: 60, until: tomorrow }, { demo: false, now }).description).toBe(
      "This sandbox starts at most 60 claims a day, to keep its costs down. Nothing was started and nothing is lost.",
    );
    expect(limitCopy({ kind: "daily", limit: 60, until: tomorrow }, { demo: false, now, sandbox: false }).description).toMatch(/^Remedy starts at most 60 claims a day/);
  });

  it("speaks of sample claims in demo mode", () => {
    expect(limitCopy({ kind: "checks", limit: 100, until: tomorrow }, { demo: true, now }).description).toBe(
      "This sandbox runs at most 100 photo checks a day, to keep its costs down. No sample claim was started.",
    );
    expect(limitCopy({ kind: "account", limit: 60, until: tomorrow }, { demo: true, now }).title).toBe("This PayPal account has run today's sample claims");
  });

  it("gives days for the 30-day limit", () => {
    expect(limitCopy({ kind: "monthly", limit: 150, until: new Date("2026-11-10T09:00:00.000Z") }, { demo: false, now }).retry).toBe("in 3 days");
  });
});

describe("retryLabel", () => {
  it("says when the refused button comes back, with no time zone", () => {
    expect(retryLabel({ kind: "account", limit: 5, until: tomorrow }, now)).toBe("Available again in about 6 hours");
    expect(retryLabel({ kind: "monthly", limit: 150, until: new Date("2026-11-10T09:00:00.000Z") }, now)).toBe("Available again in 3 days");
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
