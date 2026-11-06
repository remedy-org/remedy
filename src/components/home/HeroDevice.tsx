"use client";

import clsx from "clsx";
import { useInView, useMotionTemplate, useMotionValue, useSpring, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";
import { ExhibitLabel } from "@/components/ui";
import { ChecksPanel, ClaimScreen, FINAL_PHASE, type AnchorId } from "./ClaimScreen";
import { Laptop } from "./Laptop";
import styles from "./device.module.css";

// The hero moment (DESIGN.md, Motion): once the device is in view the five checks tick in 450ms apart, then the payout
// chip lands. On a narrow stage the checks tick in a full-size card under the laptop instead of on its screen. Plays once; Replay runs it again. Reduced motion shows the final state and no tilt. Without JS the
// <noscript> style below shows the final state too.

const PHASE_AT = [700, 1150, 1600, 2050, 2500, 3000];
const MAX_TILT = 4;

const EXHIBITS: { id: AnchorId; n: string; text: string; className: string }[] = [
  { id: "label", n: "01", text: "Label", className: "left-[30%] top-0 sm:left-[28%] sm:-top-[2%]" },
  { id: "cut", n: "02", text: "Cut", className: "left-0 top-[86%] sm:left-0 sm:top-[54%] xl:left-[3%] xl:top-[58%]" },
  { id: "code", n: "03", text: "Code", className: "left-0 top-[95%] sm:left-[6%] sm:top-[80%] xl:left-[10%] xl:top-[84%]" },
];

const NOSCRIPT = `<style>[data-hero-device] [data-seq=show]{opacity:1!important;transform:none!important}[data-hero-device] [data-seq=hide]{opacity:0!important}</style>`;

function useMedia(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", notify);
      return () => m.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function ReplayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.25 8a4.75 4.75 0 1 0 1.4-3.37" />
      <path d="M3 2.75v2.5h2.5" />
    </svg>
  );
}

export function HeroDevice() {
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const frame = useRef(0);

  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const finePointer = useMedia("(hover: hover) and (pointer: fine)");
  const inView = useInView(stageRef, { once: true, amount: 0.35 });
  const [phase, setPhase] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!inView || reduced) return;
    const timers = PHASE_AT.map((ms, i) => setTimeout(() => setPhase(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [inView, reduced, run]);

  // Pointer tilt: up to 4deg on each axis, sprung.
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const rx = useSpring(tiltX, { stiffness: 140, damping: 20 });
  const ry = useSpring(tiltY, { stiffness: 140, damping: 20 });
  const transform = useMotionTemplate`rotateX(${rx}deg) rotateY(${ry}deg)`;

  // Leader lines run from each exhibit label to its point in the photo, measured on screen after the 3D transform.
  const measure = useCallback(() => {
    frame.current = 0;
    const stage = stageRef.current;
    const svg = svgRef.current;
    if (!stage || !svg) return;
    const s = stage.getBoundingClientRect();
    for (const { id } of EXHIBITS) {
      const label = stage.querySelector(`[data-exhibit="${id}"]`);
      const anchor = stage.querySelector(`[data-anchor="${id}"]`);
      const group = svg.querySelector(`[data-leader="${id}"]`);
      if (!label || !anchor || !group) continue;
      const l = label.getBoundingClientRect();
      const a = anchor.getBoundingClientRect();
      const x1 = l.right - s.left;
      const y1 = l.top + l.height / 2 - s.top;
      const x2 = a.left + a.width / 2 - s.left;
      const y2 = a.top + a.height / 2 - s.top;
      const [halo, line, ring, dot] = Array.from(group.children);
      for (const l of [halo, line]) {
        l.setAttribute("x1", String(x1));
        l.setAttribute("y1", String(y1));
        l.setAttribute("x2", String(x2));
        l.setAttribute("y2", String(y2));
      }
      for (const c of [ring, dot]) {
        c.setAttribute("cx", String(x2));
        c.setAttribute("cy", String(y2));
      }
      group.removeAttribute("visibility");
    }
  }, []);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(measure);
  }, [measure]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    schedule();
    const resize = new ResizeObserver(schedule);
    resize.observe(stage);
    document.fonts?.ready.then(schedule);
    const off = [rx.on("change", schedule), ry.on("change", schedule)];
    return () => {
      resize.disconnect();
      off.forEach((f) => f());
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [rx, ry, schedule]);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!finePointer || reduced || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    tiltY.set(nx * MAX_TILT);
    tiltX.set(-ny * MAX_TILT);
  };
  const onPointerLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  const replay = () => {
    setPhase(0);
    setRun((r) => r + 1);
  };

  const shown = reduced ? FINAL_PHASE : phase;
  const renderTilt = (children: ReactNode) => (
    <motion.div className={styles.tilt} style={reduced ? undefined : { transform }}>
      {children}
    </motion.div>
  );

  return (
    <figure className={clsx("relative m-0", styles.figure)} data-hero-device>
      <noscript dangerouslySetInnerHTML={{ __html: NOSCRIPT }} />
      <div
        ref={stageRef}
        className={styles.stage}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        role="img"
        aria-label="A Remedy claim on a laptop: the recalled Kikea pillow cut in half with code M4T written on its tag. Five checks pass, then $29.99 is sent to PayPal in 41 seconds."
      >
        <div className={styles.view}>
          <Laptop screen={<ClaimScreen phase={shown} />} renderTilt={renderTilt} />
        </div>
        <svg ref={svgRef} className={styles.leaders} aria-hidden="true">
          {EXHIBITS.map(({ id }) => (
            <g key={id} data-leader={id} visibility="hidden">
              <line className={styles.halo} />
              <line />
              <circle className={styles.ring} r={6} />
              <circle r={2.5} />
            </g>
          ))}
        </svg>
        {EXHIBITS.map(({ id, n, text, className }) => (
          <div key={id} className={clsx(styles.label, "whitespace-nowrap", className)}>
            <ExhibitLabel leader="right" leaderLength={28} className="bg-bg/70" as="span">
              Exhibit {n} · {text}
            </ExhibitLabel>
            <span data-exhibit={id} className="absolute right-0 top-1/2 size-px" />
          </div>
        ))}
      </div>
      {/* Phones: the checks at reading size, under the laptop. The screen reader hears the stage's label instead. */}
      <div className={clsx("relative z-10 mt-12 sm:mt-6", styles.narrowOnly)} aria-hidden="true">
        <div className="flex flex-col rounded-card border border-line bg-surface p-5 text-[calc(14px/1.2)]">
          <ChecksPanel phase={shown} />
        </div>
      </div>
      <figcaption className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 sm:mt-4 sm:pl-[6%] lg:pr-[calc(2rem_+_max(0px,(100vw_-_75rem)/2))]">
        <span className="text-ui text-faint">A demo claim on the Kikea recall. AI-made test photo; sandbox money.</span>
        <button
          type="button"
          onClick={replay}
          className={clsx(
            "inline-flex min-h-11 items-center gap-2 rounded-control text-ui font-medium text-muted transition-colors duration-160 hover:text-text",
            "motion-reduce:hidden",
          )}
        >
          <ReplayIcon />
          Replay
        </button>
      </figcaption>
    </figure>
  );
}
