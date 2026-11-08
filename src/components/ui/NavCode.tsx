"use client";

import { useEffect, useRef, useState } from "react";

// The claim-code alphabet (no I, O, 0 or 1), as on the tags.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const STEPS = 4;
const STEP_MS = 40;

/**
 * An exhibit letter in a nav link (A to D) that reads like a code being checked: when the pointer enters its link it
 * runs through 4 random characters of the claim-code alphabet, 40ms apart, then lands back on its letter (160ms in
 * all). The changing letter is --text, never amber. It is decorative (aria-hidden), so the link's name never changes;
 * it lands at once on press, so a click never shows a stray letter; keyboard focus and reduced motion leave it still.
 */
export function NavCode({ children }: { children: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(children);

  useEffect(() => {
    const link = ref.current?.closest("a");
    if (!link) return;
    let timer = 0;
    const land = () => {
      window.clearInterval(timer);
      timer = 0;
      setShown(children);
    };
    const run = () => {
      if (timer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      let n = 0;
      timer = window.setInterval(() => {
        if (++n >= STEPS) return land();
        setShown(ALPHABET[Math.floor(Math.random() * ALPHABET.length)]);
      }, STEP_MS);
      setShown(ALPHABET[Math.floor(Math.random() * ALPHABET.length)]);
    };
    link.addEventListener("pointerenter", run);
    link.addEventListener("pointerdown", land);
    return () => {
      link.removeEventListener("pointerenter", run);
      link.removeEventListener("pointerdown", land);
      window.clearInterval(timer);
    };
  }, [children]);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-active={shown !== children || undefined}
      className="inline-block w-[1ch] text-center font-mono text-micro text-faint transition-colors duration-[90ms] data-active:text-text"
    >
      {shown}
    </span>
  );
}
