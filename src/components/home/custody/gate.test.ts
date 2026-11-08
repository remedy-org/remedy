import { describe, expect, it } from "vitest";
import { ENTER, LEAVE, cut } from "./gate";

const layer = (i: number) => (c: number) => c === i;
const exhibit = (c: number) => c >= 2 && c <= 4;

describe("chapter cuts", () => {
  it("between claim screens: out in half the entrance's time, in after it has nearly gone", () => {
    expect(cut(0, 1, layer(0))).toEqual(LEAVE);
    expect(cut(0, 1, layer(1))).toEqual({ ...ENTER, delay: 0.12 });
  });

  it("into the exhibit: the exhibit dissolves in at once, chapter 02 holds under it until it is opaque", () => {
    expect(cut(1, 2, exhibit)).toEqual(ENTER);
    const hold = cut(1, 2, layer(1));
    expect(hold?.delay).toBeGreaterThanOrEqual(ENTER.duration as number);
  });

  it("out of the exhibit: the console is in place under it at once, and the exhibit leaves onto it", () => {
    expect(cut(4, 5, layer(5))).toEqual(ENTER);
    expect(cut(4, 5, exhibit)?.delay).toBeGreaterThan(0);
    // And back up: the exhibit covers the console before it goes.
    expect(cut(5, 4, exhibit)).toEqual(ENTER);
    expect(cut(5, 4, layer(5))?.delay).toBeGreaterThanOrEqual(ENTER.duration as number);
  });

  it("leaves the exhibit alone at its own beat changes", () => {
    expect(cut(2, 3, exhibit)).toBeNull();
    expect(cut(3, 4, exhibit)).toBeNull();
  });
});
