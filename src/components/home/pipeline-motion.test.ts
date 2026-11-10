import { describe, expect, it } from "vitest";
import { claimAt, trailAt } from "./pipeline-motion";

describe("scrolling claim progression", () => {
  const stops = [200, 300, 500, 700];
  const claims = (progress: number) => stops.map((stop) => claimAt(progress, 100, stop, 700));

  it("arrives with every photo at its origin and no result already printed", () => {
    expect(claims(0).every((claim) => claim.travel === 0 && claim.outcome === 0 && claim.dock === 0)).toBe(true);
  });

  it("stops early refusals while later claims keep travelling", () => {
    const [web, reused, wrong, genuine] = claims(0.5);
    expect(web).toEqual({ tip: 200, travel: 100, outcome: 1, dock: 1 });
    expect(reused).toEqual({ tip: 300, travel: 200, outcome: 1, dock: 1 });
    expect(wrong.tip).toBe(416);
    expect(genuine.tip).toBe(416);
    expect(wrong.outcome).toBe(0);
    expect(genuine.outcome).toBe(0);
  });

  it("holds at the same position without time-based completion and reverses to the same earlier state", () => {
    const earlier = claims(0.25);
    claims(0.9);
    expect(claims(0.25)).toEqual(earlier);
    expect(claims(0.25)).toEqual(earlier);
  });

  it("finishes at each check, with the genuine claim alone reaching the payout", () => {
    expect(claims(1).map((claim) => claim.tip)).toEqual(stops);
    expect(claims(1).every((claim) => claim.outcome === 1)).toBe(true);
    expect(claims(-1)).toEqual(claims(0));
    expect(claims(2)).toEqual(claims(1));
  });

  it("docks the last photo before printing its payment result", () => {
    const arrival = claimAt(600 / 632, 100, 700, 700);
    expect(arrival.tip).toBe(700);
    expect(arrival.dock).toBe(1);
    expect(arrival.outcome).toBe(0);
    const revealing = claimAt(616 / 632, 100, 700, 700);
    expect(revealing.tip).toBe(700);
    expect(revealing.outcome).toBeCloseTo(0.5);
  });

  it("matches the incoming speed and slows continuously to rest at the dock", () => {
    const at = (cursor: number) => claimAt((cursor - 100) / 632, 100, 700, 700).tip;
    const leftSpeed = (at(628) - at(627.999)) / 0.001;
    const rightSpeed = (at(628.001) - at(628)) / 0.001;
    expect(leftSpeed).toBeCloseTo(1, 3);
    expect(rightSpeed).toBeCloseTo(leftSpeed, 3);
    expect((at(700) - at(699.9)) / 0.1).toBeLessThan(0.01);
    expect(at(701)).toBe(at(700));
  });

  it("never overshoots or reveals a result while its photo is still falling", () => {
    let previous = claims(0);
    for (let step = 1; step <= 1000; step++) {
      const current = claims(step / 1000);
      current.forEach((claim, i) => {
        expect(claim.tip).toBeGreaterThanOrEqual(previous[i].tip);
        expect(claim.tip).toBeGreaterThanOrEqual(100);
        expect(claim.tip).toBeLessThanOrEqual(stops[i]);
        if (claim.tip < stops[i] - 1e-8) expect(claim.outcome).toBe(0);
      });
      previous = current;
    }
  });

  it("never draws a future row ahead of its moving claim", () => {
    expect(trailAt(140, 150, 100)).toBe(0);
    expect(trailAt(200, 150, 100)).toBe(0.5);
    expect(trailAt(300, 150, 100)).toBe(1);
    expect(trailAt(300, 150, 0)).toBe(0);
  });
});
