"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { HeroDevice, useMedia } from "../HeroDevice";
import { CHAPTERS } from "./claim";
import { CustodyStage } from "./CustodyStage";
import { HeroPhone } from "./HeroPhone";
import { PhoneRunway } from "./PhoneRunway";
import { StaticFigures } from "./StaticFigures";
import styles from "./custody.module.css";

// Which form the Chain of Custody takes (spec H2). The server always renders the static figures; after hydration a
// laptop at least 1024x700 with motion allowed gets the pinned sequence, anything smaller with motion allowed the
// sticky phone. The hero is the same element, in the same place, in every form, so the switch never moves it.
type Mode = "static" | "pinned" | "phone";

const DOLLY = [0.04, 0.2] as const;
const SCALE = 1.35;

const ramp = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));
const easeInOut = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

function SkipLink() {
  return (
    <a href="#checks" className="inline-flex min-h-11 items-center rounded-control text-ui text-muted underline decoration-line-strong underline-offset-4 transition-colors duration-160 hover:text-text">
      Skip to what stops a fake&nbsp;&darr;
    </a>
  );
}

/** The chapters as text, for screen readers, wherever the moving stage stands in for the static figures. */
function ChapterList() {
  return (
    <div className="sr-only">
      <h2 id="how-title">How it works: one real claim, start to finish</h2>
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
  // Where the laptop has to go so its screen sits over chapter 01's consent card at 1.35x, measured at rest: the
  // screen layer takes over inside the laptop's screen rect, so the dolly lands on the card it zoomed into.
  const target = useRef({ x: 0, y: 0 });
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
      const card = st.querySelector("[data-dolly-target]")?.getBoundingClientRect();
      const cx = D.left + D.width / 2;
      const cy = D.top + D.height / 2;
      const tx = card ? card.left + card.width / 2 : S.left + S.width / 2;
      const ty = card ? card.top + card.height / 2 : S.top + S.height / 2;
      target.current = { x: tx - cx - SCALE * (P.left + P.width / 2 - cx), y: ty - cy - SCALE * (P.top + P.height / 2 - cy) };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(st);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [p, stage, device]);

  const k = useTransform(p, (v) => easeInOut(ramp(v, DOLLY[0], DOLLY[1])));
  return {
    text: {
      y: useTransform(p, (v) => Math.round(-64 * ramp(v, DOLLY[0], 0.18))),
      opacity: useTransform(p, (v) => 1 - ramp(v, DOLLY[0], 0.16)),
      filter: useTransform(p, (v) => {
        const b = 8 * ramp(v, DOLLY[0], 0.16);
        return b ? `blur(${b.toFixed(2)}px)` : "none";
      }),
      willChange: useTransform(p, (v) => (v > 0.02 && v < 0.22 ? "transform, opacity, filter" : "auto")),
    },
    device: {
      x: useTransform(k, (t) => t * target.current.x),
      y: useTransform(k, (t) => t * target.current.y),
      scale: useTransform(k, (t) => 1 + (SCALE - 1) * t),
      opacity: useTransform(p, (v) => 1 - ramp(v, 0.13, 0.18)),
      "--tilt-k": useTransform(p, (v) => 1 - easeInOut(ramp(v, DOLLY[0], 0.15))),
      willChange: useTransform(p, (v) => (v > 0.02 && v < 0.22 ? "transform, opacity" : "auto")),
    },
    labels: useTransform(p, (v) => 1 - ramp(v, DOLLY[0], 0.1)),
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
  const { scrollYProgress: p } = useScroll({ target: runway, offset: ["start start", "end end"] });
  const dolly = useDolly(p, stage, device);

  return (
    <section ref={runway} aria-labelledby="hero-title" data-runway={mode === "phone" ? undefined : ""} className={pinned ? styles.runway : "relative"}>
      {/* The nav's "How it works" lands on the first chapter, not on the hero. */}
      {pinned && <span id="how" className="absolute left-0" style={{ top: "calc(0.22 * 220vh)" }} aria-hidden="true" />}
      <div ref={stage} className={pinned ? styles.stage : "relative"}>
        <div className="relative mx-auto max-w-content px-4 pt-10 pb-14 sm:px-8 lg:h-[calc(100svh-4rem)] lg:min-h-[39rem] lg:pt-12 lg:pb-0">
          <motion.div className="relative z-[1]" style={pinned ? dolly.text : undefined}>
            {copy}
          </motion.div>
          <motion.div ref={device} className={styles.device} style={pinned ? dolly.device : undefined}>
            <HeroDevice labels={pinned ? dolly.labels : undefined} />
          </motion.div>
          <div className="mt-14 lg:hidden">
            <HeroPhone />
          </div>
        </div>
        {pinned && <CustodyStage p={p} stage={stage} skip={<SkipLink />} />}
      </div>
      {mode === "static" && (
        <div id="how" className="scroll-mt-16">
          <StaticFigures />
        </div>
      )}
      {mode === "phone" && (
        <div id="how" className="scroll-mt-16">
          <PhoneRunway skip={<SkipLink />} />
        </div>
      )}
      {mode !== "static" && <ChapterList />}
    </section>
  );
}
