import { describe, expect, it } from "vitest";
import { SLOW_MS, createFrameWatch, stageLayers } from "./watch";

const feed = (watch: (ms: number) => boolean, ms: number[]) => ms.map(watch).some(Boolean);

describe("the live scene's frame watch", () => {
  it("keeps the scene on a GPU that draws every frame in time", () => {
    expect(feed(createFrameWatch(), Array(64).fill(16.7))).toBe(false);
  });

  it("steps down when most drawn frames are slow", () => {
    expect(feed(createFrameWatch(), [40, 16, 45, 50, 38, 16, 60, 42])).toBe(true);
  });

  it("ignores a few slow frames among fast ones", () => {
    expect(feed(createFrameWatch(), [16, 16, 90, 16, 16, 80, 16, 16])).toBe(false);
  });

  it("does not count stalls (a hidden tab, a long task)", () => {
    expect(feed(createFrameWatch(), [...Array(8).fill(400), ...Array(7).fill(16.7)])).toBe(false);
  });

  it("judges at the threshold, not below it", () => {
    expect(feed(createFrameWatch(), Array(8).fill(SLOW_MS))).toBe(false);
    expect(feed(createFrameWatch(), Array(8).fill(SLOW_MS + 1))).toBe(true);
  });
});

describe("the stage's layers", () => {
  const all = (["live", "poster"] as const).flatMap((mode) => [false, true].flatMap((failed) => [false, true].map((warm) => ({ mode, failed, warm }))));

  it("never leaves the canvas over the posters once the scene has failed", () => {
    for (const s of all.filter((s) => s.failed)) expect(stageLayers(s)).toEqual({ canvas: false, canvasOn: false, posters: true });
  });

  it("always shows the posters while the canvas is not showing", () => {
    for (const s of all) {
      const l = stageLayers(s);
      expect(l.canvasOn || l.posters).toBe(true);
    }
  });

  it("shows the canvas alone once the live scene is warm", () => {
    expect(stageLayers({ mode: "live", failed: false, warm: true })).toEqual({ canvas: true, canvasOn: true, posters: false });
    expect(stageLayers({ mode: "poster", failed: false, warm: true }).canvas).toBe(false);
  });
});
