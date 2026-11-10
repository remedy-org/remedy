import { describe, expect, it } from "vitest";
import { holdOf } from "../teardown/model";
import {
  ARRIVAL,
  CONSOLE_IN,
  EXHIBIT_OUT,
  FOLD,
  FOLD_WIDEN,
  GLIDE,
  LAND,
  RAIL_BACK,
  TURN,
  arrivalAt,
  cardAt,
  consoleAt,
  consoleParts,
  exhibitOutAt,
  frameAt,
  lookAt,
  railBackAt,
  turnAt,
  type Box,
} from "./arrival";
import { PAGE_STOPS } from "./CustodyStage";
import { SCROLL_VH, scrollAt } from "./pace";
import { EXHIBIT_RANGE, STARTS } from "./timeline";

const receipt: Box = { x: 1040, y: 230, w: 336, h: 412 };
const slot: Box = { x: 337, y: 300, w: 1023, h: 52 };
const win: Box = { x: 313, y: 120, w: 1071, h: 620 };

describe("chapter 06's arrival", () => {
  it("starts at the console's cut and lands before the console stop, the content coming in between", () => {
    expect(ARRIVAL[0]).toBe(STARTS[5]);
    expect(CONSOLE_IN[0]).toBeGreaterThan(ARRIVAL[0]);
    expect(CONSOLE_IN[1]).toBeLessThan(LAND);
    // The console stop rests on the landed queue, never mid-move.
    expect(PAGE_STOPS.at(-1)).toBeGreaterThan(scrollAt(LAND));
    expect(arrivalAt(ARRIVAL[0])).toBe(0);
    expect(arrivalAt(LAND)).toBe(1);
  });

  it("is the receipt's box at its start and the row's slot at its end", () => {
    expect(cardAt(0, receipt, slot, win)).toEqual(receipt);
    expect(cardAt(1, receipt, slot, win)).toEqual(slot);
  });

  it("folds in place: the receipt's right edge and middle held, the card the row's height and part way to its width", () => {
    const f = cardAt(FOLD[1], receipt, slot, win);
    expect(f.w).toBeCloseTo(receipt.w + FOLD_WIDEN * (slot.w - receipt.w));
    expect(f.h).toBeCloseTo(slot.h);
    expect(f.x + f.w).toBeCloseTo(receipt.x + receipt.w);
    expect(f.y + f.h / 2).toBeCloseTo(receipt.y + receipt.h / 2);
  });

  it("keeps the folded card on the stage when the row is wider than the room left of the receipt", () => {
    const f = cardAt(FOLD[1], { ...receipt, x: 600 }, slot, win);
    expect(f.x).toBeGreaterThanOrEqual(16);
  });

  it("moves continuously, both ways: no step between two nearby k", () => {
    for (let k = 0; k < 1; k += 0.01) {
      const a = cardAt(k, receipt, slot, win);
      const b = cardAt(k + 0.01, receipt, slot, win);
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.w - b.w) + Math.abs(a.h - b.h)).toBeLessThan(120);
    }
  });

  it("moves the card's leading (left) edge at an even pace through the fold and the glide: its peak under 1.7x its mean", () => {
    // Widened all in the fold, the edge peaked at over 3x its mean speed across the move.
    const xs = [...Array(GLIDE[1] * 100 + 1).keys()].map((i) => cardAt(i / 100, receipt, slot, win).x);
    const steps = xs.slice(1).map((x, i) => Math.abs(x - xs[i]));
    const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
    expect(Math.max(...steps)).toBeLessThan(1.7 * mean);
  });

  it("draws the window's frame out from the card once it has folded, whole by the glide's end", () => {
    expect(frameAt(0.2, cardAt(0.2, receipt, slot, win), win)).toBeNull();
    expect(frameAt(GLIDE[1], cardAt(GLIDE[1], receipt, slot, win), win)).toEqual(win);
    expect(frameAt(1, slot, win)).toEqual(win);
  });

  it("shows the receipt exactly at its start and the flat row at its end", () => {
    expect(lookAt(0)).toEqual({ receipt: 1, ground: 0, paper: 1, row: 0, lift: 1 });
    expect(lookAt(1)).toEqual({ receipt: 0, ground: 1, paper: 0, row: 1, lift: 0 });
    // The receipt's words are gone before the row's come in, so no frame prints the two over each other.
    const k = [...Array(101).keys()].map((i) => i / 100);
    expect(k.every((x) => lookAt(x).receipt === 0 || lookAt(x).row === 0)).toBe(true);
  });

  // The paid stop, where the exhibit rests whole before the move.
  const paid = EXHIBIT_RANGE[0] + holdOf("paid") * (EXHIBIT_RANGE[1] - EXHIBIT_RANGE[0]);
  const steps = (f: (p: number) => number, a: number, b: number) => {
    let most = 0;
    for (let p = a; p < b; p += 0.0005) most = Math.max(most, Math.abs(f(p + 0.0005) - f(p)));
    return most;
  };

  it("takes the exhibit out progressively past the paid stop, gone as the receipt starts to fold", () => {
    expect(exhibitOutAt(paid)).toBe(0);
    expect(EXHIBIT_OUT[0]).toBeGreaterThan(paid);
    expect(exhibitOutAt(ARRIVAL[0] + FOLD[1] * (LAND - ARRIVAL[0]))).toBe(1);
    // Never more than 4% of it in half a thousandth of p (about 3px of scroll): a fade, never a cut between two frames.
    expect(steps(exhibitOutAt, paid, 1)).toBeLessThan(0.04);
  });

  it("brings the rail back only once the exhibit's heading has all but gone", () => {
    expect(exhibitOutAt(RAIL_BACK[0])).toBeGreaterThan(0.9);
    expect(railBackAt(ARRIVAL[0])).toBe(0);
    expect(railBackAt(CONSOLE_IN[0])).toBe(1);
    expect(steps(railBackAt, 0.88, 1)).toBeLessThan(0.05);
  });

  it("brings the console's bar, ledger, tabs, header and rows in one after another, after its frame, before the row lands", () => {
    const n = consoleParts(6);
    const start = (i: number) => [...Array(2001).keys()].map((k) => 0.9 + k * 0.00005).find((p) => consoleAt(p, i, n) > 0)!;
    // The bar starts only once the window's frame is all but drawn round it: within a tenth of its way from the card.
    const k0 = arrivalAt(start(0));
    const card = cardAt(k0, receipt, slot, win);
    const f = frameAt(k0, card, win)!;
    expect(Math.abs(f.y - win.y)).toBeLessThanOrEqual(0.1 * Math.abs(card.y - win.y));
    for (let i = 0; i < n; i++) {
      expect(consoleAt(LAND, i, n)).toBe(1);
      if (i > 0) expect(start(i)).toBeGreaterThan(start(i - 1));
      expect(steps((p) => consoleAt(p, i, n), 0.9, 1)).toBeLessThan(0.12);
    }
    // At the console stop every part is whole: nothing rests half drawn.
    const stop = 0.96;
    expect(scrollAt(stop)).toBe(PAGE_STOPS.at(-1));
    expect([...Array(n).keys()].every((i) => consoleAt(stop, i, n) === 1)).toBe(true);
  });

  describe("the dark room's turn, cream paper to the dark card", () => {
    // Scroll px through the runway at a window height h.
    const px = (p: number, h: number) => (scrollAt(p) * SCROLL_VH * h) / 100;
    const at = (p: number) => lookAt(arrivalAt(p), turnAt(p));

    it("starts where the card first stands in for the receipt, as the receipt exactly", () => {
      expect(TURN[0]).toBe(EXHIBIT_OUT[0]);
      expect(at(TURN[0])).toEqual(lookAt(0));
      expect(at(paid)).toEqual(lookAt(0));
    });

    it("turns the paper over at least 160px of scroll at 900px tall and 200px at 1080, evenly", () => {
      // The paper's tone from its first step off cream to the surface.
      const from = [...Array(4001).keys()].map((i) => TURN[0] + (i * (TURN[1] - TURN[0])) / 4000);
      const start = from.find((p) => at(p).paper < 1)!;
      const end = from.find((p) => at(p).paper === 0)!;
      expect(px(end, 900) - px(start, 900)).toBeGreaterThanOrEqual(160);
      expect(px(end, 1080) - px(start, 1080)).toBeGreaterThanOrEqual(200);
      // Never more than 6% of the turn in 8px of scroll at 900px tall: a crossfade, never a flip.
      let most = 0;
      for (let p = TURN[0]; p < TURN[1]; p += 0.0002) {
        let q = p;
        while (px(q, 900) - px(p, 900) < 8) q += 0.00002;
        most = Math.max(most, at(p).paper - at(q).paper);
      }
      expect(most).toBeLessThan(0.06);
    });

    it("keeps the receipt readable until the fold, then hands its ink to the row without an empty card", () => {
      const ps = [...Array(1001).keys()].map((i) => 0.88 + i * 0.0001);
      expect(at(ARRIVAL[0]).receipt).toBe(1);
      // The paper dims before the fold; its ink must not vanish with that lighting change.
      expect(at(ARRIVAL[0] - 0.001).receipt).toBe(1);
      for (const p of ps) {
        const { receipt, row } = at(p);
        expect(Math.max(receipt, row)).toBeGreaterThanOrEqual(0.75 - 1e-8);
        // Only a brief crossfade inside the fold; the row is whole before the glide starts.
        if (receipt > 0 && row > 0) {
          expect(arrivalAt(p)).toBeGreaterThan(0.12);
          expect(arrivalAt(p)).toBeLessThan(0.24);
        }
      }
      // The paper's own fill hands over to the card's ground only once that ground is whole under it.
      expect(ps.every((p) => at(p).paper === 1 || at(p).ground === 1)).toBe(true);
      expect(at(LAND)).toEqual(lookAt(1));
    });

    it("leaves the light room's look as it was", () => {
      expect(lookAt(0.07)).toEqual(lookAt(0.07, undefined));
      expect(lookAt(0.07).paper).toBeCloseTo(1 - (0.07 - 0.03) / 0.09);
    });
  });
});
