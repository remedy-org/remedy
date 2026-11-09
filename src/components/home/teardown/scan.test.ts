import { describe, expect, it } from "vitest";
import { PAUSE_MS, SWEEP_MS, TRAIL, quadPoint, scanAt, scanGeometry, type Pt } from "./scan";

// A photo seen in perspective: its top edge narrower than its foot, as the tilted phone shows it.
const quad: Pt[] = [
  [900, 400],
  [950, 392],
  [968, 500],
  [905, 512],
];

describe("check 1's scan line", () => {
  it("maps the unit square onto the photo's corners exactly", () => {
    const corners: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    corners.forEach(([u, v], i) => {
      const [x, y] = quadPoint(quad, u, v);
      expect(x).toBeCloseTo(quad[i][0], 6);
      expect(y).toBeCloseTo(quad[i][1], 6);
    });
  });

  it("keeps every point of the line and its glow on the photo, its ends on the side edges", () => {
    for (let s = 0; s <= 1; s += 0.05) {
      const g = scanGeometry(quad, s);
      const [l, r] = g.line;
      // Each end lies on its side edge: between that edge's two corners.
      const onEdge = (p: Pt, a: Pt, b: Pt) => Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) < 1e-6;
      expect(onEdge(l, quad[0], quad[3])).toBe(true);
      expect(onEdge(r, quad[1], quad[2])).toBe(true);
      // The glow never reaches above the photo's top edge.
      expect(scanGeometry(quad, Math.min(s, TRAIL / 2)).glow[0]).toEqual(quadPoint(quad, 0, 0));
    }
  });

  it("sweeps from the photo's top to its foot, then rests off before the next sweep", () => {
    expect(scanAt(0)?.s).toBe(0);
    expect(scanAt(SWEEP_MS - 1)?.s).toBeCloseTo(1, 2);
    expect(scanAt(SWEEP_MS + 1)).toBeNull();
    expect(scanAt(SWEEP_MS + PAUSE_MS)?.s).toBe(0);
    // Downward only, at a steady pace: no step between two nearby moments.
    for (let t = 0; t < SWEEP_MS - 20; t += 20) {
      const a = scanAt(t)!.s;
      const b = scanAt(t + 20)!.s;
      expect(b).toBeGreaterThan(a);
      expect(b - a).toBeLessThan(0.03);
    }
  });

  it("is at full strength through the middle of a sweep and eases in and out at its ends", () => {
    expect(scanAt(0)?.alpha).toBe(0);
    expect(scanAt(SWEEP_MS / 2)?.alpha).toBe(1);
    expect(scanAt(SWEEP_MS * 0.25)?.alpha).toBe(1);
    expect(scanAt(SWEEP_MS - 1)?.alpha).toBeLessThan(0.01);
  });
});
