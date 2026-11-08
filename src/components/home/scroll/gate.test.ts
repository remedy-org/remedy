import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGate, type GateLenis } from "./gate";
import type { Slow } from "./landing";

// The gate against a stand-in Lenis: wheel streams in, which events it takes, and where it lands the page.
const STOPS = [0, 1410, 2144, 2821, 3205];

function setup(at = 1410, stops = STOPS, slow: Slow[] = []) {
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
    complete: null as (() => void) | null,
    scrollTo(to: number, o: { easing: (t: number) => number; onComplete: () => void }) {
      this.landed.push(to);
      this.easing = o.easing;
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
  const gate = createGate(() => ({ stops, slow }));
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
    plain.send(power(), 8);
    const slowed = setup(0, STOPS, [[207, 670, 5]]);
    slowed.send(power(), 8);
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
});
