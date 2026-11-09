import { describe, expect, it } from "vitest";
import { recallDays, reportNumber } from "./format";

describe("a recall's age and report number", () => {
  it("counts days inclusive, in UTC, the recall's date as day 1", () => {
    expect(recallDays("2026-11-05", new Date("2026-11-05T00:00:00Z"))).toBe(1);
    expect(recallDays("2026-11-05", new Date("2026-11-09T07:00:00Z"))).toBe(5);
    expect(recallDays("2026-11-05", new Date("2026-11-09T23:59:59Z"))).toBe(5);
    expect(recallDays("2026-11-05", new Date("2026-11-04T12:00:00Z"))).toBe(1);
  });

  it("numbers the monthly progress report from the recall's date", () => {
    expect(reportNumber("2026-11-05", new Date("2026-11-09T07:00:00Z"))).toBe(1);
    expect(reportNumber("2026-11-05", new Date("2026-12-04T23:00:00Z"))).toBe(1);
    expect(reportNumber("2026-11-05", new Date("2026-12-05T00:00:00Z"))).toBe(2);
    expect(reportNumber("2026-11-05", new Date("2027-01-20T00:00:00Z"))).toBe(3);
  });
});
