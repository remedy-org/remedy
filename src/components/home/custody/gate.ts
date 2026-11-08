"use client";

import { animate, useMotionValue, useMotionValueEvent, type MotionValue, type Transition } from "motion/react";
import { useRef } from "react";
import { EASE } from "@/components/ui/motion";
import { chapterAt } from "./timeline";

// Threshold moves for the pinned sequence. A fade scrubbed by the scroll holds wherever the reader stops, so a stop
// inside one rests on a half-drawn frame: words at 40%, a ghost of the last chapter, the hero copy blurred. These
// instead run in time once p crosses their threshold, and back when it crosses back, so every resting frame is a whole
// one. Continuous moves (the dolly, the screen's clip, the exhibit's camera) stay scrubbed.

/** DESIGN.md's state-to-state curve. */
export const IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];
/** An entrance: 360ms on the entrance curve. */
export const ENTER: Transition = { duration: 0.36, ease: EASE.outExpo };
/** An exit, at half the entrance's length. */
export const LEAVE: Transition = { duration: 0.18, ease: IN_OUT };

/** 0 to 1 in time: 1 while `on(p)` holds, easing over `enter` as it starts to and over `leave` as it stops. */
export function useGate(p: MotionValue<number>, on: (v: number) => boolean, enter: Transition = ENTER, leave: Transition = LEAVE) {
  const k = useMotionValue(on(p.get()) ? 1 : 0);
  const was = useRef(on(p.get()));
  useMotionValueEvent(p, "change", (v) => {
    const now = on(v);
    if (now === was.current) return;
    was.current = now;
    animate(k, now ? 1 : 0, now ? enter : leave);
  });
  return k;
}

const exhibit = (c: number) => c >= 2 && c <= 4;

/**
 * A chapter layer's strength (0 to 1) for the chapters `is` names, cut in time at each chapter change. Between two
 * claim screens the outgoing one leaves in 180ms and the incoming one rises in over 360ms, 120ms after. The exhibit is
 * an opaque page: it dissolves in over the chapter it covers, which holds at full strength under it until it is
 * opaque, and it leaves onto the console already in place under it. So no resting frame is empty or doubled, wherever
 * the scroll stops.
 */
export function useChapterGate(p: MotionValue<number>, is: (c: number) => boolean) {
  const k = useMotionValue(is(chapterAt(p.get())) ? 1 : 0);
  const prev = useRef(chapterAt(p.get()));
  useMotionValueEvent(p, "change", (v) => {
    const from = prev.current;
    const to = chapterAt(v);
    if (from === to) return;
    prev.current = to;
    const t = cut(from, to, is);
    if (t) animate(k, is(to) ? 1 : 0, t);
  });
  return k;
}

/** The transition for the layer that `is` names when the stage goes from chapter `from` to `to`, or null if it stays. */
export function cut(from: number, to: number, is: (c: number) => boolean): Transition | null {
  const was = is(from);
  const now = is(to);
  if (was === now) return null;
  if (exhibit(now ? to : from)) return now ? ENTER : { ...LEAVE, duration: 0.24, delay: 0.06 };
  if (now) return exhibit(from) ? ENTER : { ...ENTER, delay: 0.12 };
  return exhibit(to) ? { ...LEAVE, delay: 0.36 } : LEAVE;
}
