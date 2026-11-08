"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { EASE } from "@/components/ui";
import { HeroDevice, useMedia } from "../HeroDevice";
import { CHAPTERS } from "./claim";
import { CustodyStage } from "./CustodyStage";
import { HeroPhone } from "./HeroPhone";
import { PhoneRunway } from "./PhoneRunway";
import { StaticFigures } from "./StaticFigures";
import { ENTER, IN_OUT, LEAVE, useGate } from "./gate";
import { PACE, SCROLL_VH, scrollAt } from "./pace";
import styles from "./custody.module.css";

// Which form the Chain of Custody takes (spec H2). The server always renders the static figures; after hydration a
// laptop at least 1024x700 with motion allowed gets the pinned sequence, anything smaller with motion allowed the
// sticky phone. The hero is the same element, in the same place, in every form, so the switch never moves it.
type Mode = "static" | "pinned" | "phone";

/** The dolly: the laptop moves in from p 0.04 and arrives at 0.12, where the screen layer takes over (CustodyStage). */
export const DOLLY = [0.04, 0.12] as const;
/** The most the laptop grows on the dolly: its glass reaches the window's width on every laptop screen. */
const MAX_SCALE = 2.8;

const ramp = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));
/** DESIGN.md's state-to-state curve, cubic-bezier(0.65, 0, 0.35, 1): the laptop is under way as soon as the copy goes. */
const inOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

function SkipLink() {
  return (
    <a href="#checks" className="inline-flex min-h-11 items-center rounded-control text-ui text-muted underline decoration-line-2 underline-offset-4 transition-colors duration-160 hover:text-text">
      Skip to Fraud checks&nbsp;&darr;
    </a>
  );
}

/** The chapters as text, for screen readers, wherever the moving stage stands in for the static figures. */
function ChapterList() {
  return (
    <div className="sr-only">
      <h2 id="how-title">How it works: one claim, start to finish</h2>
      <ol>
        {CHAPTERS.map((c) => (
          <li key={c.n}>
            {c.title}. {c.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

function useDolly(p: MotionValue<number>, stage: RefObject<HTMLDivElement | null>, device: RefObject<HTMLDivElement | null>) {
  // Where the laptop has to go, and how large it has to grow, so its screen's glass lands on the Chain of Custody's
  // window (columns 4 to 12, its top on the window's top), measured at rest: a match cut. The screen layer takes over
  // inside the glass at 0.12 and only grows down to the window's foot, so the dolly reads as the camera moving into the
  // laptop's screen, the laptop centred on the window rather than pushed off the right edge onto one card.
  const target = useRef({ x: 0, y: 0, s: 1.35 });
  useEffect(() => {
    const st = stage.current;
    if (!st) return;
    const measure = () => {
      const dev = device.current;
      const scr = dev?.querySelector("[data-laptop-screen]");
      if (!dev || !scr || p.get() > DOLLY[0]) return;
      const S = st.getBoundingClientRect();
      const D = dev.getBoundingClientRect();
      const P = scr.getBoundingClientRect();
      const win = st.querySelector("[data-screen-inner]")?.getBoundingClientRect();
      const cx = D.left + D.width / 2;
      const cy = D.top + D.height / 2;
      const s = win ? Math.min(MAX_SCALE, Math.max(1.35, win.width / P.width)) : 1.35;
      const tx = win ? win.left + win.width / 2 : S.left + S.width / 2;
      const ty = win ? win.top + (s * P.height) / 2 : S.top + S.height / 2;
      target.current = { x: tx - cx - s * (P.left + P.width / 2 - cx), y: ty - cy - s * (P.top + P.height / 2 - cy), s };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(st);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [p, stage, device]);

  // Out of the gate at once (ease-out): the laptop is well on its way to the centre by the time the copy has gone, so no
  // frame holds an empty left half beside a parked laptop; it settles into the screen as it arrives.
  const k = useTransform(p, (v) => 1 - (1 - ramp(v, DOLLY[0], DOLLY[1])) ** 3);
  // The hero copy and the laptop's labels leave in time as the dolly starts, and come back the same way: a scrubbed fade
  // held the headline at half strength wherever the reader paused. The copy fades and lifts away (no blur) and comes
  // back as a reveal; the labels (paper on the light table) go at once, never left half-transparent over the keyboard.
  const copy = useGate(p, (v) => v < DOLLY[0] + 0.005, { duration: 0.7, ease: EASE.outExpo }, { duration: 0.36, ease: IN_OUT });
  const labels = useGate(p, (v) => v < DOLLY[0] + 0.005, ENTER, LEAVE);
  // The laptop goes once the consent screen has dissolved in over its screen (at 0.12, CustodyStage), before the clip's
  // right edge pulls in from beyond the viewport and would uncover the laptop's own screen there.
  const body = useGate(p, (v) => v < 0.13, ENTER, { duration: 0.24, ease: IN_OUT });
  return {
    text: {
      y: useTransform(copy, (c) => -24 * (1 - c)),
      opacity: copy,
      willChange: useTransform(p, (v) => (v > 0.02 && v < 0.22 ? "transform, opacity" : "auto")),
    },
    device: {
      x: useTransform(k, (t) => t * target.current.x),
      y: useTransform(k, (t) => t * target.current.y),
      scale: useTransform(k, (t) => 1 + (target.current.s - 1) * t),
      opacity: body,
      "--tilt-k": useTransform(p, (v) => 1 - inOut(ramp(v, DOLLY[0], DOLLY[1] - 0.01))),
      willChange: useTransform(p, (v) => (v > 0.02 && v < 0.22 ? "transform, opacity" : "auto")),
    },
    labels,
  };
}

export function HeroRunway({ copy }: { copy: ReactNode }) {
  const wide = useMedia("(min-width: 1024px) and (min-height: 700px)");
  const motionOk = useMedia("(prefers-reduced-motion: no-preference)");
  const mode: Mode = !motionOk ? "static" : wide ? "pinned" : "phone";
  const pinned = mode === "pinned";

  const runway = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const device = useRef<HTMLDivElement>(null);
  // s is the raw scroll through the runway; p is the sequence's own timeline, paced so every beat gets its share of
  // the scroll (pace.ts). Everything on the stage reads p.
  const { scrollYProgress: s } = useScroll({ target: runway, offset: ["start start", "end end"] });
  const p = useTransform(s, PACE.scroll, PACE.p);
  const dolly = useDolly(p, stage, device);

  return (
    <section
      ref={runway}
      aria-labelledby="hero-title"
      data-runway={mode === "phone" ? undefined : ""}
      data-spy="how"
      className={pinned ? styles.runway : "relative"}
      style={pinned ? ({ "--scroll": `${SCROLL_VH}vh` } as CSSProperties) : undefined}
    >
      {/* The nav's "How it works" lands on the first chapter, once the screen has taken over from the laptop. Each #how
          takes focus after the jump (tabIndex -1), so the next Tab goes on from there. */}
      {pinned && <span id="how" tabIndex={-1} className="absolute left-0 outline-none" style={{ top: `${(scrollAt(0.215) * SCROLL_VH).toFixed(1)}vh` }} aria-hidden="true" />}
      <div ref={stage} className={pinned ? styles.stage : "relative"}>
        <div className={styles.hero}>
          <motion.div className={styles.copy} style={pinned ? dolly.text : undefined}>
            {copy}
          </motion.div>
          <motion.div ref={device} className={styles.device} style={pinned ? dolly.device : undefined}>
            <HeroDevice labels={pinned ? dolly.labels : undefined} />
          </motion.div>
          <div className="mt-12 lg:hidden">
            <HeroPhone />
          </div>
        </div>
        {pinned && <CustodyStage p={p} stage={stage} skip={<SkipLink />} />}
      </div>
      {mode === "static" && (
        <div id="how" tabIndex={-1} className="outline-none">
          <StaticFigures />
        </div>
      )}
      {mode === "phone" && (
        <div id="how" tabIndex={-1} className="outline-none">
          <PhoneRunway skip={<SkipLink />} />
        </div>
      )}
      {mode !== "static" && <ChapterList />}
    </section>
  );
}
