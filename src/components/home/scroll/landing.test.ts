import { describe, expect, it } from "vitest";
import { calm, landing, landingTime, warp } from "./landing";

describe("landing", () => {
  it("starts at 0, ends exactly on the stop and never turns back, from rest to a hard fling", () => {
    for (const s0 of [0, 1, 2, 4, 8, 16, 30]) {
      const e = landing(s0);
      expect(e(0)).toBeCloseTo(0, 9);
      expect(e(1)).toBeCloseTo(1, 9);
      let prev = 0;
      for (let i = 1; i <= 400; i++) {
        const v = e(i / 400);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        expect(v).toBeLessThanOrEqual(1 + 1e-9);
        prev = v;
      }
    }
  });

  it("enters at the page's own speed", () => {
    const h = 1e-5;
    for (const s0 of [0, 2, 5, 12]) expect(landing(s0)(h) / h).toBeCloseTo(s0, 2);
  });

  it("then slows evenly: after the brake, each tenth of the time is slower than the last by the same step", () => {
    const e = landing(4);
    const speed = (t: number) => (e(t + 1e-4) - e(t)) / 1e-4;
    const steps = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((t) => speed(t) - speed(t + 0.1));
    for (const s of steps) expect(s).toBeCloseTo(steps[0], 3);
    expect(speed(0.999)).toBeLessThan(0.01);
  });

  it("gives a longer way more time, within bounds", () => {
    expect(landingTime(0)).toBe(0.9);
    expect(landingTime(0.75)).toBeCloseTo(1.25);
    expect(landingTime(1.6)).toBe(1.4);
    expect(landingTime(4)).toBe(1.4);
  });

  it("gives a slow stretch its weight's worth of the way, in either direction", () => {
    // The hero to chapter 01: the dolly and hand-off (207 to 670) five times slower.
    const w = warp(0, 1410, [[207, 670, 5]]);
    expect(w.length).toBe(1410 + 4 * 463);
    expect(w.entry).toBe(1);
    // Progress up to the stretch is the plain way; across it, each px takes five.
    expect(w.at(207 / w.length) * 1410).toBeCloseTo(207);
    expect(w.at((207 + 5 * 463) / w.length) * 1410).toBeCloseTo(670);
    expect(w.at(1)).toBe(1);
    // Flung back up from 01, the same stretch is the slow one.
    const up = warp(1410, 0, [[207, 670, 5]]);
    expect(up.length).toBe(w.length);
    expect(1410 - up.at((1410 - 670) / up.length) * 1410).toBeCloseTo(670);
  });

  it("is the plain way with no slow stretch, or one outside the way", () => {
    for (const slow of [[], [[2000, 3000, 4] as const]]) {
      const w = warp(100, 600, slow);
      expect(w.length).toBe(500);
      for (const u of [0, 0.25, 0.5, 1]) expect(w.at(u)).toBeCloseTo(u);
    }
    expect(warp(5, 5).at(0.5)).toBe(1);
  });

  it("starts at the weight it is entered in", () => {
    expect(warp(0, 100, [[-50, 40, 3]]).entry).toBe(3);
    expect(warp(0, 100, [[0, 40, 3]]).entry).toBe(3);
    expect(warp(0, 100, [[10, 40, 3]]).entry).toBe(1);
  });

  it("calm: eases in from rest and carries on at the page's own speed when moving, onto the stop, never turning back", () => {
    const h = 1e-5;
    for (const s0 of [0, 0.5, 1, 2, 3, 6]) {
      const e = calm(s0);
      expect(e(0)).toBeCloseTo(0, 9);
      expect(e(1)).toBeCloseTo(1, 9);
      expect(e(h) / h).toBeCloseTo(Math.min(s0, s0 > 3 ? s0 : 3), 2);
      let prev = 0;
      for (let i = 1; i <= 400; i++) {
        const v = e(i / 400);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        expect(v).toBeLessThanOrEqual(1 + 1e-9);
        prev = v;
      }
    }
    // From rest: no abrupt start (a tenth of the way in its first fifth of the time) and a peak speed 1.5 times the
    // average, where the brake curve set off at twice the average.
    const rest = calm(0);
    expect(rest(0.2)).toBeLessThan(0.11);
    expect((rest(0.5 + h) - rest(0.5 - h)) / (2 * h)).toBeCloseTo(1.5, 3);
  });
});
