"use client";

import clsx from "clsx";
import { animate, motion, useInView, useMotionTemplate, useMotionValue, useSpring, type MotionValue } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";
import { Money, Paper, Stamp } from "@/components/ui";
import { CLAIM } from "./custody/claim";
import { ClaimScreen, FINAL_PHASE } from "./ClaimScreen";
import { Laptop } from "./Laptop";
import styles from "./device.module.css";

// The hero moment (DESIGN.md, Motion): once the device is in view the five checks tick in 130ms apart, then the payout
// chip lands, and the paid receipt leaves the screen to rest on the light table (spec H1), landing within 1.5 s, so a
// visitor who glances for two seconds sees the payoff, not empty boxes. It plays once and rests on
// its final frame, which is what a return visit finds. Reduced motion shows the final state and no tilt; without JS the
// <noscript> style below shows it too. Laptops only: below 1024px the hero shows a phone instead (HeroPhone).

const PHASE_AT = [200, 330, 460, 590, 720, 850];
const TAG_AFTER = 160;
const MAX_TILT = 4;

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

export interface HeroDeviceProps {
  /** The receipt's opacity: it lets go of the laptop as the dolly starts. */
  labels?: MotionValue<number>;
}

export function HeroDevice({ labels }: HeroDeviceProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLSpanElement>(null);

  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const finePointer = useMedia("(hover: hover) and (pointer: fine)");
  const inView = useInView(stageRef, { once: true, amount: 0.35 });
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!inView || reduced) return;
    const timers = PHASE_AT.map((ms, i) => setTimeout(() => setPhase(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [inView, reduced]);

  // The payout leaves the screen: the receipt starts at the chip's size and place on the screen, and flies out over
  // the bezel to its rest on the table, 440ms --ease-snap, its shadow fading in as it lands. Only ever scaled up to
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
      const a = animate(tag, { x: [x, 0], y: [y, 0], scale: [s, 1], opacity: [0, 1, 1], rotate: [6, -2] }, { duration: 0.44, ease: [0.2, 0.8, 0.2, 1] });
      const b = animate(shadow, { opacity: [0, 1] }, { duration: 0.2, delay: 0.3 });
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
        aria-label={`A Remedy claim on a laptop: the recalled X-VESOLJE Nursing Pillow cut in half with code M4T written on its tag. Five checks pass, then $29.99 is sent to PayPal, ${CLAIM.seconds} seconds after the photo.`}
      >
        <div className={styles.view}>
          <Laptop screen={<ClaimScreen phase={shown} />} renderTilt={renderTilt} />
        </div>

        {/* The receipt on the table. At rest (reduced motion, no JS, screenshots) it is simply there. */}
        <motion.div className={styles.receipt} style={labels ? { opacity: labels } : undefined} aria-hidden="true">
          {/* With motion the flight owns these styles (React never changes them after mount); reduced motion rests them. */}
          <span ref={shadowRef} data-seq="show" className={styles.receiptShadow} style={reduced ? undefined : { opacity: 0 }} />
          <div ref={tagRef} data-seq="show" className="origin-center" style={reduced ? { rotate: "-2deg" } : { opacity: 0 }}>
            {/* The money, said once in the hero, as the claim's own climax: the paid receipt, perforated where it tore
                off the roll, with its PAID stamp. The screen says the checks passed. */}
            <Paper variant="receipt" perforated padding="none" className="w-[13.5rem]">
              <div className="flex flex-col px-4 pt-5 pb-4">
                <span className="flex items-baseline justify-between gap-3 text-[0.75rem] leading-none text-ink-muted">
                  Refund receipt
                  <span className="font-mono font-medium text-ink">{CLAIM.id}</span>
                </span>
                <span className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-[1.75rem] leading-none font-medium tracking-[-0.02em] text-ink">
                    <Money value={CLAIM.amount} size="inline" />
                  </span>
                  <Stamp tone="pay">Paid</Stamp>
                </span>
              </div>
            </Paper>
          </div>
        </motion.div>
      </div>
    </figure>
  );
}
