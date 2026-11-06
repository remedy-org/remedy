"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Scroll reveal (DESIGN.md): a section fades in and rises 8px as it enters. The resting state is the visible one:
// it only hides what is still below the fold once JS runs, and never under reduced motion, so no-JS visitors,
// reduced motion and full-page screenshots all see the whole page.
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.dataset.reveal = "hidden";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.reveal = "shown";
        io.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-[opacity,translate] duration-[360ms] ease-snap data-[reveal=hidden]:translate-y-2 data-[reveal=hidden]:opacity-0 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
