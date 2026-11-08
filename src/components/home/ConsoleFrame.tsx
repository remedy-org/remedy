"use client";

import clsx from "clsx";
import { forwardRef, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import styles from "./home.module.css";
import { TOUR } from "./tour-copy";

/**
 * An underline that moves to the active item of a row (the frame's Claims / Insights / Report, the status tabs' All /
 * Held): measured from the items and written straight to the bar's transform (translateX and scaleX of a 100px bar, so
 * only transform animates). Re-measured when the row resizes (a web font landing changes the words' widths).
 */
export function useSlider<T extends HTMLElement = HTMLElement>(active: number) {
  const row = useRef<T>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const at = useRef(active);
  useLayoutEffect(() => {
    at.current = active;
    const el = row.current;
    const line = bar.current;
    if (!el || !line) return;
    const place = () => {
      const item = el.querySelectorAll<HTMLElement>("[data-slide]")[at.current];
      if (!item) return;
      line.style.transform = `translateX(${item.offsetLeft}px) scaleX(${item.offsetWidth / 100})`;
      el.dataset.measured = "";
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);
  return { row, bar };
}

export type FramePage = (typeof TOUR.chrome.pages)[number];

export interface ConsoleFrameProps extends HTMLAttributes<HTMLDivElement> {
  /** The page the frame's chrome underlines. */
  page: FramePage;
  /** The foot's two ends: the test-money line, and the credit in --faint. */
  foot: { left?: string | null; right?: string | null };
  /** What the step shows, for screen readers: the frame itself is a picture. Announced on each change. */
  description: string;
  children: ReactNode;
}

/**
 * The homepage tour's one console window (ConsoleTour.tsx): chrome, the recall's title row, a body slot of fixed height
 * (809px, or less on a short laptop screen: --frame-h, home.module.css .stage) and a one-line mono foot. It never re-mounts and never changes height: only the body inside it changes. The chrome is
 * an echo inside the inert picture: the tour's own tabs above the frame are the controls.
 */
export const ConsoleFrame = forwardRef<HTMLDivElement, ConsoleFrameProps>(function ConsoleFrame({ page, foot, description, children, className, ...panel }, ref) {
  const pages = TOUR.chrome.pages;
  const { row, bar } = useSlider<HTMLSpanElement>(pages.indexOf(page));
  return (
    <div ref={ref} {...panel} className={clsx("flex h-[var(--frame-h,809px)] flex-col overflow-hidden rounded-frame bg-bg text-text shadow-float", className)}>
      <p className="sr-only" aria-live="polite">
        {description}
      </p>
      {/* The picture: nothing in it takes a click, a tab stop or a screen reader's attention. */}
      <div inert className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-6 border-b border-line px-5">
          <span className="font-semibold">{TOUR.chrome.app}</span>
          <span ref={row} className={clsx("relative flex h-full items-center gap-5 text-ui font-medium", styles.slideRow)}>
            {pages.map((p) => (
              <span key={p} data-slide data-on={p === page || undefined} className={clsx(styles.chromePage, p === page ? "text-text" : "text-faint")}>
                {p}
              </span>
            ))}
            <span ref={bar} className={clsx(styles.slider, "-bottom-px")} />
          </span>
          <span className="ml-auto text-ui whitespace-nowrap text-muted">{TOUR.chrome.company}</span>
        </div>
        <div className="flex h-11 shrink-0 items-end justify-between gap-6 px-5">
          <span className="text-ui font-medium">
            Kikea <span className="whitespace-nowrap">X-VESOLJE</span> nursing pillows
          </span>
          <span className="flex items-center gap-3">
            <span className="micro whitespace-nowrap text-faint">{TOUR.recall.id}</span>
            <span className="micro inline-flex h-5 items-center rounded-control border border-line-2 px-1.5 whitespace-nowrap text-muted">{TOUR.recall.badge}</span>
          </span>
        </div>
        <div className="relative min-h-0 flex-1">{children}</div>
      </div>
      {/* Read as text: the test-money fact, said once on this screen, and the credit. */}
      <p className="flex h-[33px] shrink-0 items-center justify-between gap-6 border-t border-line px-5 font-mono text-micro">
        <span className="truncate text-muted">{foot.left}</span>
        {foot.right && <span className="shrink-0 text-faint">{foot.right}</span>}
      </p>
    </div>
  );
});
