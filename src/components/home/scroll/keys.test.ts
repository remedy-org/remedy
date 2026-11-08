import { describe, expect, it } from "vitest";
import { keyStop, pageDirection } from "./keys";

// 1440x900: the hero, chapter 01, the console beat, the sheet open, its loop closed, Fraud checks, Results.
const STOPS = [0, 1681, 7166, 8456, 9012, 10300, 11300];
const PIN = [64, 7300] as const;
const SHEET = [8000, 9400] as const;
const REACH = 1.25 * 900;

describe("keyboard paging on the wheel's stops", () => {
  it("reads Space, Shift+Space, Page Down and Page Up, and nothing else", () => {
    expect(pageDirection({ key: "PageDown", shiftKey: false })).toBe(1);
    expect(pageDirection({ key: "PageUp", shiftKey: false })).toBe(-1);
    expect(pageDirection({ key: " ", shiftKey: false })).toBe(1);
    expect(pageDirection({ key: " ", shiftKey: true })).toBe(-1);
    expect(pageDirection({ key: "ArrowDown", shiftKey: false })).toBe(0);
  });

  it("goes to the next stop when it is near, from on a stop or between two", () => {
    expect(keyStop(STOPS, 10300, 1, REACH)).toBe(11300);
    expect(keyStop(STOPS, 10000, 1, REACH)).toBe(10300);
    expect(keyStop(STOPS, 11300, -1, REACH)).toBe(10300);
  });

  it("treats a stop within a few px as where the page already is", () => {
    expect(keyStop(STOPS, 10302, 1, REACH)).toBe(11300);
    expect(keyStop(STOPS, 10298, -1, REACH, [SHEET])).toBe(9012);
  });

  it("leaves a far stop to the browser's own paging, outside a pin", () => {
    expect(keyStop([0, 3000], 0, 1, REACH)).toBeNull();
    expect(keyStop(STOPS, 11300, 1, REACH)).toBeNull();
  });

  it("takes the page any distance inside a pin, and out of it onto the next stop: the dolly, and the console to the sheet", () => {
    const pins = [PIN, SHEET];
    expect(keyStop(STOPS, 0, 1, REACH, pins)).toBe(1681);
    expect(keyStop(STOPS, 7166, 1, REACH, pins)).toBe(8456);
    expect(keyStop(STOPS, 8456, -1, REACH, pins)).toBe(7166);
    expect(keyStop(STOPS, 9012, 1, REACH, pins)).toBe(10300);
  });
});
