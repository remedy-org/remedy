"use client";

import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";

/** Something the reader must see before the bar's action makes sense, such as the demo account the PayPal page asks for. */
export interface CtaFirst {
  /** The element's id; it takes focus when the bar brings it into view. */
  target: string;
  label: string;
}

/**
 * Phones and short screens (a laptop at 200% zoom): whenever the step's own button is off screen, above (scrolled past) or below (not reached yet), the same
 * action waits in a 72px bar at the bottom (above the home indicator), so it is always on the first screen and reading
 * never means scrolling for it. The strip the bar covers counts as off screen. The target is looked up by id when the bar
 * mounts, so a step that swaps its button for another keys its bar to match. `note`: a line the
 * bar carries above the button when the step's own line beside its button would be hidden, such as time running out.
 * `first`: until that element has been on screen, the bar's tap brings it into view instead of acting.
 */
export function MobileCta({
  target,
  label,
  disabled,
  note,
  first,
  ...to
}: { target: string; label: string; disabled?: boolean; note?: ReactNode; first?: CtaFirst } & ({ href: string; onClick?: never } | { onClick(): void; href?: never })) {
  const [show, setShow] = useState(false);
  const [seen, setSeen] = useState(!first);
  const bar = useRef<HTMLDivElement>(null);
  const hasNote = Boolean(note);
  useEffect(() => {
    const el = document.getElementById(target);
    if (!el) return;
    // The step's button counts as on screen only while some of it shows above the bar's top edge: one that would peek
    // out from behind the bar is covered by it instead, so the same button never shows twice.
    const cover = Math.ceil(bar.current?.offsetHeight || 90);
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { rootMargin: `0px 0px -${cover}px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, [target, hasNote]);
  const firstTarget = first?.target;
  useEffect(() => {
    const el = firstTarget && document.getElementById(firstTarget);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { rootMargin: "0px 0px -90px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [firstTarget]);
  const showFirst = () => {
    const el = firstTarget && document.getElementById(firstTarget);
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
  };
  const tabIndex = show ? 0 : -1;
  return (
    <div
      ref={bar}
      aria-hidden={!show}
      inert={!show}
      data-mobile-cta=""
      data-cta-shown={show ? "" : undefined}
      className={clsx(
        "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[translate,opacity] duration-160 ease-snap sm:[@media(min-height:601px)]:hidden",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      {/* The step says it too, in its own status line: read out once. */}
      {note && (
        <p aria-hidden="true" className="mb-2.5 text-ui font-medium text-text">
          {note}
        </p>
      )}
      {first && !seen ? (
        <Button size="lg" block onClick={showFirst} tabIndex={tabIndex}>
          {first.label}
        </Button>
      ) : to.href !== undefined ? (
        <Button href={to.href} size="lg" block prefetch={false} tabIndex={tabIndex} disabled={disabled}>
          {label}
        </Button>
      ) : (
        <Button size="lg" block onClick={to.onClick} tabIndex={tabIndex} disabled={disabled}>
          {label}
        </Button>
      )}
    </div>
  );
}
