"use client";

import { motion, useMotionValue, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { ClaimRow } from "@/app/console/_lib/view";
import { formatDayTime } from "@/components/console/format";
import { EASE } from "@/components/ui";
import { HeroDevice, useMedia } from "../HeroDevice";
import { CHAPTERS, CLAIM } from "./claim";
import { CustodyStage } from "./CustodyStage";
import { HeroPhone } from "./HeroPhone";
import { PhoneRunway } from "./PhoneRunway";
import { StaticFigures } from "./StaticFigures";
import { ENTER, IN_OUT, LEAVE, useGate } from "./gate";
import { HOW_IT_WORKS, PACE, SCROLL_VH, scrollAt } from "./pace";
import styles from "./custody.module.css";

// Which form the Chain of Custody takes (spec H2). The server always renders the static figures; after hydration a
// laptop at least 1024x700 with motion allowed gets the pinned sequence, anything smaller with motion allowed the
// sticky phone. The hero is the same element, in the same place, in every form, so the switch never moves it.
type Mode = "static" | "pinned" | "phone";

/** The dolly: the laptop moves in from p 0.04 and arrives at 0.12, where the screen layer takes over (CustodyStage). */
export const DOLLY = [0.04, 0.12] as const;
/** The most the laptop grows on the dolly: its glass reaches the window's width on every laptop screen. */
const MAX_SCALE = 2.8;
/** The hero copy and the receipt on the table are gone by here, scrubbed (however fast the page moves), and the laptop
 * only starts to grow from LAPTOP_FROM: it never scales up under the copy or carries the receipt up with it. */
const COPY_GONE = DOLLY[0] + 0.012;
const LAPTOP_FROM = DOLLY[0] + 0.008;
/** ms the page must be still on the dolly before the moving layers drop will-change, so the browser draws them again at
 * the size they are now, never a scale-1 picture blown up (a reader paused mid-dolly). */
const SETTLE_MS = 150;

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
    let pending = false;
    let frame = 0;
    const measure = () => {
      const dev = device.current;
      const scr = dev?.querySelector("[data-laptop-screen]");
      if (!dev || !scr) return;
      if (p.get() > DOLLY[0]) {
        pending = true;
        return;
      }
      pending = false;
      const S = st.getBoundingClientRect();
      const D = dev.getBoundingClientRect();
      // Calibrate against the flat glass that the dolly lands on, then restore the resting product pose before paint.
      const pose = dev.style.getPropertyValue("--tilt-k");
      const tilt = dev.querySelector<HTMLElement>("[data-laptop] > div");
      const pointerPose = tilt?.style.transform;
      dev.style.setProperty("--tilt-k", "0");
      if (tilt) tilt.style.transform = "none";
      const P = scr.getBoundingClientRect();
      if (pose) dev.style.setProperty("--tilt-k", pose);
      else dev.style.removeProperty("--tilt-k");
      if (tilt) tilt.style.transform = pointerPose ?? "";
      const win = st.querySelector("[data-owner-window]")?.getBoundingClientRect();
      const cx = D.left + D.width / 2;
      const cy = D.top + D.height / 2;
      const s = win ? Math.min(MAX_SCALE, Math.max(1.05, win.width / P.width)) : 1.35;
      const tx = win ? win.left + win.width / 2 : S.left + S.width / 2;
      const ty = win ? win.top + (s * P.height) / 2 : S.top + S.height / 2;
      target.current = { x: tx - cx - s * (P.left + P.width / 2 - cx), y: ty - cy - s * (P.top + P.height / 2 - cy), s };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(st);
    const win = st.querySelector("[data-owner-window]");
    if (win) ro.observe(win);
    // A resize midway through the story cannot be measured against transformed glass. Calibrate when it returns home.
    const off = p.on("change", (v) => {
      if (!pending || v > DOLLY[0]) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    document.fonts?.ready.then(measure);
    return () => {
      ro.disconnect();
      off();
      cancelAnimationFrame(frame);
    };
  }, [p, stage, device]);

  // Out of the gate at once (ease-out) once the copy is nearly gone: the laptop is well on its way to the centre by the
  // time the copy has left, so no frame holds an empty left half beside a parked laptop, and none has the copy printed
  // over its screen; it settles into the screen as it arrives.
  const k = useTransform(p, (v) => 1 - (1 - ramp(v, LAPTOP_FROM, DOLLY[1])) ** 3);
  // The hero copy and the laptop's labels leave in time as the dolly starts, and come back the same way: a scrubbed fade
  // held the headline at half strength wherever the reader paused. The copy fades and lifts away (no blur) and comes
  // back as a reveal; the labels (paper on the light table, the receipt) go at once, never left half-transparent over
  // the keyboard. A fling faster than the fade takes both out with the scroll instead (COPY_GONE).
  const copyGate = useGate(p, (v) => v < DOLLY[0] + 0.005, { duration: 0.7, ease: EASE.outExpo }, { duration: 0.36, ease: IN_OUT });
  const labelGate = useGate(p, (v) => v < DOLLY[0] + 0.005, ENTER, LEAVE);
  const out = (v: number) => 1 - ramp(v, DOLLY[0], COPY_GONE);
  const copy = useTransform(() => Math.min(copyGate.get(), out(p.get())));
  const labels = useTransform(() => Math.min(labelGate.get(), out(p.get())));
  // will-change only while the dolly is moving: held, Chrome keeps the layer at its scale-1 raster and blows it up.
  const will = useMotionValue<"auto" | "transform, opacity">("auto");
  const raster = useMotionValue(1);
  const idle = useRef(0);
  useMotionValueEvent(p, "change", (v) => {
    window.clearTimeout(idle.current);
    raster.set(1);
    if (v <= 0.02 || v >= 0.22) return will.set("auto");
    will.set("transform, opacity");
    idle.current = window.setTimeout(() => {
      will.set("auto");
      // Draw settled glass at its displayed resolution rather than enlarging a small text raster.
      raster.set(1 + (target.current.s - 1) * k.get());
    }, SETTLE_MS);
  });
  useEffect(() => () => window.clearTimeout(idle.current), []);
  // The laptop goes once the consent screen has dissolved in over its screen (at 0.12, CustodyStage), before the clip's
  // right edge pulls in from beyond the viewport and would uncover the laptop's own screen there.
  const body = useGate(p, (v) => v < 0.13, ENTER, { duration: 0.24, ease: IN_OUT });
  return {
    text: {
      y: useTransform(copy, (c) => -24 * (1 - c)),
      opacity: copy,
      willChange: will,
    },
    device: {
      x: useTransform(k, (t) => t * target.current.x),
      y: useTransform(k, (t) => t * target.current.y),
      scale: useTransform(k, (t) => 1 + (target.current.s - 1) * t),
      opacity: body,
      "--tilt-k": useTransform(p, (v) => 1 - inOut(ramp(v, DOLLY[0], DOLLY[1] - 0.01))),
      "--raster-scale": raster,
      willChange: will,
    },
    labels,
  };
}

/** RM-0442's filing day and time from the console's rows (they move to the visit's day), or its time of day alone. */
const filedOf = (rows: ClaimRow[]) => {
  const row = rows.find((r) => r.id === CLAIM.id);
  return row ? formatDayTime(row.createdAt) : CLAIM.filed;
};

/** `consoleRows`: chapter 06's queue, drawn on the server from the claims /console reads (Hero.tsx). */
export function HeroRunway({ copy, journey, consoleRows }: { copy: ReactNode; journey: ReactNode; consoleRows: ClaimRow[] }) {
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
      {pinned && <span id="how" tabIndex={-1} className="absolute left-0 outline-none" style={{ top: `${(scrollAt(HOW_IT_WORKS) * SCROLL_VH).toFixed(1)}vh` }} aria-hidden="true" />}
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
          <motion.div className={styles.journey} style={pinned ? dolly.text : undefined}>
            {journey}
          </motion.div>
        </div>
        {pinned && <CustodyStage p={p} stage={stage} skip={<SkipLink />} consoleRows={consoleRows} />}
      </div>
      {mode === "static" && (
        <div id="how" tabIndex={-1} className="outline-none">
          {/* Chapter 06's row gives RM-0442's filing day and time as the pinned queue does, from the same rows. */}
          <StaticFigures filed={filedOf(consoleRows)} />
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
