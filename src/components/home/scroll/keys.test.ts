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
      vi.stubGlobal("addEventListener", (type: string, fn: (e: KeyboardEvent) => void) => { if (type === "keydown") listeners.push(fn); });
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
      vi.stubGlobal("addEventListener", (type: string, fn: (e: KeyboardEvent) => void) => { if (type === "keydown") listeners.push(fn); });
      attachKeys({ isStopped: false, animatedScroll: 2534, scrollTo: (to: number) => went.push(to) } as never, () => ({ stops: STOPS_ }), () => [[64, 6912]]);
      listeners.forEach((fn) => fn({ key: "PageDown", shiftKey: false, target: null, defaultPrevented: false, preventDefault() {} } as unknown as KeyboardEvent));
      expect(went).toEqual([4278]);
    });
  });
});

describe("readable story key paging", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function pager(at = 0) {
    let clock = 1000;
    const listeners = new Map<string, ((e: KeyboardEvent) => void)[]>();
    class Widget {
      closest(selector: string) { return selector.includes("treegrid") ? this : null; }
    }
    vi.stubGlobal("Element", Widget);
    vi.stubGlobal("innerHeight", 900);
    vi.stubGlobal("scrollY", at);
    vi.stubGlobal("addEventListener", (type: string, fn: (e: KeyboardEvent) => void) => listeners.set(type, [...(listeners.get(type) ?? []), fn]));
    vi.stubGlobal("removeEventListener", () => {});
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const went: number[] = [];
    let current: { to: number; onComplete?: () => void } | null = null;
    const lenis = {
      isStopped: false,
      animatedScroll: at,
      cancellations: 0,
      scrollTo(to: number, options: { onComplete?: () => void }) { went.push(to); current = { to, onComplete: options.onComplete }; },
      stop() { this.cancellations++; this.isStopped = true; current = null; },
      start() { this.isStopped = false; },
    };
    attachKeys(lenis as never, () => ({ stops: [0, 1000, 2000, 3000, 4000, 5000, 6000] }), () => [[0, 3000]]);
    const press = (key: string, repeat = false, target: unknown = null) => {
      let prevented = false;
      const event = { key, repeat, target, shiftKey: false, defaultPrevented: false, preventDefault() { prevented = true; } };
      listeners.get("keydown")?.forEach((fn) => fn(event as unknown as KeyboardEvent));
      return prevented;
    };
    const position = (y: number) => { lenis.animatedScroll = y; vi.stubGlobal("scrollY", y); };
    const finish = () => {
      if (!current) return;
      position(current.to);
      clock += 3000;
      current.onComplete?.();
      current = null;
    };
    return { lenis, went, press, position, finish, Widget, pending: () => current };
  }

  it("keeps PageDown/Space repeats and rapid presses on one beat, requiring a fresh press after completion", () => {
    for (const key of ["PageDown", " "]) {
      const g = pager();
      g.press(key);
      for (let i = 0; i < 8; i++) g.press(key, true);
      g.press(key);
      expect(g.went).toEqual([1000]);
      g.finish();
      g.press(key, true);
      expect(g.went).toEqual([1000]);
      g.press(key);
      expect(g.went).toEqual([1000, 2000]);
    }
  });

  it("cancels an immediate reversal before the first rendered frame and reverses from the actual position mid-glide", () => {
    const immediate = pager();
    immediate.press("PageDown");
    immediate.press("PageUp");
    expect(immediate.lenis.cancellations).toBe(1);
    expect(immediate.pending()).toBeNull();
    const midway = pager(1000);
    midway.press("PageDown");
    midway.position(1300);
    midway.press("PageUp");
    expect(midway.lenis.cancellations).toBe(1);
    expect(midway.went).toEqual([2000, 1000]);
  });

  it("hands Home, End and widget paging back without an old story glide overriding them", () => {
    for (const key of ["Home", "End", "Tab", "ArrowUp"]) {
      const g = pager();
      g.press("PageDown");
      expect(g.press(key)).toBe(false);
      expect(g.pending()).toBeNull();
      expect(g.lenis.cancellations).toBe(1);
    }
    const widget = pager();
    widget.press("PageDown");
    expect(widget.press("PageDown", false, new widget.Widget())).toBe(false);
    expect(widget.pending()).toBeNull();
  });

  it("retains repeated paging outside the pinned story", () => {
    const g = pager(4000);
    g.press("PageDown");
    g.press("PageDown", true);
    expect(g.went).toEqual([5000, 6000]);
  });
});
