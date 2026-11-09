import { describe, expect, it } from "vitest";
import { BEATS as EXHIBIT_BEATS } from "../teardown/model";
import { HANDOFF, PAGE_STOPS } from "./CustodyStage";
import { glideMs, nextStop, withHowItWorks } from "./paging";
import { HOW_IT_WORKS, SCROLL_VH, scrollAt } from "./pace";

const STOPS = [0, 0.2, 0.35, 0.6, 0.9];

describe("keyboard paging through the pin", () => {
  it("goes to the next stop, never past one", () => {
    expect(nextStop(STOPS, 0, 1)).toBe(0.2);
    expect(nextStop(STOPS, 0.2, 1)).toBe(0.35);
    expect(nextStop(STOPS, 0.25, 1)).toBe(0.35);
    expect(nextStop(STOPS, 0.5, -1)).toBe(0.35);
    expect(nextStop(STOPS, 0.35, -1)).toBe(0.2);
  });

  it("treats a position a hair off a stop as on it", () => {
    expect(nextStop(STOPS, 0.199, 1)).toBe(0.35);
    expect(nextStop(STOPS, 0.351, -1)).toBe(0.2);
  });

  it("hands back to the browser before the first stop and after the last", () => {
    expect(nextStop(STOPS, 0.9, 1)).toBeNull();
    expect(nextStop(STOPS, 0.95, 1)).toBeNull();
    expect(nextStop(STOPS, 0, -1)).toBeNull();
  });

  it("is needed: every exhibit beat is shorter than one browser page (about 95vh)", () => {
    for (const b of EXHIBIT_BEATS) expect(b.vh).toBeLessThan(95);
    expect(SCROLL_VH).toBeGreaterThan(95);
  });

  it("moves every page at one pace: never under 600ms, never faster than 1.6px a millisecond", () => {
    expect(glideMs(200)).toBe(600);
    expect(glideMs(-200)).toBe(600);
    expect(glideMs(1600)).toBe(1000);
  });

  it("stops on How it works between the hero and chapter 01, just before the screen hands over, once", () => {
    expect(HOW_IT_WORKS).toBeCloseTo(HANDOFF[0] - 0.004, 9);
    const list = withHowItWorks(PAGE_STOPS);
    expect(list).toHaveLength(PAGE_STOPS.length + 1);
    expect(nextStop(list, 0, 1)).toBeCloseTo(scrollAt(HOW_IT_WORKS), 9);
    expect(nextStop(list, scrollAt(HOW_IT_WORKS), 1)).toBe(PAGE_STOPS[1]);
    expect(nextStop(list, PAGE_STOPS[1], -1)).toBeCloseTo(scrollAt(HOW_IT_WORKS), 9);
    expect(withHowItWorks(list)).toEqual(list);
  });
});
