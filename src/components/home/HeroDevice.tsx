"use client";

import clsx from "clsx";
import { animate, motion, useInView, useMotionTemplate, useMotionValue, useSpring, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";
import { ExhibitLabel, Money, Paper } from "@/components/ui";
import { CLAIM } from "./custody/claim";
import { ClaimScreen, FINAL_PHASE, type AnchorId } from "./ClaimScreen";
import { Laptop } from "./Laptop";
import styles from "./device.module.css";

// The hero moment (DESIGN.md, Motion): once the device is in view the five checks tick in 450ms apart, then the payout
// chip lands, and a paper receipt tag leaves the screen to rest on the light table (spec H1). Plays once; Replay runs it
// again. Reduced motion shows the final state and no tilt; without JS the <noscript> style below shows it too. Laptops
// only: below 1024px the hero shows a phone instead (HeroPhone).

const PHASE_AT = [700, 1150, 1600, 2050, 2500, 3000];
const TAG_AFTER = 380;
const MAX_TILT = 4;

const EXHIBITS: { id: AnchorId; n: string; text: string; className: string }[] = [
  { id: "label", n: "01", text: "Label", className: "left-[22%] -top-[1%]" },
  { id: "cut", n: "02", text: "Cut", className: "left-[1%] top-[63%]" },
  { id: "code", n: "03", text: "Code", className: "left-[24%] top-[75%]" },
];

const NOSCRIPT = `<style>[data-hero-device] [data-seq=show]{opacity:1!important;transform:none!important}[data-hero-device] [data-seq=hide]{opacity:0!important}</style>`;

export function useMedia(query: string) {
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

export interface HeroDeviceProps {
  /** The exhibit labels' opacity: they let go of the laptop as the dolly starts. */
  labels?: MotionValue<number>;
}

export function HeroDevice({ labels }: HeroDeviceProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLSpanElement>(null);
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

  // The payout leaves the screen: a paper tag starts at the chip's size and place on the screen, and flies out over
  // the bezel to its rest on the table, 520ms --ease-snap, its shadow fading in as it lands. Only ever scaled up to
  // its rest size, so its text stays sharp.
  useEffect(() => {
    const tag = tagRef.current;
    const shadow = shadowRef.current;
    if (!tag || !shadow || reduced) return;
    if (phase < FINAL_PHASE) {
      tag.style.opacity = "0";
      shadow.style.opacity = "0";
      return;
    }
    const chip = stageRef.current?.querySelector("[data-chip]");
    if (!chip) return;
    let stop = () => {};
    const t = setTimeout(() => {
      tag.style.transform = "";
      const c = chip.getBoundingClientRect();
      const r = tag.getBoundingClientRect();
      const s = Math.min(1, c.height / r.height / 0.75);
      // The receipt may be scaled down on short screens (device.module.css): move in its own, unscaled px.
      const k = r.width / tag.offsetWidth || 1;
      const x = (c.left + c.width / 2 - (r.left + r.width / 2)) / k;
      const y = (c.top + c.height / 2 - (r.top + r.height / 2)) / k;
      const a = animate(tag, { x: [x, 0], y: [y, 0], scale: [s, 1], opacity: [0, 1, 1], rotate: [6, -3] }, { duration: 0.52, ease: [0.2, 0.8, 0.2, 1] });
      const b = animate(shadow, { opacity: [0, 1] }, { duration: 0.2, delay: 0.38 });
      stop = () => {
        a.stop();
        b.stop();
      };
    }, TAG_AFTER);
    return () => {
      clearTimeout(t);
      stop();
    };
  }, [phase, reduced]);

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
    if (!stage || !svg || !stage.offsetWidth) return;
    const s = stage.getBoundingClientRect();
    const k = s.width / stage.offsetWidth || 1;
    for (const { id } of EXHIBITS) {
      const label = stage.querySelector(`[data-exhibit="${id}"]`);
      const anchor = stage.querySelector(`[data-anchor="${id}"]`);
      const group = svg.querySelector(`[data-leader="${id}"]`);
      if (!label || !anchor || !group) continue;
      const l = label.getBoundingClientRect();
      const a = anchor.getBoundingClientRect();
      const x1 = (l.right - s.left) / k;
      const y1 = (l.top + l.height / 2 - s.top) / k;
      const x2 = (a.left + a.width / 2 - s.left) / k;
      const y2 = (a.top + a.height / 2 - s.top) / k;
      const [halo, line, ring, dot] = Array.from(group.children);
      for (const el of [halo, line]) {
        el.setAttribute("x1", String(x1));
        el.setAttribute("y1", String(y1));
        el.setAttribute("x2", String(x2));
        el.setAttribute("y2", String(y2));
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
        aria-label={`A Remedy claim on a laptop: the recalled Kikea pillow cut in half with code M4T written on its tag. Five checks pass, then $29.99 is sent to PayPal, ${CLAIM.seconds} seconds after the photo.`}
      >
        <div className={styles.glow} aria-hidden="true" />
        <div className={styles.view}>
          <Laptop screen={<ClaimScreen phase={shown} />} renderTilt={renderTilt} />
        </div>

        {/* The receipt on the table. At rest (reduced motion, no JS, screenshots) it is simply there. */}
        <motion.div className={styles.receipt} style={labels ? { opacity: labels } : undefined} aria-hidden="true">
          {/* With motion the flight owns these styles (React never changes them after mount); reduced motion rests them. */}
          <span ref={shadowRef} data-seq="show" className={styles.receiptShadow} style={reduced ? undefined : { opacity: 0 }} />
          <div ref={tagRef} data-seq="show" className="origin-center" style={reduced ? { rotate: "-3deg" } : { opacity: 0 }}>
            <Paper variant="tag" hole padding="none" className="w-[13.5rem]">
              <div className="flex flex-col gap-1 px-4 pt-10 pb-3.5">
                <span className="font-mono text-micro tracking-[0.06em] text-ink-muted uppercase">Refund · {CLAIM.id}</span>
                {/* "Sandbox" sits beside the amount, as on every demo amount. */}
                <span className="flex items-baseline gap-2">
                  <span className="text-[1.75rem] leading-none font-semibold tracking-[-0.02em]">
                    <Money value={CLAIM.amount} size="inline" />
                  </span>
                  <span className="font-mono text-micro tracking-[0.06em] text-ink-muted uppercase">Sandbox</span>
                </span>
                <span className="font-mono text-micro text-pay-ink">
                  sent to PayPal · {CLAIM.seconds} s
                </span>
              </div>
            </Paper>
          </div>
        </motion.div>

        <motion.div className="pointer-events-none absolute inset-0 z-[2]" style={labels ? { opacity: labels } : undefined}>
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
              <span data-exhibit={id} className="absolute top-1/2 right-0 size-px" />
            </div>
          ))}
        </motion.div>
      </div>
      <figcaption className="relative z-10 mt-2 flex flex-wrap items-center justify-end gap-x-6 gap-y-1 pr-[calc(var(--bleed,0px)+2rem)]">
        <span className="text-ui text-faint">
          Claim {CLAIM.id} · AI-made test photo · sandbox money
        </span>
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
