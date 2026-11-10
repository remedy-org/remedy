import { describe, expect, it } from "vitest";
import { fitPosterFrame, posterFrame, type PosterFrame } from "./poster-geometry";
import { scanGeometry } from "./scan";

const frame: PosterFrame = {
  width: 640,
  height: 640,
  anchor: { x: 480, y: 320 },
  photo: { quad: [[400, 200], [500, 210], [490, 350], [390, 340]], strength: 1 },
};

describe("poster feature coordinates", () => {
  it("follows the actual contained image, including its letterboxing and the sticky stage offset", () => {
    const fit = fitPosterFrame(frame, { left: 24, top: 300, width: 342, height: 240 }, { left: 0, top: 72 }, true);
    expect(fit.anchor).toEqual({ x: 255, y: 348 });
    expect(fit.photo?.quad[0]).toEqual([225, 303]);
    expect(fit.photo?.quad[2]).toEqual([258.75, 359.25]);
  });

  it("accounts for a desktop poster's cover crop instead of stretching its coordinates", () => {
    const fit = fitPosterFrame({ ...frame, width: 1440, height: 900, anchor: { x: 1200, y: 450 } }, { left: 0, top: 72, width: 1440, height: 828 }, { left: 0, top: 72 }, false);
    expect(fit.anchor).toEqual({ x: 1200, y: 414 });
  });

  it("keeps the moving scan inside the same transformed phone-photo plane", () => {
    const fit = fitPosterFrame(frame, { left: 24, top: 300, width: 342, height: 240 }, { left: 0, top: 72 }, true);
    const scan = scanGeometry(fit.photo!.quad, 0.5);
    const original = scanGeometry(frame.photo!.quad, 0.5);
    expect(scan.line[0][0]).toBeCloseTo(75 + original.line[0][0] * 0.375);
    expect(scan.line[0][1]).toBeCloseTo(228 + original.line[0][1] * 0.375);
    expect(scan.line[1][0]).toBeCloseTo(75 + original.line[1][0] * 0.375);
  });

  it("retains captured photo and feature geometry for both fallback sizes", () => {
    for (const small of [true, false]) {
      const live = posterFrame("live", small, { left: 0, top: 0, width: 390, height: 390 }, { left: 0, top: 0 });
      expect(live?.anchor).toBeTruthy();
      expect(live?.photo?.quad).toHaveLength(4);
      expect(live?.photo?.strength).toBeGreaterThan(0);
      expect(posterFrame("code", small, { left: 0, top: 0, width: 390, height: 390 }, { left: 0, top: 0 })?.anchor).toBeTruthy();
      expect(posterFrame("torn", small, { left: 0, top: 0, width: 390, height: 390 }, { left: 0, top: 0 })?.anchor).toBeTruthy();
    }
  });
});
