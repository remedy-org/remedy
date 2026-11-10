import { describe, expect, it } from "vitest";
import { PAGE_STOPS } from "../custody/CustodyStage";
import { ANCHOR_AT, REST, SECTION_VH, T } from "../problemTimeline";
import { ANCHORED, framed, LINE, MERGE, nearestClean, RESTS, SLOW, STOPS, tidy, type Page } from "./stops";

/** A stand-in page at 1440x900: the runway at 64 with 7316px of travel, the Problem sheet's top at 8280. */
const page: Page = {
  size: { width: 1440, height: 900 },
  top: () => 0,
  beat: (f) => 64 + f * 7316,
  beats: () => undefined,
  sheet: (t) => 8280 - 900 + (t / 100) * 900,
  line: (_, under = LINE) => framed(10000, 64, under),
  past: () => 0,
  foot: () => 0,
  end: () => 13487,
  fit: (y) => y,
};

describe("clean frames", () => {
  // A 900px screen under a 64px nav: its edges sit 64 and 900px below scrollY.
  const edges = [64, 900];

  it("keeps the preferred frame when it cuts nothing", () => {
    expect(nearestClean(1000, [[1100, 1150], [2000, 2050]], edges)).toBe(1000);
  });

  it("moves the shortest way off a line the screen's foot would cut", () => {
    // A line from 1880 to 1920 is cut by the foot at 1900 when scrollY is 1000: 20px up clears it, 20px down shows it.
    expect(nearestClean(1000, [[1880, 1920]], edges)).toBe(980);
    expect(nearestClean(1010, [[1880, 1920]], edges)).toBe(1020);
  });

  it("stays inside its range, and only then lets the next heading show", () => {
    // Results at 1440x900: the zero's line ends at 1300, For companies' heading starts at 1990 and its tabs at 2100.
    const boxes: [number, number][] = [[1990, 2060], [2100, 2190]];
    // Its heading kept below the foot when there is room, right up to the foot.
    expect(nearestClean(1100, boxes, edges, { cap: 1990 - 900 })).toBe(1090);
    expect(nearestClean(1100, boxes, edges, { min: 1085, cap: 1990 - 900 })).toBe(1090);
    expect(nearestClean(1100, [[1996, 2060]], edges, { min: 1085, cap: 1990 - 900 })).toBe(1090);
    // No room above the cap (min holds it below): the nearest clean frame, the heading whole on screen.
    expect(nearestClean(1100, boxes, edges, { min: 1095, cap: 1990 - 900 })).toBe(1160);
  });

  it("keeps the screen's foot out of the air under a hairline, so no rule lies along the foot", () => {
    // A check's top rule at 1978: at scrollY 1080 it would sit 2px above a 900px screen's foot.
    const rule: [number, number][] = [[1978, 1978 + 12]];
    expect(nearestClean(1080, [], edges, { foot: rule })).toBe(1078);
    expect(nearestClean(1086, [], edges, { foot: rule })).toBe(1090);
    // Under the nav it is only a hairline tucked away: the top edge may sit on it.
    expect(nearestClean(1914, [], edges, { foot: rule })).toBe(1914);
  });

  it("cuts least when nothing in range is clean: an edge in a line's leading, never through its words", () => {
    // Fraud checks at 1024x768: the foot can clear gate 03 (its heading and text together) only above the range or
    // below it.
    const boxes: [number, number][] = [[9561, 9691]];
    expect(nearestClean(8879, boxes, [64, 768], { min: 8799, max: 8911 })).toBe(8799);
    // One block taller than the screen: the edges as near its ends as the range allows.
    expect(nearestClean(1300, [[0, 5000]], edges, { min: 900, max: 1100 })).toBe(900);
  });
});

describe("scroll stops", () => {
  it("puts an element's top exactly `under` px below the nav", () => {
    // An eyebrow at document y 10514 under a 64px nav sits on the top line at scrollY 10402.
    expect(framed(10514, 64, LINE)).toBe(10402);
    // A hairline tucked under the nav by one pixel.
    expect(framed(11050, 64, -1)).toBe(10987);
  });

  it("rounds, clamps to the page, sorts, and merges stops closer than MERGE", () => {
    expect(tidy([1410.4, -3, 64, 2144, 99_999], 13_369)).toEqual([0, 1410, 2144, 13_369]);
    expect(tidy([100, 100 + MERGE - 1, 100 + MERGE], 1000)).toEqual([100, 100 + MERGE]);
    expect(tidy([], 1000)).toEqual([]);
  });

  it("stops the wheel on every beat Space and Page Down stop on in the Chain of Custody, in order", () => {
    const custody = STOPS.filter((s) => /^Chain of Custody \d/.test(s.name)).map((s) => s.at(page));
    expect(custody).toEqual(PAGE_STOPS.slice(1).map((f) => 64 + f * 7316));
    expect(custody).toHaveLength(6); // 01, 02, the exhibit's live photo, check 3 and paid receipt, the console
  });

  it("stops on How it works between the hero and chapter 01: the dolly landed, before the hand-over, never a beat skimmed", () => {
    const names = STOPS.map((s) => s.name);
    expect(names.slice(0, 3)).toEqual(["Hero", "How it works", "Chain of Custody 1"]);
    const how = STOPS[1].at(page) as number;
    const dolly = SLOW.find((s) => s.name === "The dolly")!.at(page)!;
    // Inside the dolly's slow stretch, past where the laptop arrives (p 0.11) and short of the hand-over (p 0.12).
    expect(how).toBeGreaterThan(dolly[0]);
    expect(how).toBeLessThan(dolly[1]);
    expect(how).toBeGreaterThan(MERGE);
    expect((STOPS[2].at(page) as number) - how).toBeGreaterThan(MERGE);
    expect(STOPS[1].inner).toBeUndefined();
  });

  it("goes up on the same finished beats as down, as Page Up does: no stop is one way, the sheet's included", () => {
    expect(STOPS.filter((s) => "down" in s).map((s) => s.name)).toEqual([]);
    const story = STOPS.filter((s) => s.name.startsWith("Chain of Custody ")).map((s) => s.name);
    // A hard fling skims the story's inner beats, never a section's stop, nor check 3: a fling down the exhibit rests
    // once on the checks.
    const inner = STOPS.filter((s) => s.inner).map((s) => s.name);
    expect(inner).toEqual(story.slice(1, -1).filter((n) => n !== "Chain of Custody 4"));
    expect(inner).not.toContain("Chain of Custody 4");
  });

  it("lands the Problem sheet open where the nav's Problem does, then cut and paid off: two gestures, the loop closing between", () => {
    const sheet = STOPS.filter((s) => s.name.startsWith("Problem")).map((s) => s.at(page) as number);
    expect(sheet).toHaveLength(2);
    // Where the nav's Problem lands (t = ANCHOR_AT, the section's top 20vh above the nav line), a hair before card 4.
    expect(8280 + 0.2 * 900 - sheet[0]).toBeGreaterThan(1);
    expect(8280 + 0.2 * 900 - sheet[0]).toBeLessThan(5);
    expect(ANCHOR_AT).toBeLessThanOrEqual(T.card4[0]);
    // The cut stop rests past every beat and before Fraud checks starts to cover the sheet.
    expect(sheet[1]).toBeGreaterThan(page.sheet(REST)!);
    expect(sheet[1]).toBeLessThan(page.sheet(T.cover[0])!);
    expect(T.cover[1]).toBe(SECTION_VH);
    // The loop closing is no stop, only a slow stretch three times slower on the glide from open to cut, and the cut
    // after it.
    expect(STOPS.map((s) => s.name)).not.toContain("Problem, the loop closed");
    const slow = (name: string) => SLOW.find((s) => s.name === name)!.at(page)!;
    expect(slow("The loop closes")).toEqual([page.sheet(T.card4[0]), page.sheet(T.ring[1]), 3]);
    for (const name of ["The loop closes", "The loop is cut"]) {
      expect(slow(name)[0]).toBeGreaterThan(sheet[0]);
      expect(slow(name)[1]).toBeLessThan(sheet[1]);
    }
  });

  it("slows each exhibit check's draw three times on a glide, and lets a slow gesture rest on any check at its hold", () => {
    const custody = STOPS.filter((s) => /^Chain of Custody \d/.test(s.name)).map((s) => s.at(page) as number);
    const draws = SLOW.filter((s) => s.name.startsWith("Check ")).map((s) => s.at(page)!);
    // The live camera, the fingerprint, the tag's code and the cut: two on the glide to check 3, two on the one to paid.
    expect(draws).toHaveLength(4);
    for (const [a, b, k] of draws) {
      expect(k).toBe(3);
      expect(b - a).toBeGreaterThan(400); // most of a beat's 70vh of scroll
    }
    expect(draws.slice(0, 2).every(([a, b]) => a > custody[2] && b < custody[3])).toBe(true);
    expect(draws.slice(2).every(([a, b]) => a > custody[3] && b < custody[4])).toBe(true);
    // Every check's hold is a rest, check 3's being its stop; each just after its draw.
    const rests = RESTS.map((s) => s.at(page) as number);
    expect(rests).toHaveLength(5);
    expect(rests[2]).toBeCloseTo(custody[3], 6);
    for (const [i, [, b]] of draws.entries()) expect(rests[i < 2 ? i : i + 1] - b).toBeGreaterThan(0);
  });

  it("names every stop once, and every anchored section's stop exists", () => {
    const names = STOPS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of Object.values(ANCHORED)) expect(names).toContain(name);
  });

  it("keeps the company introduction 8 to 16px below a 72px header even when the console is taller than the viewport", () => {
    const companies = STOPS.find((s) => s.name === "For companies")!;
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const headerTop = 12530;
      const frames: unknown[] = [];
      const laidOut: Page = {
        ...page,
        size,
        line: (sel, under = LINE) => sel === "#companies header" ? framed(headerTop, 72, under) : undefined,
        foot: () => headerTop + 1200 - size.height,
        fit: (y, frame) => {
          frames.push(frame);
          return y === undefined ? undefined : Math.min(frame?.max ?? Infinity, Math.max(frame?.min ?? 0, y + 300));
        },
      };
      const y = companies.at(laidOut) as number;
      expect(headerTop - y - 72).toBeGreaterThanOrEqual(8);
      expect(headerTop - y - 72).toBeLessThanOrEqual(16);
      expect(frames).toEqual([{ min: headerTop - 72 - 16, max: headerTop - 72 - 8 }]);
    }
    expect(ANCHORED.companies).toBe("For companies");
  });

  it("lists the stops top to bottom on a laid-out page", () => {
    const real: Page = {
      ...page,
      line: (sel, under = LINE) => {
        const tops: Record<string, number> = {
          "#checks header": 10514,
          "#checks ol > li:nth-child(3)": 11050,
          "#proof": 11844,
          "#proof header": 11940,
          "#companies header": 12530,
          "#companies [data-tour]": 12687,
        };
        return sel in tops ? framed(tops[sel], 64, under) : undefined;
      },
      // "Try to fool it" ends at 11520, below the foot of Fraud checks' own frame.
      foot: (sel, f) => (sel === "#checks [data-try-cta]" ? 11520 - f * 900 : 0),
      past: (sel) => (sel === "#checks [data-try-cta]" ? 11520 - 64 : 0),
      // Results, framed clean: For companies' heading (12530) kept just under the screen's foot.
      fit: (y, frame) => (y === framed(11940, 64, LINE) && frame?.before === "#companies header" ? 12530 - 900 : y),
    };
    const ys = STOPS.map((s) => s.at(real)).filter((y) => typeof y === "number");
    // Every stop but the phone sequence's, which this laid-out laptop page doesn't have.
    expect(ys).toHaveLength(STOPS.length - 1);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    // Results: its heading on the top line, For companies' heading kept under the screen's foot.
    const results = STOPS.find((s) => s.name === "Results")!;
    expect(results.at(real)).toBe(12530 - 900);
    // A screen so tall that Fraud checks' own stop shows "Try to fool it" whole has no stop at the rule: it would only
    // bring Results up under it.
    const rule = STOPS.find((s) => s.name === "Fraud checks, the rule")!;
    expect(rule.at(real)).toBe(framed(11050, 64, -1));
    expect(rule.at({ ...real, foot: (sel, f) => (sel === "#checks [data-try-cta]" ? 11200 - f * 1440 : 0) })).toBeUndefined();
    // A shorter screen, the same.
    expect(results.at({ ...real, size: { width: 1440, height: 800 }, fit: (y, frame) => (y === framed(11940, 64, LINE) && frame?.before === "#companies header" ? 12530 - 800 : y) })).toBe(12530 - 800);
  });

  it("keeps Results' heading below the foot of Fraud checks' rule frame", () => {
    const rule = STOPS.find((s) => s.name === "Fraud checks, the rule")!;
    const tops: Record<string, number> = { "#checks header": 10514, "#checks ol > li:nth-child(1)": 10600, "#checks ol > li:nth-child(3)": 11050 };
    const frames: unknown[] = [];
    const real: Page = {
      ...page,
      line: (sel, under = LINE) => (sel in tops ? framed(tops[sel], 64, under) : undefined),
      // Fraud checks ends at 11700, "Try to fool it" at 11520.
      foot: (sel, f) => (sel === "#checks" ? 11700 - f * 900 : sel === "#checks [data-try-cta]" ? 11520 - f * 900 : 0),
      fit: (y, frame) => (frames.push(frame), y === undefined ? y : Math.min(frame?.max ?? Infinity, y)),
    };
    // 1440x900 and 1440x800: check 3 on the top line, no higher than check 1, Results' heading kept below the fold.
    expect(rule.at(real)).toBe(framed(11050, 64, -1));
    expect(frames.at(-1)).toMatchObject({ min: framed(10600, 64, -1), before: "#proof header" });
    rule.at({ ...real, size: { width: 1440, height: 800 } });
    expect(frames.at(-1)).toMatchObject({ before: "#proof header" });
  });

  it("takes the phone sequence's own paging stops where it pins", () => {
    const phone = STOPS.find((s) => s.name === "Chain of Custody, phone")!;
    expect(phone.at({ ...page, beats: (sel) => (sel.includes("data-scroll-stops") ? [700, 1400] : undefined) })).toEqual([700, 1400]);
    expect(phone.at(page)).toBeUndefined();
  });
});
