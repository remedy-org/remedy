import { describe, expect, it } from "vitest";
import { PAGE_STOPS } from "../custody/CustodyStage";
import { ANCHOR_AT, REST, SECTION_VH, T } from "../problemTimeline";
import { ANCHORED, framed, LINE, MERGE, nearestClean, STOPS, tidy, type Page } from "./stops";

/** A stand-in page at 1440x900: the runway at 64 with 7316px of travel, the Problem sheet's top at 8280. */
const page: Page = {
  top: () => 0,
  beat: (f) => 64 + f * 7316,
  sheet: (t) => 8280 - 900 + (t / 100) * 900,
  line: (_, under = LINE) => framed(10000, 64, under),
  past: () => 0,
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
    const custody = STOPS.filter((s) => s.name.startsWith("Chain of Custody")).map((s) => s.at(page));
    expect(custody).toEqual(PAGE_STOPS.slice(1).map((f) => 64 + f * 7316));
    expect(custody).toHaveLength(10); // 01, 02, the exhibit's seven beats, the console
  });

  it("lands the Problem sheet open where the nav's Problem does, then on the closed loop, then cut and paid off", () => {
    const sheet = STOPS.filter((s) => s.name.startsWith("Problem")).map((s) => s.at(page)!);
    // Where the nav's Problem lands (t = ANCHOR_AT, the section's top 20vh above the nav line), a hair before card 4.
    expect(8280 + 0.2 * 900 - sheet[0]).toBeGreaterThan(1);
    expect(8280 + 0.2 * 900 - sheet[0]).toBeLessThan(5);
    expect(ANCHOR_AT).toBeLessThanOrEqual(T.card4[0]);
    // The loop closed: after the sources print, a hair before the slash.
    expect(sheet[1]).toBeGreaterThan(page.sheet(T.sources[1] - 1)!);
    expect(sheet[1]).toBeLessThan(page.sheet(T.mark[0])!);
    // The cut stop rests past every beat and before Fraud checks starts to cover the sheet.
    expect(sheet[2]).toBeGreaterThan(page.sheet(REST)!);
    expect(sheet[2]).toBeLessThan(page.sheet(T.cover[0])!);
    expect(T.cover[1]).toBe(SECTION_VH);
  });

  it("names every stop once, and every anchored section's stop exists", () => {
    const names = STOPS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of Object.values(ANCHORED)) expect(names).toContain(name);
  });

  it("lists the stops top to bottom on a laid-out page", () => {
    const real: Page = {
      ...page,
      line: (sel, under = LINE) => {
        const tops: Record<string, number> = {
          "#checks header": 10514,
          "#checks ol > li:nth-child(3)": 11050,
          "#proof header": 11940,
          "#companies [data-tour]": 12687,
        };
        return sel in tops ? framed(tops[sel], 64, under) : undefined;
      },
      // Results, framed clean: For companies' heading (12530) kept just under the screen's foot.
      fit: (y, frame) => (y === framed(11940, 64, LINE) && frame?.before === "#companies header" ? 12530 - 900 : y),
    };
    const ys = STOPS.map((s) => s.at(real)).filter((y) => y !== undefined);
    expect(ys).toHaveLength(STOPS.length);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    // Results keeps For companies below the fold: its heading sits under the screen's foot.
    expect(STOPS.find((s) => s.name === "Results")!.at(real)).toBe(12530 - 900);
  });
});
