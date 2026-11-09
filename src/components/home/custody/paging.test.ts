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

  it("S1: moves every page on the calm glide: 1.3 s under a screen, about 2 s across two, never over 1,050 px/s on average", () => {
    expect(glideMs(200, 900)).toBeCloseTo(1300, 6);
    expect(glideMs(-200, 900)).toBeCloseTo(1300, 6);
    expect(glideMs(1800, 900)).toBeGreaterThanOrEqual(1900);
    expect(glideMs(1800, 900)).toBeLessThanOrEqual(2100);
    for (const d of [300, 900, 1800, 3000]) expect(d / glideMs(d, 900)).toBeLessThan(1.05);
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
