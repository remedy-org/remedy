import { describe, expect, it } from "vitest";
import { CONSOLE_AT, EXHIBIT_RANGE, exhibitPage, exhibitShare, share } from "./timeline";

const range = (a: number, b: number, step = 0.0005) => Array.from({ length: Math.round((b - a) / step) + 1 }, (_, i) => a + i * step);

describe("Chain of Custody timeline", () => {
  it("keeps the exhibit at full strength through chapters 03 to 05, with no dip at 0.6 or 0.8", () => {
    for (const p of range(0.49, 0.893)) expect(exhibitShare(p)).toBe(1);
  });

  it("covers the rail with an opaque page from the exhibit's first frame", () => {
    expect(exhibitPage(EXHIBIT_RANGE[0] - 0.0001)).toBe(0);
    for (const p of range(EXHIBIT_RANGE[0], 0.893)) expect(exhibitPage(p)).toBe(1);
  });

  it("hands over to the console without an empty frame: the console is full before the exhibit dissolves", () => {
    for (const p of range(CONSOLE_AT + 0.01, 1)) expect(share(p, 5)).toBe(1);
    for (const p of range(0.88, 0.92)) expect(exhibitPage(p) + share(p, 5)).toBeGreaterThanOrEqual(1);
  });

  it("never shows two claim-screen chapters at once", () => {
    for (const p of range(0, 1)) {
      const on = [0, 1, 5].filter((i) => share(p, i) > 0);
      expect(on.length).toBeLessThanOrEqual(1);
    }
  });
});
