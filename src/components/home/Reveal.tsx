"use client";

import clsx from "clsx";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import styles from "./home.module.css";

/**
 * Arms an element's entrance and plays it once it is in view, through data-enter on the element (home.module.css
 * holds the moves): "armed" hides the start state, "play" runs it. The resting state is the final one: nothing is
 * armed without JS, under reduced motion, or when the element is already on screen at load, so screenshots and
 * no-JS visitors see the finished page. `onArm` runs just before arming, to measure what the move needs.
 */
export function useEnter(ref: RefObject<HTMLElement | null>, { threshold = 0.35, onArm }: { threshold?: number; onArm?: (el: HTMLElement) => void } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    onArm?.(el);
    el.dataset.enter = "armed";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.enter = "play";
        io.disconnect();
      },
      // A tall element can never be 35% visible on a short screen; its top third in view is enough then.
      { threshold: [0, threshold], rootMargin: "0px 0px -20% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
    // Arm once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Focus-in (DESIGN.md, move 1): every child with the `line` class from home.module.css goes from blurred, 12px down
 * and transparent to sharp, 900ms, 80ms apart (`--line` sets each one's place). Text only.
 */
export function Reveal({ children, className, as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "header" }) {
  const ref = useRef<HTMLElement>(null);
  useEnter(ref);
  return (
    <Tag ref={ref as RefObject<never>} className={clsx(styles.reveal, className)}>
      {children}
    </Tag>
  );
}

/** Ink and drop moves inside a section: the wrapper that arms and plays them (styles.highlight, .stamp, .fall, …). */
export function Enter({
  children,
  className,
  threshold,
  onArm,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  threshold?: number;
  onArm?: (el: HTMLElement) => void;
  as?: "div" | "figure" | "ol" | "section";
}) {
  const ref = useRef<HTMLElement>(null);
  useEnter(ref, { threshold, onArm });
  return (
    <Tag ref={ref as RefObject<never>} className={clsx(styles.enter, className)}>
      {children}
    </Tag>
  );
}
