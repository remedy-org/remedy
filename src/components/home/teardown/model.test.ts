import { describe, expect, it } from "vitest";
import { CHECKS, EXHIBIT } from "./claim";
import { BEATS, RANGES, TOTAL_VH, clock, holdOf, stateAt } from "./model";

describe("Opened Exhibit model", () => {
  it("lays the beats end to end over p 0..1, about 70vh a beat", () => {
    expect(RANGES.intro[0]).toBe(0);
    expect(RANGES.paid[1]).toBeCloseTo(1);
    // DESIGN.md: never a pinned beat shorter than about 70vh.
    for (const b of BEATS) expect(b.vh).toBeGreaterThanOrEqual(70);
    for (let i = 1; i < BEATS.length; i++) expect(RANGES[BEATS[i].id][0]).toBeCloseTo(RANGES[BEATS[i - 1].id][1]);
    expect(TOTAL_VH / BEATS.length).toBeGreaterThanOrEqual(60);
    // The code check is the signature shot: the longest hold.
    expect(Math.max(...BEATS.map((b) => b.vh))).toBe(BEATS.find((b) => b.id === "code")?.vh);
  });

  it("starts whole and waiting, ends paid in sandbox with every check passed", () => {
    const a = stateAt(0);
    expect(a.cut).toBe(0);
    expect(a.done).toBe(0);
    expect(a.decision).toBe("waiting");
    expect(a.sent).toBe(false);
    const z = stateAt(1);
    expect(z.done).toBe(5);
    expect(z.decision).toBe("pay");
    expect(z.sent).toBe(true);
    expect(z.stamped).toBe(true);
    expect(z.receipt).toBe(1);
    expect(clock(z.seconds)).toBe(`0:${EXHIBIT.seconds}`);
  });

  it("shows each check at its hold, with the checks before it passed", () => {
    CHECKS.forEach((c, i) => {
      const s = stateAt(holdOf(c.id));
      expect(s.active).toBe(i);
      expect(s.done).toBe(i);
      expect(s.callout).toBeGreaterThan(0.95);
      expect(s.decision).toBe("checking");
    });
  });

  it("never leaves the side column blank between checks: the outgoing callout holds until the next cuts in", () => {
    const ids = ["intro", ...CHECKS.map((c) => c.id)] as const;
    for (const id of ids.slice(1)) {
      const [a, z] = RANGES[id];
      // Right up to the hand-off, the outgoing callout is at full strength.
      expect(stateAt(a - 0.0005).callout).toBe(1);
      // The incoming one is in after 5% of its beat, and holds until the next hand-off (the last check closes before
      // the payout).
      for (let t = 0.05; t <= (id === "torn" ? 0.88 : 0.999); t += 0.01) expect(stateAt(a + t * (z - a)).callout).toBeCloseTo(1, 5);
    }
  });

  it("reads the code one character at a time, M then 4 then T", () => {
    const seen = new Set<number>();
    for (let p = RANGES.code[0]; p <= RANGES.code[1]; p += 0.001) seen.add(stateAt(p).chars);
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it("never runs the clock backwards, and stays inside 0:00 to 0:15", () => {
    let last = -1;
    for (let p = 0; p <= 1; p += 0.002) {
      const s = stateAt(p).seconds;
      if (s === null) continue;
      expect(s).toBeGreaterThanOrEqual(last);
      expect(s).toBeLessThanOrEqual(EXHIBIT.seconds);
      last = s;
    }
  });

  it("is pure: the same p gives the same frame", () => {
    expect(stateAt(0.4321)).toEqual(stateAt(0.4321));
  });

  it("quotes the model verbatim from the stored run (RM-0442, case c02)", () => {
    expect(CHECKS[3].quote).toBe("The handwritten code on the attached paper tag reads “M4T”, matching the expected code character by character.");
    expect(CHECKS[4].quote).toBe("Two separated pillow halves are visible, with exposed cut edges and stuffing spilling out.");
  });
});
