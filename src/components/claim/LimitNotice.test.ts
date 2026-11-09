import { describe, expect, it } from "vitest";
import { limitCopy } from "./LimitNotice";
import { resetWords } from "./model";

const now = new Date("2026-11-07T18:30:00.000Z");
const tomorrow = new Date("2026-11-08T00:00:00.000Z");

describe("limitCopy", () => {
  it("tells an owner which limit, that nothing was started or paid, and when to come back", () => {
    expect(limitCopy({ kind: "account", limit: 5, until: tomorrow }, { now })).toEqual({
      title: "This PayPal account has reached today’s claim limit",
      description: "Nothing was started and nothing was paid.",
      retry: "in about 6 hours",
    });
  });

  it("says Remedy's own limits stop new claims, never the refund owed", () => {
    for (const kind of ["daily", "monthly"] as const) {
      expect(limitCopy({ kind, limit: 60, until: tomorrow }, { now }).description).toBe("We can’t start new claims right now. Your refund is still owed.");
    }
  });

  it("names Remedy's own limits plainly, with no internal words", () => {
    expect(limitCopy({ kind: "daily", limit: 60, until: tomorrow }, { now }).title).toBe("Remedy is at today’s limit for new claims");
    expect(limitCopy({ kind: "checks", limit: 100, until: tomorrow }, { now }).title).toBe("Today’s photo checks are used up");
    for (const kind of ["account", "daily", "monthly", "checks"] as const) {
      const { title, description } = limitCopy({ kind, limit: 60, until: tomorrow }, { now });
      expect(`${title} ${description}`).not.toMatch(/sandbox|demo|judge|costs/i);
    }
  });

  it("gives days for the 30-day limit", () => {
    expect(limitCopy({ kind: "monthly", limit: 150, until: new Date("2026-11-10T09:00:00.000Z") }, { now }).retry).toBe("in 3 days");
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
