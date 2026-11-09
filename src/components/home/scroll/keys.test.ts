import { afterEach, describe, expect, it, vi } from "vitest";
import { attachKeys, keyStop, pageDirection } from "./keys";

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

  describe("in the exhibit", () => {
    afterEach(() => vi.unstubAllGlobals());

    // 1440x900: check 3 (acct) is the wheel's one stop among the exhibit's five checks; the rests add the other four at
    // their holds (live, fp, code, torn).
    const STOPS_ = [0, 823, 1858, 2534, 4278, 6140, 6698];
    const HOLDS = [3067, 3691, 4972, 5653];
    const RESTS = [...STOPS_, ...HOLDS].sort((a, b) => a - b);

    /** Presses `key` from `at` `n` times, each glide finished before the next press; returns where each one went. */
    function press(at: number, key: string, n: number, shiftKey = false) {
      const listeners: ((e: KeyboardEvent) => void)[] = [];
      vi.stubGlobal("Element", class {});
      vi.stubGlobal("innerHeight", 900);
      vi.stubGlobal("scrollY", at);
      vi.stubGlobal("addEventListener", (_: string, fn: (e: KeyboardEvent) => void) => listeners.push(fn));
      vi.stubGlobal("removeEventListener", () => {});
      const went: number[] = [];
      const lenis = {
        isStopped: false,
        animatedScroll: at,
        scrollTo(to: number) {
          went.push(to);
          this.animatedScroll = to;
          vi.stubGlobal("scrollY", to);
        },
      };
      attachKeys(lenis as never, () => ({ stops: STOPS_, rests: RESTS }), () => [[64, 6912]]);
      let clock = 1000;
      vi.spyOn(performance, "now").mockImplementation(() => (clock += 2000));
      for (let i = 0; i < n; i++) listeners.forEach((fn) => fn({ key, shiftKey, target: null, defaultPrevented: false, preventDefault() {} } as unknown as KeyboardEvent));
      vi.restoreAllMocks();
      return went;
    }

    it("stops Page Down and Space on every check at its hold, not only on check 3", () => {
      expect(press(2534, "PageDown", 6)).toEqual([3067, 3691, 4278, 4972, 5653, 6140]);
      expect(press(2534, " ", 2)).toEqual([3067, 3691]);
    });

    it("stops Page Up and Shift+Space on them going up as well", () => {
      expect(press(6140, "PageUp", 6)).toEqual([5653, 4972, 4278, 3691, 3067, 2534]);
      expect(press(4278, " ", 2, true)).toEqual([3691, 3067]);
    });

    it("keeps to the wheel's stops when the course lists no finished beats besides them", () => {
      const went: number[] = [];
      const listeners: ((e: KeyboardEvent) => void)[] = [];
      vi.stubGlobal("Element", class {});
      vi.stubGlobal("innerHeight", 900);
      vi.stubGlobal("scrollY", 2534);
      vi.stubGlobal("addEventListener", (_: string, fn: (e: KeyboardEvent) => void) => listeners.push(fn));
      attachKeys({ isStopped: false, animatedScroll: 2534, scrollTo: (to: number) => went.push(to) } as never, () => ({ stops: STOPS_ }), () => [[64, 6912]]);
      listeners.forEach((fn) => fn({ key: "PageDown", shiftKey: false, target: null, defaultPrevented: false, preventDefault() {} } as unknown as KeyboardEvent));
      expect(went).toEqual([4278]);
    });
  });
});
