import { describe, expect, it } from "vitest";
import { CONSOLE_AT, EXHIBIT_OUT, EXHIBIT_RANGE, exhibitPage, exhibitShare, share } from "./timeline";

const range = (a: number, b: number, step = 0.0005) => Array.from({ length: Math.round((b - a) / step) + 1 }, (_, i) => a + i * step);

describe("Chain of Custody timeline", () => {
  it("keeps the exhibit at full strength through chapters 03 to 05, with no dip at 0.6 or 0.8", () => {
    for (const p of range(0.49, 0.893)) expect(exhibitShare(p)).toBe(1);
  });

  it("dissolves the exhibit in over chapter 02 at full strength: never an empty frame or a fade up from a blank page", () => {
    expect(exhibitPage(EXHIBIT_RANGE[0] - 0.0001)).toBe(0);
    for (const p of range(0.46, 0.5, 0.0002)) {
      expect(share(p, 1) + exhibitShare(p)).toBeGreaterThanOrEqual(1);
      // The content is never fainter than its own page on the way in.
      if (p < 0.5) expect(exhibitShare(p)).toBeCloseTo(exhibitPage(p), 9);
    }
    for (const p of range(0.49, 0.893)) expect(exhibitPage(p)).toBe(1);
  });

  it("hands over to the console without an empty frame or a double exposure", () => {
    for (const p of range(CONSOLE_AT + 0.01, 1)) expect(share(p, 5)).toBe(1);
    for (const p of range(0.88, 0.92, 0.0002)) {
      expect(exhibitPage(p) + share(p, 5)).toBeGreaterThanOrEqual(1);
      // The exhibit's text has gone before its page starts to show the console through it.
      if (exhibitPage(p) < 1) expect(exhibitShare(p)).toBe(0);
    }
    expect(exhibitShare(EXHIBIT_RANGE[1] - EXHIBIT_OUT)).toBe(0);
  });

  it("never shows two claim-screen chapters at once", () => {
    for (const p of range(0, 1)) {
      const on = [0, 1, 5].filter((i) => share(p, i) > 0);
      expect(on.length).toBeLessThanOrEqual(1);
    }
  });
});
