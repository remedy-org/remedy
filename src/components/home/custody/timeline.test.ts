import { describe, expect, it } from "vitest";
import { EXHIBIT_RANGE, STARTS, chapterAt, inExhibit } from "./timeline";

const range = (a: number, b: number, step = 0.0005) => Array.from({ length: Math.round((b - a) / step) + 1 }, (_, i) => a + i * step);

describe("Chain of Custody timeline", () => {
  it("gives every p exactly one chapter, in order, changing only at the starts", () => {
    let last = 0;
    for (const p of range(0, 1)) {
      const c = chapterAt(p);
      expect(c).toBeGreaterThanOrEqual(last);
      if (c !== last) expect(STARTS).toContain(Math.round(p * 2000) / 2000);
      last = c;
    }
    expect(chapterAt(1)).toBe(5);
  });

  it("holds the exhibit as one layer over chapters 03 to 05, so it never dips at their starts", () => {
    for (const p of range(EXHIBIT_RANGE[0], EXHIBIT_RANGE[1] - 0.0005)) {
      expect(inExhibit(p)).toBe(true);
      expect(chapterAt(p)).toBeGreaterThanOrEqual(2);
      expect(chapterAt(p)).toBeLessThanOrEqual(4);
    }
    expect(inExhibit(EXHIBIT_RANGE[0] - 0.0001)).toBe(false);
    expect(inExhibit(EXHIBIT_RANGE[1])).toBe(false);
    expect(chapterAt(EXHIBIT_RANGE[1])).toBe(5);
  });
});
