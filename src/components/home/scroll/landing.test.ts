import { describe, expect, it } from "vitest";
import { CALM_PEAK, calm, calmLanding, entry, warp } from "./landing";

/** The page's top speed over a landing, px/s, and its largest 60 Hz frame, px, sampled finely. */
function motion(from: number, to: number, screen: number, slow: Parameters<typeof calmLanding>[3] = [], v = 0) {
  const l = calmLanding(from, to, screen, slow);
  const e = calm(entry(v, l), l.ease);
  const y = (t: number) => from + (to - from) * l.way.at(e(Math.min(1, t / l.duration)));
  let peak = 0;
  let frame = 0;
  let back = 0;
  const dt = 1 / 1000;
  for (let t = 0; t < l.duration; t += dt) {
    const d = (y(t + dt) - y(t)) * Math.sign(to - from);
    peak = Math.max(peak, d / dt);
    if (d < -1e-9) back++;
    frame = Math.max(frame, Math.abs(y(t + 1 / 60) - y(t)));
  }
  return { ...l, peak, frame, back, end: y(l.duration) };
}

describe("landing", () => {
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

  it("calm: starts at 0, ends on the stop, never turns back and enters at the page's own speed", () => {
    const h = 1e-6;
    for (const ease of [0.18, 0.3, 0.5])
      for (const s0 of [0, 0.5, 1, 1.5, 2]) {
        const e = calm(s0, ease);
        expect(e(0)).toBeCloseTo(0, 9);
        expect(e(1)).toBeCloseTo(1, 9);
        expect(e(h) / h).toBeCloseTo(Math.min(s0, 1 / ease), 3);
        let prev = 0;
        let prevV = s0;
        for (let i = 1; i <= 1000; i++) {
          const v = e(i / 1000);
          expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
          expect(v).toBeLessThanOrEqual(1 + 1e-9);
          // Its speed changes smoothly: no step from one thousandth of the time to the next.
          const speed = (v - prev) * 1000;
          expect(Math.abs(speed - prevV)).toBeLessThan(0.05);
          prev = v;
          prevV = speed;
        }
      }
  });

  it("S1 calm: from rest it eases in from no speed at all, holds an even cruise and eases out to rest", () => {
    const e = calm(0, 0.25);
    const speed = (t: number) => (e(t + 1e-6) - e(t - 1e-6)) / 2e-6;
    // Sets off gently: a fiftieth of the time in, it has barely moved, and its speed grows from none.
    expect(e(0.02)).toBeLessThan(0.001);
    expect(speed(0.01)).toBeLessThan(speed(0.05) / 10);
    // The cruise: 1 / (1 - ease) times the average speed, held evenly.
    for (const t of [0.3, 0.5, 0.7]) expect(speed(t)).toBeCloseTo(1 / 0.75, 4);
    expect(speed(0.999)).toBeLessThan(0.001);
    // With no room for a cruise it is one bell, twice the average at its peak.
    expect((calm(0)(0.5 + 1e-6) - calm(0)(0.5 - 1e-6)) / 2e-6).toBeCloseTo(2, 4);
  });

  it("S1: a beat under a screen away lands in about 1.3 s, two screens in about 2 s, never over CALM_PEAK", () => {
    for (const screen of [900, 1080]) {
      for (const px of [40, 300, 0.7 * screen, screen]) {
        const m = motion(1000, 1000 + px, screen);
        expect(m.duration).toBeGreaterThanOrEqual(1.3);
        expect(m.duration).toBeLessThanOrEqual(1.4);
        expect(m.peak).toBeLessThanOrEqual(CALM_PEAK + 1);
        expect(m.end).toBeCloseTo(1000 + px, 6);
      }
      // Two screens: a little over 2 s, or as long as CALM_PEAK needs.
      const two = motion(5000, 5000 - 2 * screen, screen);
      expect(two.duration).toBeGreaterThanOrEqual(1.9);
      expect(two.duration).toBeLessThanOrEqual(screen === 900 ? 2.1 : 2.6);
      expect(two.peak).toBeLessThanOrEqual(CALM_PEAK + 1);
      expect(two.back).toBe(0);
    }
    expect(calmLanding(0, 1800, 900).duration).toBeCloseTo(2.09, 2);
  });

  it("S1: no 60 Hz frame moves over 40px, from rest or entered at the page's own speed, slow stretches and all", () => {
    for (const screen of [900, 1080])
      for (const v of [0, 400, 1050, 4000])
        for (const [from, to] of [[0, 478], [478, 823], [823, 1858], [4278, 4972], [6698, 7988], [7988, 9910], [9910, 7988]]) {
          const m = motion(from, to, screen, [[207, 670, 5], [4400, 4800, 3], [7988, 8586, 2]], v);
          expect(m.frame).toBeLessThanOrEqual(40);
          expect(m.peak).toBeLessThanOrEqual(CALM_PEAK + 1);
          expect(m.back).toBe(0);
          expect(m.end).toBeCloseTo(to, 6);
        }
  });

  it("S1: crossing a slow stretch takes a little longer, up to 0.3 s, and the stretch plays slower than the rest", () => {
    const plain = calmLanding(0, 823, 900);
    const dolly = calmLanding(0, 823, 900, [[207, 670, 5]]);
    expect(dolly.duration).toBeGreaterThan(plain.duration);
    expect(dolly.duration).toBeLessThanOrEqual(plain.duration + 0.3 + 1e-9);
    expect(dolly.way.length).toBeGreaterThan(823);
  });
});
