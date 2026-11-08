import { describe, expect, it } from "vitest";
import { CUT_IN, ENTER, LEAVE, cut } from "./gate";

const layer = (i: number) => (c: number) => c === i;
const exhibit = (c: number) => c >= 2 && c <= 4;
const IN_OUT = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

describe("chapter cuts", () => {
  it("between claim screens: out in half the entrance's time, in after it has nearly gone", () => {
    expect(cut(0, 1, layer(0))).toEqual(LEAVE);
    expect(cut(0, 1, layer(1))).toEqual({ ...ENTER, delay: 0.14 });
  });

  it("into and out of the exhibit, both ways: the outgoing layer is all but gone before the incoming one starts", () => {
    for (const [from, to, out, inn] of [
      [1, 2, layer(1), exhibit],
      [2, 1, exhibit, layer(1)],
      [4, 5, exhibit, layer(5)],
      [5, 4, layer(5), exhibit],
    ] as const) {
      const leave = cut(from, to, out);
      const enter = cut(from, to, inn);
      expect(leave).toEqual(LEAVE);
      expect(enter).toEqual(CUT_IN);
      const left = 1 - IN_OUT(Math.min(1, (enter!.delay as number) / (leave!.duration as number)));
      expect(left).toBeLessThan(0.05);
    }
  });

  it("leaves the exhibit alone at its own beat changes", () => {
    expect(cut(2, 3, exhibit)).toBeNull();
    expect(cut(3, 4, exhibit)).toBeNull();
  });
});
