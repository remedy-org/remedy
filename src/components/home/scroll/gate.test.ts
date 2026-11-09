import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGate, notchQuiet, type GateLenis } from "./gate";
import type { Slow } from "./landing";

// The gate against a stand-in Lenis: wheel streams in, which events it takes, and where it lands the page.
const STOPS = [0, 1410, 2144, 2821, 3205];

function setup(at = 1410, stops = STOPS, slow: Slow[] = [], up?: number[], inner?: number[], pins?: [number, number][]) {
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
  const gate = createGate(() => ({ stops, slow, up, inner, pins }));
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
    // A slow stretch that isn't the dolly (the dolly's landing is held to DOLLY_TIME: tested below), so both take the
    // same time and their curves compare.
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
    expect(wheel.lenis.duration).toBeLessThanOrEqual(1.1);
    const pad = setup(2144);
    pad.send(swipe(), 8);
    expect(pad.lenis.duration).toBeGreaterThan(wheel.lenis.duration);
    // Across the dolly: 0.9 s, shorter than a trackpad's, so a wheel spun hard from the top never feels the page resist,
    // and a lighter weight than a trackpad's.
    const notched = setup(0, STOPS, [[207, 670, 5]]);
    notched.send(power(), 8);
    const flung = setup(0, STOPS, [[207, 670, 5]]);
    flung.send(swipe(), 8);
    expect(notched.lenis.landed).toEqual([1410]);
    expect(notched.lenis.duration).toBeLessThanOrEqual(0.9);
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
