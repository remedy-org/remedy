import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGate, notchQuiet, type Course, type GateLenis } from "./gate";
import { storyFrom } from "./stops";
import type { Slow } from "./landing";

// The gate against a stand-in Lenis: wheel streams in, which events it takes, and where it lands the page.
const STOPS = [0, 1410, 2144, 2821, 3205];

function setup(at = 1410, stops = STOPS, slow: Slow[] = [], up?: number[], inner?: number[], pins?: [number, number][], fit?: Course["fit"], rests?: number[], stories?: [number, number][], unfolds?: [number, number, number][]) {
  const listeners = new Map<string, ((e: unknown) => void)[]>();
  vi.stubGlobal("innerHeight", 900);
  vi.stubGlobal("scrollY", at);
  vi.stubGlobal("addEventListener", (type: string, fn: (e: unknown) => void) => listeners.set(type, [...(listeners.get(type) ?? []), fn]));
  vi.stubGlobal("removeEventListener", () => {});
  let onScroll = () => {};
  const lenis = {
    animatedScroll: at,
    targetScroll: at,
    velocity: 0,
    isScrolling: false as false | "smooth" | "native",
    isStopped: false,
    landed: [] as number[],
    stops: 0,
    easing: null as ((t: number) => number) | null,
    duration: 0,
    complete: null as (() => void) | null,
    scrollTo(to: number, o: { duration: number; easing: (t: number) => number; onComplete: () => void }) {
      this.landed.push(to);
      this.easing = o.easing;
      this.duration = o.duration;
      this.complete = o.onComplete;
      this.isScrolling = "smooth";
    },
    on: (_: string, fn: () => void) => {
      onScroll = fn;
      return () => {};
    },
    stop() {
      this.stops++;
    },
    start() {},
  };
  const gate = createGate(() => ({ stops, slow, up, inner, pins, fit, rests, stories, unfolds }));
  gate.attach(lenis as unknown as GateLenis);
  let t = 1000;
  /** Sends deltas `gap` ms apart, after `pause` ms; returns how many px reached Lenis (the events the gate let through). */
  const send = (deltas: number[], gap = 16, pause = 0, extra: Partial<WheelEvent> = {}) => {
    t += pause;
    let through = 0;
    for (const dy of deltas) {
      t += gap;
      const event = { type: "wheel", timeStamp: t, ctrlKey: false, shiftKey: false, cancelable: true, preventDefault() {}, composedPath: () => [], ...extra };
      if (gate.wheel({ deltaX: 0, deltaY: dy, event: event as never }) !== false) {
        through += dy;
        lenis.targetScroll += dy;
      }
    }
    return through;
  };
  /** The landing in flight reaches its stop. */
  const finish = () => {
    const to = lenis.landed.at(-1) ?? lenis.animatedScroll;
    lenis.animatedScroll = lenis.targetScroll = to;
    lenis.isScrolling = false;
    vi.stubGlobal("scrollY", to);
    lenis.complete?.();
    onScroll();
  };
  const fire = (type: string, e: unknown = {}) => listeners.get(type)?.forEach((fn) => fn(e));
  return { lenis, send, finish, fire, scroll: () => onScroll() };
}

const power = (dir = 1) => Array(40).fill(120 * dir);
/** A trackpad's power fling: as fast, in fractional px. */
const swipe = (dir = 1) => Array(40).fill(119.5 * dir);

/** A trackpad fling: ramps to 140 px an event, then momentum decaying by 0.955 an event. */
function trackpad() {
  const d: number[] = [];
  for (let i = 1; i <= 8; i++) d.push(Math.round((140 * i) / 8));
  for (let v = 140 * 0.955; v >= 0.5; v *= 0.955) d.push(Math.max(1, Math.round(v)));
  return d;
}

describe("wheel stops", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("lands a power fling on the next stop and absorbs the rest of it", () => {
    const { lenis, send } = setup();
    const through = send(power(), 8);
    expect(lenis.landed).toEqual([2144]);
    expect(through).toBeLessThan(400); // only the first events, before the fling read as fast
  });

  it("absorbs a trackpad's whole momentum tail, even when it stalls and resumes", () => {
    const { lenis, send } = setup();
    const d = trackpad();
    const through = send(d.slice(0, 45)) + send(d.slice(45), 16, 220);
    expect(lenis.landed).toEqual([2144]);
    expect(through).toBeLessThan(400);
  });

  it("holds through merged events: a merged event is a bigger delta, not a faster hand", () => {
    const { lenis, send } = setup(0);
    // A power fling, every third event merged with the next one by a long frame.
    let through = 0;
    for (let i = 0; i < 40; i++) through += i % 3 === 2 ? send([240], 16) : send([120], 8);
    // Then a trackpad tail, merged in pairs.
    for (let v = 12; v > 1; v *= 0.95) through += send([2 * v], 32);
    expect(lenis.landed).toEqual([1410]);
    expect(through).toBeLessThan(400);
  });

  it("takes a second fling after a pause on to the next stop", () => {
    const { lenis, send, finish } = setup();
    send(power(), 8);
    finish();
    send(power(), 8, 200);
    expect(lenis.landed).toEqual([2144, 2821]);
  });

  it("chains a fresh fling that arrives mid-landing on to the stop after, from the stop being landed on", () => {
    const { lenis, send } = setup();
    send(power(), 8);
    lenis.animatedScroll = 1800; // part way there
    send(power(), 8, 200);
    expect(lenis.landed).toEqual([2144, 2821]);
  });

  it("lets slow scrolling through untouched, across stops", () => {
    const { lenis, send } = setup(1300);
    expect(send(Array(20).fill(100), 200)).toBe(2000);
    expect(send(Array(150).fill(14), 16)).toBe(2100);
    expect(lenis.landed).toEqual([]);
  });

  it("lets a quick flick that would not carry halfway to a far stop run free", () => {
    const { lenis, send } = setup(0, [0, 1600]);
    expect(send([100, 100, 100], 8)).toBe(300);
    expect(lenis.landed).toEqual([]);
  });

  it("goes past a stop the reader is already at", () => {
    const { lenis, send } = setup(1300);
    send(power(), 8);
    expect(lenis.landed).toEqual([2144]);
  });

  it("hands a reversal straight back, and a fast one lands on the stop behind", () => {
    const { lenis, send } = setup();
    send(power(), 8);
    lenis.animatedScroll = lenis.targetScroll = 1900;
    expect(send([-30, -30, -30], 16)).toBe(-90);
    send(power(-1), 8, 200);
    expect(lenis.landed).toEqual([2144, 1410]);
  });

  it("ignores shift-wheel and pinch-zoom", () => {
    const { lenis, send } = setup();
    send(power(), 8, 0, { shiftKey: true });
    send(power(), 8, 200, { ctrlKey: true });
    expect(lenis.landed).toEqual([]);
  });

  it("gives a landing up to a scroll key or Tab, never to a modifier", () => {
    const { lenis, send, fire } = setup();
    send(power(), 8);
    fire("keydown", { key: "Shift" });
    expect(lenis.stops).toBe(0);
    fire("keydown", { key: "Tab" });
    expect(lenis.stops).toBe(1);
    // The hold went with it: the hand's next move is its own.
    expect(send([20, 20], 16, 30)).toBe(40);
  });

  it("gives a landing up to a native scroll that moved the page (find-in-page, a focus move)", () => {
    const { lenis, send, fire } = setup();
    send(power(), 8);
    lenis.animatedScroll = 1700;
    vi.stubGlobal("scrollY", 1700.5);
    fire("scroll");
    expect(lenis.stops).toBe(0); // Lenis's own frame
    vi.stubGlobal("scrollY", 5200);
    fire("scroll");
    expect(lenis.stops).toBe(1);
  });

  it("keeps the hold through Lenis's own echo at the end of a landing", () => {
    const { lenis, send, finish, scroll } = setup();
    const d = trackpad();
    send(d.slice(0, 30));
    finish();
    lenis.isScrolling = "native"; // the echo: native, but it did not move the page
    lenis.velocity = 0;
    scroll();
    expect(send(d.slice(30))).toBe(0);
    expect(lenis.landed).toEqual([2144]);
  });

  it("enters the glide at the page's own speed", () => {
    const { lenis, send } = setup();
    send(power(), 8);
    const e = lenis.easing!;
    // The page was 480 px short of Lenis's target when the fling was taken: its next step is that times 1 - e^-0.1.
    const h = 1e-4;
    expect(e(h) / h).toBeGreaterThan(1);
    expect(e(1)).toBeCloseTo(1, 9);
  });

  it("gives a slow stretch on the way more of the landing, and enters it at the page's speed all the same", () => {
    const plain = setup(0);
    plain.send(swipe(), 8);
    // A slow stretch that isn't the dolly (the dolly's landing is held to DOLLY_TIME: tested below); it adds SLOW_TIME
    // to the landing, and the curves still compare.
    const slowed = setup(0, STOPS, [[207, 670, 4]]);
    slowed.send(swipe(), 8);
    const e0 = plain.lenis.easing!;
    const e1 = slowed.lenis.easing!;
    // Both land on 01, and from rest they start alike.
    expect(slowed.lenis.landed).toEqual([1410]);
    expect(e1(1)).toBeCloseTo(1, 9);
    expect(e1(1e-4) / 1e-4).toBeCloseTo(e0(1e-4) / 1e-4, 0);
    // Crossing the dolly takes longer than it did.
    const time = (e: (t: number) => number, y: number) => {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 40; i++) {
        const m = (lo + hi) / 2;
        if (e(m) * 1410 < y) lo = m;
        else hi = m;
      }
      return lo;
    };
    expect(time(e1, 492) - time(e1, 207)).toBeGreaterThan(1.8 * (time(e0, 492) - time(e0, 207)));
  });

  it("lands across the hero's dolly in 1.2 s at most, so the page is at rest soon after the dolly has played", () => {
    const pad = setup(0, STOPS, [[207, 670, 5]]);
    pad.send(swipe(), 8);
    expect(pad.lenis.landed).toEqual([1410]);
    expect(pad.lenis.duration).toBeLessThanOrEqual(1.2);
  });

  it("keeps a notched wheel's landing short, shortest across the hero's dolly, and crosses the dolly lighter", () => {
    const wheel = setup(2144);
    wheel.send(power(), 8);
    expect(wheel.lenis.landed).toEqual([2821]);
    expect(wheel.lenis.duration).toBeLessThanOrEqual(0.9);
    const pad = setup(2144);
    pad.send(swipe(), 8);
    expect(pad.lenis.duration).toBeGreaterThan(wheel.lenis.duration);
    // Across the dolly: 0.75 s, shorter than a trackpad's, so a wheel spun hard from the top never feels the page resist,
    // and a lighter weight than a trackpad's.
    const notched = setup(0, STOPS, [[207, 670, 5]]);
    notched.send(power(), 8);
    const flung = setup(0, STOPS, [[207, 670, 5]]);
    flung.send(swipe(), 8);
    expect(notched.lenis.landed).toEqual([1410]);
    expect(notched.lenis.duration).toBeLessThanOrEqual(0.75);
    expect(notched.lenis.duration).toBeLessThan(flung.lenis.duration);
    // The share of the landing spent on the dolly.
    const share = (e: (t: number) => number) => {
      const at = (y: number) => {
        let lo = 0;
        let hi = 1;
        for (let i = 0; i < 40; i++) {
          const m = (lo + hi) / 2;
          if (e(m) * 1410 < y) lo = m;
          else hi = m;
        }
        return lo;
      };
      return at(670) - at(207);
    };
    expect(share(notched.lenis.easing!)).toBeLessThan(share(flung.lenis.easing!));
  });

  it("lets a notched wheel spun hard from the top run free within half a second, while its first landing still plays", () => {
    const { lenis, send } = setup(0);
    // 100px notches 14 ms apart: the first 0.42 s is taken to 01 and held; by 0.56 s the spin goes with the wheel.
    send(Array(30).fill(100), 14);
    expect(lenis.landed).toEqual([1410]);
    expect(send(Array(10).fill(100), 14)).toBeGreaterThanOrEqual(500);
  });

  it("hands a wheel spun on hard after its landing back to the reader, rather than holding the page", () => {
    const { lenis, send, finish } = setup();
    send(power(), 8);
    finish();
    // The same gesture, no pause: still fast 300 ms after the landing finished. It scrolls on freely.
    expect(send(Array(40).fill(120), 8)).toBeGreaterThan(0);
    expect(lenis.landed).toEqual([2144]);
  });

  it("lets a wheel spun on hard after its landing run free for the rest of the gesture, and stops it again after a pause", () => {
    const { lenis, send, finish } = setup(0);
    send(power(), 8);
    finish();
    // Still spinning at the same pace once it has landed: the page goes with the wheel.
    expect(send(Array(80).fill(120), 8)).toBeGreaterThan(0);
    expect(lenis.landed).toEqual([1410]);
    // A new gesture after a pause meets the stops again.
    lenis.animatedScroll = lenis.targetScroll = 2300;
    send(power(), 8, 600);
    expect(lenis.landed).toEqual([1410, 2821]);
  });

  it("takes three quick flicks of a notched wheel to three stops: a re-grip under QUIET is a new gesture", () => {
    const { lenis, send } = setup(0);
    const flick = Array(6).fill(100);
    send(flick, 20);
    lenis.animatedScroll = 900;
    send(flick, 20, 90);
    lenis.animatedScroll = 1900;
    send(flick, 20, 90);
    expect(lenis.landed).toEqual([1410, 2144, 2821]);
  });

  it("ends a notched wheel's gesture after 60 to 80 ms without a notch: 1.5 times its usual gap, 80 before it has one", () => {
    expect(notchQuiet([])).toBe(80);
    expect(notchQuiet([16, 20, 18])).toBe(60);
    expect(notchQuiet([44, 46, 48])).toBe(69);
    expect(notchQuiet([45, 60, 70, 300])).toBe(80);
  });

  it("takes each of three quick flicks to a stop of its own, whatever their pace, never throwing one away", () => {
    const course = [0, 1000, 2000, 3000, 4000, 5000];
    for (const dt of [12, 24, 40])
      for (const quiet of [60, 80]) {
        const { lenis, send, finish } = setup(0, course);
        const flick = Array(4).fill(100);
        send(flick, dt);
        send(flick, dt, quiet - dt);
        send(flick, dt, quiet - dt);
        expect(lenis.landed, `${dt} ms notches, ${quiet} ms apart`).toEqual([1000, 2000, 3000]);
        finish();
      }
  });

  it("heads on to the next stop when a fresh flick comes mid-landing, however far that stop and however short the flick", () => {
    // The landing on 1000 has all but finished: the next stop, 1400px on, is far more than a flick would carry alone.
    const { lenis, send } = setup(0, [0, 1000, 2400]);
    send(Array(4).fill(100), 20);
    lenis.animatedScroll = 990;
    send(Array(2).fill(100), 20, 200);
    expect(lenis.landed).toEqual([1000, 2400]);
  });

  it("lets a fresh flick mid-landing run on when there is no stop ahead within reach, rather than drop it", () => {
    const { lenis, send } = setup(0, [0, 1000, 4000]);
    send(Array(4).fill(100), 20);
    lenis.animatedScroll = 990;
    expect(send(Array(4).fill(100), 20, 200)).toBeGreaterThan(0);
    expect(lenis.landed).toEqual([1000]);
  });

  it("lands a short flick that would come to rest inside a pinned story, rather than leave a transition half played", () => {
    const flick = Array(4).fill(100);
    const open = setup(1000, [0, 1000, 2600]);
    open.send(flick, 16);
    expect(open.lenis.landed).toEqual([]);
    // The story's scrub begins 100px on: a free run would stop inside it.
    const lead = setup(1000, [0, 1000, 2600], [], undefined, undefined, [[1100, 2600]]);
    lead.send(flick, 16);
    expect(lead.lenis.landed).toEqual([2600]);
  });

  it("brings a free spin that stops inside a pinned story to rest on its next beat, however far, never half played", () => {
    for (const pins of [[], [[900, 5000]]] as [number, number][][]) {
      const { lenis, send, scroll } = setup(0, [0, 1000, 2400, 5000], [], undefined, undefined, pins);
      send(Array(80).fill(100), 14);
      // The hand has stopped with the page bound for 3700, 1300px short of the next stop.
      lenis.targetScroll = 3700;
      lenis.animatedScroll = 3600;
      const now = performance.now() + 1000;
      vi.spyOn(performance, "now").mockReturnValue(now);
      scroll();
      vi.restoreAllMocks();
      expect(lenis.landed.at(-1)).toBe(pins.length ? 5000 : 1000);
    }
  });

  /** A free spin from the top whose hand stops with the page at `at`, bound for `rest`: where it comes to rest. */
  function spinTo(stops: number[], at: number, rest: number, fit?: Course["fit"]) {
    const { lenis, send, scroll } = setup(0, stops, [], undefined, undefined, [], fit);
    send(Array(80).fill(100), 14);
    lenis.targetScroll = rest;
    lenis.animatedScroll = at;
    const now = performance.now() + 1000;
    vi.spyOn(performance, "now").mockReturnValue(now);
    scroll();
    vi.restoreAllMocks();
    return lenis.landed.at(-1);
  }

  it("brings a free spin bound just past a stop back onto it when the stop ahead is farther, never leaving it off by a line", () => {
    // Stops about a window apart, as below the Problem sheet: bound 250px past 2000, 750px short of 3000.
    expect(spinTo([0, 1000, 2000, 3000], 2150, 2250)).toBe(2000);
    // Nearer the stop ahead, it goes on to it.
    expect(spinTo([0, 1000, 2000, 3000], 2150, 2600)).toBe(3000);
    // Going up, the same (its first landing is on 2000): bound 200px above 1000, 800px short of 0.
    const { lenis, send, scroll } = setup(3000, [0, 1000, 2000, 3000]);
    send(Array(80).fill(-100), 14);
    expect(lenis.landed).toEqual([2000]);
    lenis.targetScroll = 800;
    lenis.animatedScroll = 900;
    vi.spyOn(performance, "now").mockReturnValue(performance.now() + 1000);
    scroll();
    vi.restoreAllMocks();
    expect(lenis.landed.at(-1)).toBe(1000);
  });

  it("brings a free spin with no stop near to rest on the nearest clean frame within 120px, so no line is cut", () => {
    const fit = vi.fn((y: number, r: { min: number; max: number }) => Math.min(r.max, Math.max(r.min, 3760)));
    // Bound for 3700: 1300px past 2400, 1300px short of 5000.
    expect(spinTo([0, 1000, 2400, 5000], 3600, 3700, fit)).toBe(3760);
    expect(fit).toHaveBeenCalledWith(3700, { min: 3580, max: 3820 });
    // Already clean where it rests: no landing.
    expect(spinTo([0, 1000, 2400, 5000], 3600, 3700, (y) => y)).toBe(1000);
  });

  it("takes every quick flick of a notched wheel to a stop within 1.25 windows, however short, rather than now and then run free", () => {
    // Stops about a window apart, as below the Problem sheet: three notches carry a third of the way.
    const course = [0, 1000, 2050, 3100];
    for (const [at, to] of [
      [1000, 2050],
      [2050, 3100],
    ]) {
      const { lenis, send } = setup(at, course);
      send([100, 100, 100], 24);
      expect(lenis.landed).toEqual([to]);
    }
    const up = setup(2050, course);
    up.send([-100, -100, -100], 24);
    expect(up.lenis.landed).toEqual([1000]);
    // A trackpad's short flick still runs free.
    const pad = setup(1000, course);
    pad.send([99.5, 99.5, 99.5], 24);
    expect(pad.lenis.landed).toEqual([]);
  });

  it("lets a wheel held at speed run free at once, the landing or not, and keeps it free over a short pause", () => {
    const { lenis, send } = setup(0);
    // 150 notches over 3 s: one stop is taken at the start, then the spin runs free.
    let through = send(Array(40).fill(100), 20);
    expect(lenis.landed).toEqual([1410]);
    through += send(Array(40).fill(100), 20, 70);
    expect(through).toBeGreaterThan(2000);
    expect(lenis.landed).toEqual([1410]);
  });

  it("carries a hard fling past a story's inner beat while its momentum keeps pouring in, never past a section stop", () => {
    const skim = setup(1410, STOPS, [], undefined, [2144]);
    skim.send(trackpad());
    expect(skim.lenis.landed).toEqual([2144, 2821]);
    const flick = setup(1410, STOPS, [], undefined, [2144]);
    flick.send(trackpad().slice(0, 30).map((d) => Math.round(d / 3)));
    expect(flick.lenis.landed.at(-1)).not.toBe(2821);
    const section = setup(1410, STOPS, [], undefined, []);
    section.send(trackpad());
    expect(section.lenis.landed).toEqual([2144]);
  });

  it("lands any fling inside a pinned story on the story's next beat, however far, so it never rests half played", () => {
    const far = [0, 1000, 3500, 6000];
    // A short flick: outside a story it would not carry halfway and runs free.
    const flick = Array(6).fill(100);
    const open = setup(1000, far);
    open.send(flick, 16);
    expect(open.lenis.landed).toEqual([]);
    const pinned = setup(1000, far, [], undefined, undefined, [[0, 6000]]);
    pinned.send(flick, 16);
    expect(pinned.lenis.landed).toEqual([3500]);
  });

  /** A gentle nudge (deltas `d`, 16 ms apart, well under FAST) from `at`, then the wheel quiet: where the page lands. */
  function nudgeTo(at: number, d: number[], pins: [number, number][], rests?: number[]) {
    const { lenis, send, scroll } = setup(at, [0, 1000, 2600, 4000], [], undefined, undefined, pins, undefined, rests);
    expect(send(d)).toBe(d.reduce((a, b) => a + b, 0)); // the page took all of it as the reader's
    expect(lenis.landed).toEqual([]);
    lenis.animatedScroll = lenis.targetScroll - 4 * Math.sign(d[0]); // Lenis is still easing into it
    vi.spyOn(performance, "now").mockReturnValue(performance.now() + 1000);
    scroll();
    vi.restoreAllMocks();
    return lenis.landed.at(-1);
  }

  it("settles a gentle nudge that goes quiet inside a pinned story on its nearest finished beat, never mid-beat", () => {
    const pins: [number, number][] = [[900, 2600]];
    const gentle = Array(36).fill(8); // a slow drag, 500 px/s, 288px
    // From a beat, a nudge moves the story on to the next one, however far.
    expect(nudgeTo(1000, gentle, pins)).toBe(2600);
    expect(nudgeTo(2600, gentle.map((x) => -x), pins)).toBe(1000);
    // A trackpad's gentlest push (about 36px) moves the story on too; only a tremor under TREMOR springs back.
    expect(nudgeTo(1000, [12, 12, 12], pins)).toBe(2600);
    expect(nudgeTo(2600, [-12, -12, -12], pins)).toBe(1000);
    expect(nudgeTo(1000, [3, 3], pins)).toBe(1000);
    // Begun off a beat, it goes on to the beat ahead in its direction, never back against the hand.
    expect(nudgeTo(1400, gentle, pins)).toBe(2600);
    expect(nudgeTo(1900, gentle, pins)).toBe(2600);
    expect(nudgeTo(1900, gentle.map((x) => -x), pins)).toBe(1000);
    // A finished beat that is no stop (an exhibit check at its hold) is as good a rest.
    expect(nudgeTo(1000, gentle, pins, [0, 1000, 1700, 2600, 4000])).toBe(1700);
    // Bound 3px past a beat the page is easing over: back onto it, not left 3px off.
    expect(nudgeTo(1000, [...Array(100).fill(8), 3], pins, [0, 1000, 1800, 2600, 4000])).toBe(1800);
    // Outside a pinned story slow scrolling stays the reader's.
    expect(nudgeTo(2700, gentle, pins)).toBeUndefined();
    expect(nudgeTo(1000, gentle, [])).toBeUndefined();
  });

  it("moves the story on with every gentle push, from the top and from every beat, and never against the hand", () => {
    const pins: [number, number][] = [[0, 4000]];
    const beats = [0, 1000, 1700, 2600, 4000];
    for (const dir of [1, -1]) {
      for (const from of beats) {
        const next = beats.filter((s) => (s - from) * dir > 0).sort((a, b) => (a - b) * dir)[0];
        if (next === undefined) continue;
        expect(nudgeTo(from, Array(3).fill(12 * dir), pins, beats)).toBe(next);
      }
    }
    // Pushes of 36px from the hero, each from where the last landed: down every time.
    let at = 0;
    for (let i = 0; i < 4; i++) {
      const to = nudgeTo(at, [12, 12, 12], pins, beats);
      expect(to).toBeGreaterThan(at);
      at = to!;
    }
  });

  it("never glides a gentle push out of a story's first or last beat into the next section: it scrolls 1:1", () => {
    // As 1440x900: the Chain of Custody's story from the hero to its console beat, the Problem sheet's from open to cut,
    // Fraud checks 1324px past the cut. Pushes of 36, 60 and 100px from the console beat down, the open sheet up and the
    // cut down glided about 1.4 windows into the next section; now each rests where the hand left it.
    const course = [0, 6698, 7988, 8586, 9910];
    const pins: [number, number][] = [
      [64, 6912],
      [6912, 9918],
    ];
    const stories: [number, number][] = [
      [0, 6698],
      [7988, 8586],
    ];
    const slow: Slow[] = [[7400, 7900, 2]];
    for (const [from, dir] of [
      [6698, 1],
      [7988, -1],
      [8586, 1],
      [9910, -1],
    ] as const) {
      for (const px of [36, 60, 100]) {
        const g = setup(from, course, slow, undefined, undefined, pins, undefined, undefined, stories);
        g.send(Array(6).fill((dir * px) / 6));
        g.lenis.animatedScroll = g.lenis.targetScroll - 4 * dir;
        vi.spyOn(performance, "now").mockReturnValue(performance.now() + 1000);
        g.scroll();
        vi.restoreAllMocks();
        expect(g.lenis.landed, `${dir > 0 ? "down" : "up"} ${px}px from ${from}`).toEqual([]);
      }
    }
    // Into the story, a push still moves it on a beat: up from the cut onto the open sheet, quickly.
    const up = setup(8586, course, slow, undefined, undefined, pins, undefined, undefined, stories);
    up.send([-12, -12, -12]);
    up.lenis.animatedScroll = up.lenis.targetScroll + 4;
    vi.spyOn(performance, "now").mockReturnValue(performance.now() + 1000);
    up.scroll();
    vi.restoreAllMocks();
    expect(up.lenis.landed).toEqual([7988]);
    expect(up.lenis.duration).toBeGreaterThanOrEqual(0.9);
    expect(up.lenis.duration).toBeLessThanOrEqual(1.1);
    // A fling is no nudge: any one, however short, still lands on the next section's stop, as before.
    const flung = setup(8586, course, slow, undefined, undefined, pins, undefined, undefined, stories);
    flung.send([100, 100, 100], 16);
    expect(flung.lenis.landed).toEqual([9910]);
    // A quick flick of four notches from the console beat lands on the open sheet, never 400px into its entrance.
    const flick = setup(6698, course, slow, undefined, undefined, pins, undefined, undefined, stories);
    flick.send([100, 100, 100, 100], 24);
    expect(flick.lenis.landed).toEqual([7988]);
  });

  it("rests a push out of a story on the clean frame ahead when a line would be cut, never back against the hand", () => {
    // A line cut at the screen's foot from 8640 to 8700: the push of 54px from the cut rests clear of it, ahead.
    const fit: Course["fit"] = (y, { min, max }) => [y, 8700, 8639].filter((v) => v >= min && v <= max && !(v > 8639 && v < 8700)).sort((a, b) => Math.abs(a - y) - Math.abs(b - y))[0];
    const g = setup(8586, [0, 7988, 8586, 9910], [], undefined, undefined, [[6912, 9918]], fit, undefined, [[7988, 8586]]);
    g.send(Array(6).fill(9));
    g.lenis.animatedScroll = g.lenis.targetScroll - 4;
    vi.spyOn(performance, "now").mockReturnValue(performance.now() + 1000);
    g.scroll();
    vi.restoreAllMocks();
    expect(g.lenis.landed).toEqual([8700]);
    expect(g.lenis.duration).toBeLessThanOrEqual(0.8);
  });

  it("takes a 36px push from the hero on to chapter 01, the story starting at the page top", () => {
    // The runway's own top is the nav's height down; its story starts at the hero (stops.ts storyFrom).
    const g = setup(0, [0, 823, 1858], [[100, 700, 5]], undefined, undefined, [[64, 6912]], undefined, undefined, [[storyFrom(64), 6698]]);
    g.send([2, 3, 5, 7, 7, 5, 3, 2, 1, 1]);
    g.lenis.animatedScroll = g.lenis.targetScroll - 4;
    vi.spyOn(performance, "now").mockReturnValue(performance.now() + 1000);
    g.scroll();
    vi.restoreAllMocks();
    expect(g.lenis.landed).toEqual([823]);
    expect(g.lenis.duration).toBeGreaterThanOrEqual(0.9);
    expect(g.lenis.duration).toBeLessThanOrEqual(1.1);
  });

  it("skims a notched power spin past a story's inner beats, three notches a beat, never past a section stop", () => {
    const beats = [0, 823, 1858, 2534, 4278, 6140, 6698];
    const inner = [1858, 2534, 6140];
    const spin = setup(823, beats, [], undefined, inner, [[0, 6698]]);
    spin.send(Array(10).fill(100), 27);
    expect(spin.lenis.landed).toEqual([1858, 2534, 4278]);
    // A quick flick of four notches stops on the inner beat.
    const flick = setup(823, beats, [], undefined, inner, [[0, 6698]]);
    flick.send(Array(4).fill(100), 24);
    expect(flick.lenis.landed).toEqual([1858]);
    // Its landing scales with the way: under a window, about 0.6 s.
    const near = setup(1858, beats, [], undefined, inner, [[0, 6698]]);
    near.send(Array(4).fill(100), 24);
    expect(near.lenis.landed).toEqual([2534]);
    expect(near.lenis.duration).toBeLessThanOrEqual(0.65);
  });

  /**
   * A notched wheel on a clock: `notches` deltas `gap` ms apart, then the wheel quiet for `after` ms, Lenis's frames
   * every 16 ms between them (the page easing 40px behind its target). Returns the landings and where the page was at
   * the last notch.
   */
  function wheelOnClock(
    at: number,
    stops: number[],
    pins: [number, number][],
    flicks: number[][],
    gaps: { inside: number; between: number },
    more: { stories?: [number, number][]; unfolds?: [number, number, number][] } = {},
  ) {
    const g = setup(at, stops, [], undefined, undefined, pins, undefined, undefined, more.stories, more.unfolds);
    let clock = 5000;
    const spy = vi.spyOn(performance, "now").mockImplementation(() => clock);
    const frames = (ms: number) => {
      for (let t = 16; t < ms; t += 16) {
        clock += 16;
        if (!g.lenis.landed.length) g.lenis.animatedScroll = g.lenis.targetScroll - 40 * Math.sign(flicks[0][0]);
        g.scroll();
      }
      clock += ms % 16 || 16;
    };
    let atLast = at;
    let through = 0;
    flicks.forEach((flick, f) => {
      flick.forEach((dy, i) => {
        if (f || i) frames(i ? gaps.inside : gaps.between);
        atLast = g.lenis.animatedScroll;
        through += g.send([dy], i ? gaps.inside : gaps.between);
      });
    });
    frames(600);
    spy.mockRestore();
    return { landed: g.lenis.landed, atLast, through, duration: g.lenis.duration };
  }

  it("brings a slow roll of notches inside a pinned story to rest on the beat nearest where the hand stopped, never on past it", () => {
    // As the Problem sheet at 1920x1080: the sheet open, the loop cut 717px on, Fraud checks 1535px past the cut, all
    // pinned. Ten notches 100 ms apart from the open sheet stop 283px past the cut: the page settles back onto it, rather
    // than glide on to Fraud checks from where the last notch began.
    const course = [0, 1000, 1717, 3252, 4000];
    const pins: [number, number][] = [[0, 3315]];
    for (const gap of [80, 100, 120, 150]) {
      const roll = wheelOnClock(1000, course, pins, [Array(10).fill(100)], { inside: gap, between: gap });
      expect(roll.through, `${gap} ms`).toBe(1000); // every notch is the reader's: nothing settles mid-roll
      expect(roll.landed, `${gap} ms`).toEqual([1717]);
      expect(Math.abs(1717 - roll.atLast), `${gap} ms`).toBeLessThanOrEqual(0.3 * 900);
    }
    // Five notches stop short of the cut: on to it, in the hand's direction.
    expect(wheelOnClock(1000, course, pins, [Array(5).fill(100)], { inside: 100, between: 100 }).landed).toEqual([1717]);
    // Eighteen go nearer Fraud checks than the cut: on to it.
    expect(wheelOnClock(1000, course, pins, [Array(18).fill(100)], { inside: 100, between: 100 }).landed).toEqual([3252]);
    // Going up, the same: ten notches from Fraud checks rest 465px above the cut, nearer it than the open sheet.
    expect(wheelOnClock(3252, course, pins, [Array(10).fill(-100)], { inside: 100, between: 100 }).landed).toEqual([1717]);
  });

  it("settles a slow roll of notches out of a story's last beat within 0.8 s of its settling, however far the beat ahead", () => {
    // As 1920x1080: five notches 100 ms apart from the console beat rest 500px on, the sheet half risen, the open sheet
    // 1549px on. The roll settles once, on the open sheet, and the page is at rest 0.8 s later (it was 1.4 s).
    const course = [0, 8037, 9586, 10303, 11838];
    const pins: [number, number][] = [
      [64, 8294],
      [8294, 10764],
    ];
    const roll = wheelOnClock(8037, course, pins, [Array(5).fill(100)], { inside: 100, between: 100 }, {
      stories: [
        [0, 8037],
        [9586, 10303],
      ],
      unfolds: [[8390, 9374, 9586]],
    });
    expect(roll.landed).toEqual([9586]);
    expect(roll.duration).toBeLessThanOrEqual(0.8);
  });

  // As 1440x900: the Chain of Custody's story from the hero to its console beat (an inner beat at 6140), the Problem
  // sheet's from open to cut, Fraud checks past it; the sheet rises and unfolds from 7002 (its last frame unseen) to 7812
  // (its first lying flat), the open sheet at 7988.
  const SHEET = {
    course: [0, 6140, 6698, 7988, 8586, 9910],
    pins: [
      [64, 6912],
      [6912, 9918],
    ] as [number, number][],
    stories: [
      [0, 6698],
      [7988, 8586],
    ] as [number, number][],
    unfolds: [[7002, 7812, 7988]] as [number, number, number][],
  };

  it("settles a slow roll that began inside a story and ran up to half a window past its last beat back onto that beat", () => {
    // Ten notches from the open sheet ran 402px past the cut and rested there, the held sheet under Fraud checks' edge.
    const { course, pins, stories, unfolds } = SHEET;
    for (const gap of [80, 100, 120, 150]) {
      const down = wheelOnClock(7988, course, pins, [Array(10).fill(100)], { inside: gap, between: gap }, { stories, unfolds });
      expect(down.through, `${gap} ms`).toBe(1000);
      expect(down.landed, `down ${gap} ms`).toEqual([8586]);
      expect(down.duration).toBeLessThanOrEqual(0.8);
      // Up from the cut: 402px past the open sheet, the sheet half unfolded; back onto the open sheet.
      expect(wheelOnClock(8586, course, pins, [Array(10).fill(-100)], { inside: gap, between: gap }, { stories, unfolds }).landed, `up ${gap} ms`).toEqual([7988]);
    }
    // The same through the Chain of Custody: ten notches from its inner beat run 442px past the console beat.
    expect(wheelOnClock(6140, course, pins, [Array(10).fill(100)], { inside: 100, between: 100 }, { stories, unfolds }).landed).toEqual([6698]);
    // A roll begun on the last beat and leaving the story follows the hand: three notches from the cut rest 300px on.
    expect(wheelOnClock(8586, course, pins, [Array(3).fill(100)], { inside: 90, between: 90 }, { stories, unfolds }).landed).toEqual([]);
    // Past half a window, the roll is the reader's: fifteen notches from the open sheet rest 902px past the cut.
    expect(wheelOnClock(7988, course, pins, [Array(15).fill(100)], { inside: 100, between: 100 }, { stories, unfolds }).landed).toEqual([]);
  });

  it("never leaves the Problem sheet half risen or half unfolded: a gesture that goes quiet there goes on to a whole frame", () => {
    const { course, pins, stories, unfolds } = SHEET;
    // Three notches up from the open sheet rested at 7688, the sheet half unfolded: on up to its last frame unseen.
    const up = wheelOnClock(7988, course, pins, [Array(3).fill(-100)], { inside: 90, between: 90 }, { stories, unfolds });
    expect(up.landed).toEqual([7002]);
    expect(up.duration).toBeLessThanOrEqual(0.8);
    // Ten notches down from the console beat rested at 7698: on to the open sheet.
    const down = wheelOnClock(6698, course, pins, [Array(10).fill(100)], { inside: 100, between: 100 }, { stories, unfolds });
    expect(down.landed).toEqual([7988]);
    expect(down.duration).toBeLessThanOrEqual(0.8);
    // Three notches down from the console beat rest at 6998, the sheet still unseen: where the hand left it.
    expect(wheelOnClock(6698, course, pins, [Array(3).fill(100)], { inside: 90, between: 90 }, { stories, unfolds }).landed).toEqual([]);
    // Gentle pushes up from the open sheet rest 1:1 on the sheet lying flat; down from the console beat, 1:1 too.
    for (const [from, dir] of [
      [7988, -1],
      [6698, 1],
    ] as const) {
      for (const px of [36, 60, 100, 150]) {
        const g = setup(from, course, [], undefined, undefined, pins, undefined, undefined, stories, unfolds);
        g.send(Array(6).fill((dir * px) / 6));
        g.lenis.animatedScroll = g.lenis.targetScroll - 4 * dir;
        vi.spyOn(performance, "now").mockReturnValue(performance.now() + 1000);
        g.scroll();
        vi.restoreAllMocks();
        expect(g.lenis.landed, `${px}px from ${from}`).toEqual([]);
      }
    }
    // A tremor from the frame unseen goes back onto it, never on 986px to the open sheet.
    const tremor = setup(7002, course, [], undefined, undefined, pins, undefined, undefined, stories, unfolds);
    tremor.send([2, 2, 1]);
    vi.spyOn(performance, "now").mockReturnValue(performance.now() + 1000);
    tremor.scroll();
    vi.restoreAllMocks();
    expect(tremor.lenis.landed).toEqual([7002]);
  });

  it("still takes three quick flicks of a notched wheel, a pause between them, to three beats", () => {
    const beats = [0, 1000, 2000, 3000, 4000, 5000];
    const pins: [number, number][] = [[0, 5000]];
    for (const [n, inside, between] of [
      [2, 25, 160],
      [2, 15, 150],
      [3, 35, 200],
      [2, 35, 300],
    ]) {
      const { landed } = wheelOnClock(1000, beats, pins, Array(3).fill(Array(n).fill(100)), { inside, between });
      expect(landed, `${n} notches ${inside} ms apart, ${between} ms pauses`).toEqual([2000, 3000, 4000]);
    }
  });

  it("settles a nudge Lenis has finished easing before the wheel is quiet long enough to tell", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { lenis, send } = setup(1000, [0, 1000, 2600], [], undefined, undefined, [[900, 2600]]);
    send(Array(16).fill(18));
    lenis.animatedScroll = lenis.targetScroll;
    vi.spyOn(performance, "now").mockReturnValue(performance.now() + 1000);
    vi.advanceTimersByTime(200);
    vi.restoreAllMocks();
    vi.useRealTimers();
    expect(lenis.landed).toEqual([2600]);
  });

  it("lets a gesture landed on a beat stay there, and leaves a nudge given up to a key alone", () => {
    const pins: [number, number][] = [[0, 4000]];
    const landed = setup(1410, STOPS, [], undefined, undefined, pins);
    landed.send(power(), 8);
    landed.finish();
    vi.spyOn(performance, "now").mockReturnValue(performance.now() + 1000);
    landed.scroll();
    vi.restoreAllMocks();
    expect(landed.lenis.landed).toEqual([2144]);
    const keyed = setup(1000, [0, 1000, 2600], [], undefined, undefined, pins);
    keyed.send([30, 30, 30]);
    keyed.fire("keydown", { key: "ArrowDown" });
    vi.spyOn(performance, "now").mockReturnValue(performance.now() + 1000);
    keyed.scroll();
    vi.restoreAllMocks();
    expect(keyed.lenis.landed).toEqual([]);
  });

  it("goes up on its own stops when the course lists them", () => {
    const { lenis, send } = setup(3205, STOPS, [], [0, 1410, 3205]);
    send(power(-1), 8);
    expect(lenis.landed).toEqual([1410]);
  });

  it("takes a swipe laid on a fading momentum, each window faster than the last, as a fresh fling", () => {
    const { lenis, send, finish } = setup();
    const d = trackpad();
    send(d.slice(0, 30));
    finish();
    // No pause: the momentum is about half its peak, and a new swipe ramps up on top of it.
    send([40, 44, 48, 52, 60, 70, 80, 92, 104, 118, 132, 140, 140, 140, 140, 140, 140, 140]);
    expect(lenis.landed).toEqual([2144, 2821]);
  });

});

// Mac trackpad traces, as the trace harness sends them: a finger phase of n events ramping from 2px to its peak, then a
// momentum tail decaying by f a frame down to 1px, 16 ms apart.
function macSwipe(peak: number, n = 6, f = 0.95) {
  const d: number[] = [];
  for (let i = 0; i < n; i++) d.push(2 + ((peak - 2) * i) / (n - 1));
  for (let v = peak * f; v >= 1; v *= f) d.push(v);
  return [...d, 1, 1];
}
/** A swipe of about `total` px. */
function macSized(total: number, n = 6, f = 0.95) {
  let lo = 1;
  let hi = 400;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (macSwipe(mid, n, f).reduce((a, b) => a + b, 0) < total) lo = mid;
    else hi = mid;
  }
  return macSwipe(lo, n, f);
}
const TINY = () => macSized(90, 5, 0.95);
const SMALL = () => macSized(220, 6, 0.95);
const MEDIUM = () => macSized(600, 8, 0.955);
const HARD = () => macSized(2200, 9, 0.96);
const flip = (d: number[]) => d.map((x) => -x);

describe("trackpad swipes", () => {
  beforeEach(() => vi.unstubAllGlobals());

  // As 1440x900: the hero, How it works, chapters 01 and 02, the live photo, check 3, the paid receipt, the console; the
  // Chain of Custody's story from the hero to its console beat, the dolly a slow stretch.
  const BEATS = [0, 414, 823, 1858, 2534, 4278, 6140, 6698];
  const course = (at: number) => setup(at, BEATS, [[144, 700, 5]], undefined, [1858, 2534, 6140], [[64, 6912]], undefined, undefined, [[0, 6698]]);

  it("F1: a tiny or small swipe from the hero moves one beat, to How it works, and its momentum never carries it on", () => {
    for (const d of [TINY(), SMALL()]) {
      const g = course(0);
      g.send(d);
      expect(g.lenis.landed).toEqual([414]);
      g.finish();
      // The next small swipe goes on to chapter 01, and the one after to chapter 02.
      g.send(SMALL(), 16, 300);
      expect(g.lenis.landed).toEqual([414, 823]);
      g.finish();
      g.send(SMALL(), 16, 300);
      expect(g.lenis.landed).toEqual([414, 823, 1858]);
    }
  });

  it("F1: one beat a swipe up the story too", () => {
    const g = course(1858);
    for (const to of [823, 414, 0]) {
      g.send(flip(SMALL()), 16, 300);
      expect(g.lenis.landed.at(-1)).toBe(to);
      g.finish();
    }
    expect(g.lenis.landed).toEqual([823, 414, 0]);
  });

  it("F2: no swipe of any size moves more than one stop, from any beat", () => {
    for (const shape of [TINY, SMALL, MEDIUM, HARD]) {
      for (const from of BEATS.slice(0, -1)) {
        const g = course(from);
        g.send(shape());
        const next = BEATS[BEATS.indexOf(from) + 1];
        expect(g.lenis.landed, `${shape.name} from ${from}`).toEqual([next]);
      }
    }
  });

  it("F2: a second swipe while the landing still glides moves on exactly one more stop", () => {
    const g = course(0);
    const first = SMALL();
    // The second swipe's fingers stop the first's momentum 350 ms in, as macOS does.
    g.send(first.slice(0, Math.round(350 / 16)));
    expect(g.lenis.landed).toEqual([414]);
    g.lenis.animatedScroll = 300; // part way there
    g.send(SMALL(), 16, 24);
    expect(g.lenis.landed).toEqual([414, 823]);
  });

  it("F2: a swipe's momentum merged into fewer, larger events after a stall is still its own tail", () => {
    const g = course(823);
    const d = SMALL();
    g.send(d.slice(0, 20));
    expect(g.lenis.landed).toEqual([1858]);
    // A busy frame: 200 ms of momentum arrives as one event, then the rest.
    const merged = d.slice(20, 32).reduce((a, b) => a + b, 0);
    g.send([merged], 200);
    g.send(d.slice(32));
    expect(g.lenis.landed).toEqual([1858]);
  });

  it("F3: a one-beat landing takes 0.95 to 1.2 s and ends on the stop", () => {
    for (const from of [0, 414, 823, 4278]) {
      const g = course(from);
      g.send(SMALL());
      expect(g.lenis.duration).toBeGreaterThanOrEqual(0.95);
      expect(g.lenis.duration).toBeLessThanOrEqual(1.2);
      expect(g.lenis.easing!(1)).toBeCloseTo(1, 6);
    }
  });

  it("F4: a tiny swipe's first 40px follow the hand before the landing takes over", () => {
    const g = course(0);
    const d = TINY();
    let through = 0;
    for (const x of d) {
      through += g.send([x]);
      if (g.lenis.landed.length) break;
    }
    expect(g.lenis.landed).toEqual([414]);
    expect(through).toBeGreaterThanOrEqual(40);
    expect(through).toBeLessThan(d.reduce((a, b) => a + b, 0));
  });

  it("F5: a slow drag follows the hand all the way and settles on the beat ahead of where it stopped, never back", () => {
    const g = course(0);
    const drag = Array.from({ length: 94 }, (_, i) => 6 + 1.6 * Math.sin(i / 7) + 0.4 * Math.sin(i * 1.7));
    const total = drag.reduce((a, b) => a + b, 0);
    expect(g.send(drag)).toBeCloseTo(total, 6);
    expect(g.lenis.landed).toEqual([]);
    g.lenis.animatedScroll = g.lenis.targetScroll - 4;
    vi.spyOn(performance, "now").mockReturnValue(performance.now() + 1000);
    g.scroll();
    vi.restoreAllMocks();
    expect(total).toBeGreaterThan(414);
    expect(g.lenis.landed).toEqual([823]);
  });

  it("F6: one notch of a mouse wheel moves one beat, How it works included", () => {
    let at = 0;
    for (const to of [414, 823, 1858]) {
      const g = course(at);
      g.send([100]);
      g.lenis.animatedScroll = g.lenis.targetScroll - 4;
      vi.spyOn(performance, "now").mockReturnValue(performance.now() + 1000);
      g.scroll();
      vi.restoreAllMocks();
      expect(g.lenis.landed).toEqual([to]);
      at = to;
    }
  });

  it("F2: a busy page merging the momentum's events in pairs still reads the lift, and the second swipe still moves on", () => {
    const g = course(0);
    const d = SMALL();
    // The finger phase as sent, then the momentum two frames an event, 32 ms apart, until the second swipe at 350 ms.
    g.send(d.slice(0, 6));
    let t = 6 * 16;
    for (let i = 6; t < 350 - 32; i += 2, t += 32) g.send([d[i] + d[i + 1]], 32);
    expect(g.lenis.landed).toEqual([414]);
    g.send(SMALL(), 16, 24);
    expect(g.lenis.landed).toEqual([414, 823]);
  });
});

