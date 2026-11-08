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

/** The incoming layer of a cut: it rises in over 360ms once the outgoing one is all but gone (LEAVE, 180ms). */
export const CUT_IN: Transition = { ...ENTER, delay: 0.14 };

/**
 * A chapter layer's strength (0 to 1) for the chapters `is` names, cut in time at each chapter change (cut()). A jump
 * across more than one chapter in one step (an anchor, an instant scroll) sets the layers at once: animating from the
 * chapter left behind would flash a stale screen first.
 */
export function useChapterGate(p: MotionValue<number>, is: (c: number) => boolean, leave: Transition = LEAVE) {
  const k = useMotionValue(is(chapterAt(p.get())) ? 1 : 0);
  const prev = useRef(chapterAt(p.get()));
  useMotionValueEvent(p, "change", (v) => {
    const from = prev.current;
    const to = chapterAt(v);
    if (from === to) return;
    prev.current = to;
    if (Math.abs(to - from) > 1) return k.jump(is(to) ? 1 : 0);
    const t = cut(from, to, is, leave);
    if (t) animate(k, is(to) ? 1 : 0, t);
  });
  return k;
}

/**
 * The transition for the layer that `is` names when the stage goes from chapter `from` to `to`, or null if it stays.
 * Every cut goes through the stage's ground, the exhibit's included: the outgoing layer leaves in 180ms and the incoming
 * one rises in 140ms later, when the outgoing one is under 3%. Two dense layouts are never both half drawn, so no
 * frame of a cut shows one screen's words printed over another's (a crossfade of the opaque exhibit over chapter 02,
 * or off it onto the console, did, for about 250ms on every pass).
 */
export function cut(from: number, to: number, is: (c: number) => boolean, leave: Transition = LEAVE): Transition | null {
  const was = is(from);
  const now = is(to);
  if (was === now) return null;
  return now ? CUT_IN : leave;
}
