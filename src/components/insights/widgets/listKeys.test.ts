import { describe, expect, it } from "vitest";
import { nextItem } from "./listKeys";

describe("moving through an explored exhibit", () => {
  it("steps with the arrows and stops at the ends", () => {
    expect(nextItem("ArrowDown", 0, 4)).toBe(1);
    expect(nextItem("ArrowUp", 2, 4)).toBe(1);
    expect(nextItem("ArrowUp", 0, 4)).toBe(0);
    expect(nextItem("ArrowDown", 3, 4)).toBe(3);
  });

  it("jumps with Home and End, and leaves every other key alone", () => {
    expect(nextItem("Home", 3, 4)).toBe(0);
    expect(nextItem("End", 0, 4)).toBe(3);
    expect(nextItem("Enter", 1, 4)).toBeNull();
    expect(nextItem("Tab", 1, 4)).toBeNull();
  });
});
