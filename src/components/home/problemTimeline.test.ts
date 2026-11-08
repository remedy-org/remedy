import { describe, expect, it } from "vitest";
import { ANCHOR_AT, dash, outExpo, outQuart, OVERLAP_VH, PAYOFF_LEAD, PAYOFF_REST, piecewise, REST, SECTION_VH, seg, stampScale, T } from "./problemTimeline";

// DESIGN.md: a pinned beat gets at least about 70vh of scroll, exits run half as long as entrances, and the second
// pinned sequence (this one) holds for about 130vh before section B scrolls over it.
describe("Problem timeline", () => {
  const PIN_START = 100;

  it("holds the sheet for about 130vh before B arrives, and B then covers it fully at reading speed", () => {
    expect(SECTION_VH - OVERLAP_VH - PIN_START).toBeLessThanOrEqual(150);
    // The finished payoff holds 40 to 60vh before B's edge comes up the screen.
    expect(T.cover[0] - REST).toBeGreaterThanOrEqual(40);
    expect(T.cover[0] - REST).toBeLessThanOrEqual(60);
    // B covers the whole screen before the pin lets go, so the sheet is never carried off sliced by B's edge.
    expect(OVERLAP_VH).toBe(100);
    expect(T.cover).toEqual([SECTION_VH - OVERLAP_VH, SECTION_VH]);
  });

  it("gives the entrance, the read and the cut each at least 70vh", () => {
    expect(T.fold[1] - T.rise[0]).toBeGreaterThanOrEqual(70);
    expect(T.ring[1] - T.card1[0]).toBeGreaterThanOrEqual(70);
    // The cut and payoff run from the snip until B's edge covers the payoff, about 25vh into the cover.
    expect(T.cover[0] + 25 - T.snip[0]).toBeGreaterThanOrEqual(70);
  });

  it("sinks the sheet under B in about half the entrance", () => {
    const entrance = T.fold[1] - T.rise[0];
    const exit = T.sink[1] - T.sink[0];
    expect(exit).toBeGreaterThanOrEqual(entrance * 0.4);
    expect(exit).toBeLessThanOrEqual(entrance * 0.6);
    expect(T.sink[0]).toBe(T.cover[0]);
  });

  it("runs the eye path in order: card 1, card 2 and the string to it, its ink, the unfold, card 3 and its string, card 4 and its string, the return, the ring, the sources, the cut, the payoff, the lamp", () => {
    const order = [T.card1, T.card2, T.span1, T.hl, T.fold, T.card3, T.span2, T.card4, T.span3, T.ret, T.ring, T.sources, T.mark, T.snip, T.droop, T.payoff, T.dim];
    for (let i = 1; i < order.length; i++) expect(order[i][0]).toBeGreaterThanOrEqual(order[i - 1][0]);
    // The sheet is never a blank page: card 1 lands while the folded sheet is still rising.
    expect(T.card1[0]).toBeLessThanOrEqual(60);
    // Card 3 sits on the lower half: it lands as that half settles, never before it is nearly flat.
    expect(T.card3[0]).toBeGreaterThanOrEqual(T.fold[1] - 14);
    expect(T.card3[0]).toBeLessThanOrEqual(T.fold[1]);
    for (const [card, span] of [
      [T.card2, T.span1],
      [T.card3, T.span2],
      [T.card4, T.span3],
    ] as const)
      expect(card[0]).toBeLessThanOrEqual((span[0] + span[1]) / 2 - 2);
  });

  it("swings the lower part open in view: the crease is above the lower quarter of the screen at mid-fold", () => {
    // The sheet is pinned at t = 100 with its crease (61% down the sheet) about 64% down the screen; before that it
    // sits (100 - t)vh lower.
    const mid = (T.fold[0] + T.fold[1]) / 2;
    expect(64 + Math.max(0, 100 - mid)).toBeLessThanOrEqual(75);
  });

  it("names the cut as it happens: the payoff's lead prints with the snap, and the lamp goes down after it", () => {
    expect(T.mark[0]).toBeGreaterThanOrEqual(T.sources[1]);
    expect(T.payoff[0]).toBeGreaterThanOrEqual(T.snip[0]);
    expect(T.payoff[0]).toBeLessThanOrEqual(T.snip[1]);
    expect(T.payoff[0] + PAYOFF_LEAD).toBeLessThanOrEqual(T.snip[1] + 8);
    expect(T.dim[0]).toBeGreaterThanOrEqual(T.snip[1]);
    expect(T.payoff[1] - PAYOFF_REST).toBeGreaterThanOrEqual(T.payoff[0] + PAYOFF_LEAD / 2);
  });

  it("prints the payoff after the loop closes and finishes it before section B arrives", () => {
    expect(T.snip[0]).toBeGreaterThanOrEqual(T.ring[1]);
    expect(T.payoff[1]).toBeLessThanOrEqual(T.cover[0]);
    expect(REST).toBe(T.payoff[1]);
  });

  it("lands the nav's anchor on the open sheet, as card 3 lands", () => {
    expect(ANCHOR_AT).toBeGreaterThanOrEqual(T.fold[1]);
    expect(ANCHOR_AT).toBeLessThanOrEqual(T.card3[1] + 6);
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
