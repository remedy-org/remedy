"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A word with more to say: dotted underline, and on hover (after 250ms, as the grid's cards) or keyboard focus a card
 * under it says it, in the grid's hover-card style. A real button, so a keyboard or a tap reaches it; the card is its
 * description for a screen reader. It leaves in 120ms and Esc closes it.
 */
export function HoverNote({ children, note }: { children: ReactNode; note: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = (delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-describedby={id}
        onPointerEnter={(e) => e.pointerType === "mouse" && show(250)}
        onPointerLeave={hide}
        onFocus={() => show(0)}
        onBlur={hide}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.stopPropagation();
            hide();
          }
        }}
        className="rounded-[4px] text-inherit underline decoration-line-strong decoration-dotted underline-offset-3 hover:decoration-text focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {children}
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute top-full left-0 z-30 mt-2 w-[280px] rounded-card bg-surface px-3.5 py-3 text-ui whitespace-normal text-muted shadow-float transition-[opacity,visibility] duration-120 ease-out ${open ? "opacity-100" : "invisible opacity-0"}`}
      >
        {note}
      </span>
    </span>
  );
}
