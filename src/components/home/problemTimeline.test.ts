import { describe, expect, it } from "vitest";
import { ANCHOR_AT, dash, outExpo, outQuart, OVERLAP_VH, piecewise, REST, SECTION_VH, seg, stampScale, T } from "./problemTimeline";

// DESIGN.md: a pinned beat gets at least about 70vh of scroll, exits run half as long as entrances, and the second
// pinned sequence (this one) holds for about 200vh.
describe("Exhibit A timeline", () => {
  const PIN_START = 100;

  it("holds the pin for about 200vh, B's slide-over included", () => {
    expect(SECTION_VH - PIN_START).toBeLessThanOrEqual(220);
  });

  it("gives the entrance, the read and the cut each at least 70vh", () => {
    expect(T.fold[1] - T.rise[0]).toBeGreaterThanOrEqual(70);
    expect(T.ring[1] - T.card1[0]).toBeGreaterThanOrEqual(70);
    // The cut and payoff run from the snip until B's edge reaches the payoff, about 45vh into the cover.
    expect(T.cover[0] + 0.9 * OVERLAP_VH - T.snip[0]).toBeGreaterThanOrEqual(70);
  });

  it("exits in about half the entrance", () => {
    const entrance = T.fold[1] - T.rise[0];
    expect(OVERLAP_VH).toBeGreaterThanOrEqual(entrance * 0.4);
    expect(OVERLAP_VH).toBeLessThanOrEqual(entrance * 0.6);
  });

  it("runs the eye path in order: open, card 1, card 2 and the string to it, its ink, card 3 and its string, card 4 and its string, the return, the ring, the sources, the cut, the payoff", () => {
    const order = [T.fold, T.card1, T.card2, T.span1, T.hl, T.stamp, T.card3, T.span2, T.card4, T.span3, T.ret, T.ring, T.sources, T.mark, T.snip, T.droop, T.dim, T.payoff];
    for (let i = 1; i < order.length; i++) expect(order[i][0]).toBeGreaterThanOrEqual(order[i - 1][0]);
    // Card 1 lands as the flap settles (never on an empty open sheet), and every card is on the sheet before the
    // string reaching it is halfway there.
    expect(T.card1[0]).toBeGreaterThanOrEqual(T.fold[1] - 14);
    expect(T.card1[0]).toBeLessThanOrEqual(T.fold[1]);
    for (const [card, span] of [
      [T.card2, T.span1],
      [T.card3, T.span2],
      [T.card4, T.span3],
    ] as const)
      expect(card[0]).toBeLessThanOrEqual((span[0] + span[1]) / 2 - 2);
  });

  it("gives the cut its own beat before the lamp goes down, and prints the payoff once the dim is mostly done", () => {
    expect(T.mark[0]).toBeGreaterThanOrEqual(T.sources[1]);
    expect(T.dim[0]).toBeGreaterThanOrEqual(T.snip[1]);
    expect(T.payoff[0]).toBeGreaterThanOrEqual(T.dim[0] + 0.5 * (T.dim[1] - T.dim[0]));
  });

  it("prints the payoff after the loop closes and lifts it away before section B reaches it", () => {
    expect(T.snip[0]).toBeGreaterThanOrEqual(T.ring[1]);
    expect(T.payoff[1]).toBeLessThanOrEqual(T.cover[0]);
    expect(REST).toBe(T.payoff[1]);
    expect(T.leave[0]).toBeGreaterThanOrEqual(T.payoff[1]);
    // B's edge crosses the payoff (about 70% down the screen) about 30vh into the cover.
    expect(T.leave[1]).toBeLessThanOrEqual(T.cover[0] + 0.3 * 100);
  });

  it("lands the nav's anchor on the open sheet, as card 1 lands", () => {
    expect(ANCHOR_AT).toBeGreaterThanOrEqual(T.fold[1]);
    expect(ANCHOR_AT).toBeLessThanOrEqual(T.card1[1] + 6);
  });
});

describe("timeline helpers", () => {
  it("keeps DESIGN.md's curves at their ends", () => {
    for (const f of [outExpo, outQuart]) {
      expect(f(0)).toBe(0);
      expect(f(1)).toBe(1);
      expect(f(0.5)).toBeGreaterThan(0.5);
    }
    expect(outExpo(0.5)).toBeGreaterThan(outQuart(0.5));
  });

  it("clamps a beat's progress", () => {
    expect(seg(0, [10, 20])).toBe(0);
    expect(seg(15, [10, 20])).toBe(0.5);
    expect(seg(99, [10, 20])).toBe(1);
  });

  it("lands a stamp 4% past rest with no bounce", () => {
    expect(stampScale(0)).toBeCloseTo(1.4);
    expect(stampScale(0.7)).toBeCloseTo(0.96);
    expect(stampScale(1)).toBeCloseTo(1);
    let min = Infinity;
    for (let x = 0; x <= 1; x += 0.01) min = Math.min(min, stampScale(x));
    expect(min).toBeGreaterThanOrEqual(0.959);
  });

  it("shows a piece of a path without a stray dot at its start", () => {
    expect(dash(0, 0)).toBeNull();
    expect(dash(0.5, 0.5)).toBeNull();
    expect(dash(0, 1)).toEqual({ array: "1.0000 3", offset: "0.0000" });
    expect(dash(0.25, 1)).toEqual({ array: "0.7500 3", offset: "-0.2500" });
  });

  it("maps scroll onto the timeline through rising knots, clamped", () => {
    const knots = [
      [100, 130],
      [200, 150],
      [150, 160], // out of order: pushed past 200
    ] as const;
    expect(piecewise(knots, 0)).toBe(130);
    expect(piecewise(knots, 150)).toBe(140);
    expect(piecewise(knots, 200)).toBe(150);
    expect(piecewise(knots, 999)).toBe(160);
    expect(piecewise([], 5)).toBe(REST);
  });
});
