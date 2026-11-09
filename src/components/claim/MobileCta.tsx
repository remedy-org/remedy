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
 * Touch phones only (a coarse pointer under 640px; a laptop zoomed to 200% keeps its own button): whenever the step's own
 * button is off screen, the same action waits in a 64px bar at the bottom (above the home indicator), so it is always
 * on the first screen. The strip the bar covers counts as off screen. The bar is a visual shortcut: the step's button is
 * the real control, so assistive tech and the Tab order never meet it twice. The target is looked up by id when the bar
 * mounts, so a step that swaps its button for another keys its bar to match. `note`: a line the bar carries above the
 * button, such as time running out, which the step then doesn't repeat. `first`: until all of that element has been on
 * screen above the bar, the bar's quiet button brings it into view instead of acting. The bar's side padding is the
 * page's gutter, so its button lines up with the step's own. `onShow`: told each time the bar comes up or goes, so the step
 * can say the note itself whenever the bar is down.
 */
export function MobileCta({
  target,
  label,
  disabled,
  note,
  first,
  onShow,
  ...to
}: { target: string; label: string; disabled?: boolean; note?: ReactNode; first?: CtaFirst; onShow?(shown: boolean): void } & ({ href: string; onClick?: never } | { onClick(): void; href?: never })) {
  const [show, setShow] = useState(false);
  const [seen, setSeen] = useState(!first);
  const bar = useRef<HTMLDivElement>(null);
  const hasNote = Boolean(note);
  const onShowRef = useRef(onShow);
  useEffect(() => {
    onShowRef.current = onShow;
  });
  useEffect(() => onShowRef.current?.(show), [show]);
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
    // Seen only once all of it has cleared the bar (the bar's real height): a heading peeking over the bar, with the
    // email and password behind it, is not the login seen.
    const cover = Math.ceil(bar.current?.offsetHeight || 90);
    const io = new IntersectionObserver(([e]) => e.intersectionRatio >= 0.99 && setSeen(true), { rootMargin: `0px 0px -${cover}px 0px`, threshold: [0.99, 1] });
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
  const tabIndex = -1;
  return (
    <div
      ref={bar}
      aria-hidden="true"
      inert={!show}
      data-mobile-cta=""
      data-cta-shown={show ? "" : undefined}
      className={clsx(
        "fixed inset-x-0 bottom-0 z-30 hidden border-t border-line bg-bg px-(--gutter) pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-[translate,opacity] duration-160 ease-snap max-sm:pointer-coarse:block",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      {note && <p className="mb-2 text-ui font-medium text-text">{note}</p>}
      {first && !seen ? (
        <Button variant="secondary" size="lg" block onClick={showFirst} tabIndex={tabIndex}>
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
