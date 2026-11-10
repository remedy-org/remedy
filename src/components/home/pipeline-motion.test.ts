import { describe, expect, it } from "vitest";
import { claimAt, trailAt } from "./pipeline-motion";

describe("scrolling claim progression", () => {
  const stops = [200, 300, 500, 700];
  const claims = (progress: number) => stops.map((stop) => claimAt(progress, 100, stop, 700));

  it("arrives with every photo at its origin and no result already printed", () => {
    expect(claims(0).every((claim) => claim.travel === 0 && claim.outcome === 0)).toBe(true);
  });

  it("stops early refusals while later claims keep travelling", () => {
    const [web, reused, wrong, genuine] = claims(0.5);
    expect(web).toEqual({ tip: 200, travel: 100, outcome: 1 });
    expect(reused).toEqual({ tip: 300, travel: 200, outcome: 1 });
    expect(wrong.tip).toBe(400);
    expect(genuine.tip).toBe(400);
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

  it("never draws a future row ahead of its moving claim", () => {
    expect(trailAt(140, 150, 100)).toBe(0);
    expect(trailAt(200, 150, 100)).toBe(0.5);
    expect(trailAt(300, 150, 100)).toBe(1);
    expect(trailAt(300, 150, 0)).toBe(0);
  });
});
