import { describe, expect, it } from "vitest";
import storedVerdicts from "@/lib/demo/verdicts.json";
import { CHECKS, EXHIBIT } from "./claim";
import { ARRIVE, BEATS, DEPART, RANGES, RECEIPT_FADE, SHOTS, TOTAL_VH, clock, holdOf, shotAt, stateAt } from "./model";

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
    expect(clock(z.seconds)).toBe(`0:${EXHIBIT.seconds}.0`);
  });

  it("shows each check at its hold finished: it and the checks before it passed, the camera still on it", () => {
    CHECKS.forEach((c, i) => {
      const s = stateAt(holdOf(c.id));
      expect(s.active).toBe(i);
      expect(s.done).toBe(i + 1);
      expect(s.leaderFade).toBe(1);
      expect(s.callout).toBeGreaterThan(0.95);
      expect(s.decision).toBe("checking");
    });
  });

  it("never leaves the side column blank between checks: the outgoing callout holds until the next cuts in", () => {
    const ids = ["intro", ...CHECKS.map((c) => c.id)] as const;
    for (const id of ids.slice(1)) {
      const [a, z] = RANGES[id];
      // Right up to the hand-off, the outgoing callout is up; the incoming one is up from the hand-off on.
      expect(stateAt(a - 0.0005).callout).toBe(1);
      for (let t = 0; t <= 0.999; t += 0.01) expect(stateAt(a + t * (z - a)).callout).toBe(1);
    }
  });

  it("puts the callout up or down, never part way, so a stop never rests on half-drawn words", () => {
    for (let p = 0; p <= 1; p += 0.001) expect([0, 1]).toContain(stateAt(p).callout);
    // The intro's is up from its first frame, with the pillow: the side column is never empty beside it.
    const [a, z] = RANGES.intro;
    expect(stateAt(a + 0.001 * (z - a)).callout).toBe(1);
    expect(stateAt(a + 0.5 * (z - a)).callout).toBe(1);
  });

  it("hands the last check's column to the receipt with no blank frame, and rules Pay before the stamp lands", () => {
    const [a, z] = RANGES.paid;
    for (let t = 0; t <= 1; t += 0.005) {
      const s = stateAt(a + t * (z - a));
      // The receipt's opacity is receipt * RECEIPT_FADE (OpenedExhibit.tsx); the outgoing words go once it is half
      // opaque over them.
      expect(s.callout).toBe(s.receipt * RECEIPT_FADE >= 0.5 ? 0 : 1);
      if (s.stamped) {
        expect(s.decision).toBe("pay");
        expect(s.sent).toBe(true);
      }
    }
    expect(stateAt(a + 0.24 * (z - a)).receipt).toBeCloseTo(1, 5);
  });

  it("draws a check's leader only as the camera arrives on its part, and fades it as the camera leaves", () => {
    for (const c of CHECKS) {
      const [a, z] = RANGES[c.id];
      const at = (t: number) => stateAt(a + t * (z - a));
      expect(at(0.03).leader).toBe(0);
      expect(at(ARRIVE[c.id] - 0.11).leader).toBe(0);
      expect(at(ARRIVE[c.id]).leader).toBeCloseTo(1, 5);
      expect(at(0.6).leader).toBeCloseTo(1, 5);
      expect(at(DEPART[c.id]).leader).toBeCloseTo(1, 5);
      // It fades with its ink held drawn, never retracting into a floating segment.
      expect(at(DEPART[c.id] + 0.03).leaderInk).toBe(1);
      expect(at(DEPART[c.id] + 0.061).leader).toBeLessThan(0.01);
      expect(at(0.999).leader).toBeLessThan(0.01);
    }
    expect(stateAt(holdOf("intro")).leader).toBe(0);
    expect(stateAt(holdOf("paid")).leader).toBe(0);
  });

  it("pulls the camera back mid-move between distant subjects, never tighter than the wider end", () => {
    const keys = BEATS.flatMap((b) => [RANGES[b.id][0] + ARRIVE[b.id] * (RANGES[b.id][1] - RANGES[b.id][0]), RANGES[b.id][0] + DEPART[b.id] * (RANGES[b.id][1] - RANGES[b.id][0])]);
    for (let i = 1; i < keys.length - 1; i += 2) {
      const [from, to] = [keys[i], keys[i + 1]];
      const a = shotAt(from);
      const b = shotAt(to);
      for (let p = from; p <= to; p += (to - from) / 40) expect(shotAt(p).rx).toBeGreaterThanOrEqual(Math.min(a.rx, b.rx) - 1e-9);
    }
    // Live to the prints, the longest move: mid-way, both subjects fit, wider than either end.
    const mid = (RANGES.live[0] + 0.88 * (RANGES.live[1] - RANGES.live[0]) + RANGES.fp[0] + 0.22 * (RANGES.fp[1] - RANGES.fp[0])) / 2;
    expect(shotAt(mid).rx).toBeGreaterThan(Math.max(shotAt(holdOf("live")).rx, shotAt(holdOf("fp")).rx));
    // At the keys themselves, the shot is exactly the beat's.
    expect(shotAt(RANGES.code[0] + ARRIVE.code * (RANGES.code[1] - RANGES.code[0])).rx).toBeCloseTo(SHOTS.code.rx, 9);
  });

  it("gives the moves onto and off the tag macro more scroll than the others, and holds the cut pillow open to the end", () => {
    const span = (from: (typeof BEATS)[number]["id"], to: (typeof BEATS)[number]["id"]) =>
      (1 - DEPART[from]) * (RANGES[from][1] - RANGES[from][0]) + ARRIVE[to] * (RANGES[to][1] - RANGES[to][0]);
    expect(span("acct", "code")).toBeGreaterThan(1.4 * span("live", "fp"));
    expect(span("code", "torn")).toBeGreaterThan(1.4 * span("live", "fp"));
    const [a, z] = RANGES.paid;
    for (let t = 0.45; t <= 1; t += 0.05) expect(stateAt(a + t * (z - a)).explode).toBeCloseTo(1, 5);
  });

  it("moves the stage's mask with the camera onto and off the tag macro", () => {
    expect(stateAt(holdOf("acct")).macro).toBe(0);
    expect(stateAt(RANGES.code[0]).macro).toBeGreaterThan(0);
    expect(stateAt(RANGES.code[0]).macro).toBeLessThan(1);
    expect(stateAt(holdOf("code")).macro).toBe(1);
    expect(stateAt(RANGES.torn[0]).macro).toBeGreaterThan(0);
    expect(stateAt(holdOf("torn")).macro).toBe(0);
  });

  it("closes the prints before the camera's move carries them off the frame", () => {
    const [a, z] = RANGES.acct;
    expect(stateAt(a + 0.12 * (z - a)).fp).toBe(0);
  });

  it("reads the code one character at a time, M then 4 then T", () => {
    const seen = new Set<number>();
    for (let p = RANGES.code[0]; p <= RANGES.code[1]; p += 0.001) seen.add(stateAt(p).chars);
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it("has read all three characters by the code beat's hold, none still being read", () => {
    expect(stateAt(holdOf("code")).chars).toBe(3);
    expect(stateAt(holdOf("code")).charNow).toBe(-1);
  });

  it("moves the clock at every check's hold, in tenths through the pre-checks", () => {
    const at = CHECKS.map((c) => clock(stateAt(holdOf(c.id)).seconds));
    // Each check's stop shows a later time than the one before, the three pre-checks inside the first half second.
    expect([...at].sort()).toEqual(at);
    expect(new Set(at).size).toBe(CHECKS.length);
    for (const t of at.slice(0, 3)) expect(t).toMatch(/^0:00\.[0-4]$/);
    expect(at[0]).not.toBe("0:00.0");
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

  it("quotes the model verbatim from the stored answer (RM-0442, case k01)", () => {
    const answer = storedVerdicts.find((v) => v.case === "k01-feathers-M4T")!.verdict;
    const curly = (t: string) => t.replace(/"([^"]*)"/g, "“$1”");
    expect(CHECKS[3].quote).toBe(curly(answer.challenge_code.evidence));
    expect(CHECKS[4].quote).toBe(curly(answer.steps[0].evidence));
  });
});
