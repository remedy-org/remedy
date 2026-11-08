"use client";

import clsx from "clsx";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import styles from "./home.module.css";
import { TOUR } from "./tour-copy";

export type FramePage = (typeof TOUR.chrome.pages)[number];

export interface ConsoleFrameProps extends HTMLAttributes<HTMLDivElement> {
  /** The page the frame's chrome shows as current. */
  page: FramePage;
  /** What the step shows, for screen readers: the frame itself is a picture. Announced on each change. */
  description: string;
  /** The SDK the step is built on, said quietly at the end of the recall's row ("Built on AG Grid"), or what a visitor
   * has filtered the step to, with a way out. */
  credit?: ReactNode;
  /** A click on one of the chrome's pages: the tour moves to its step. */
  onPage?: (page: FramePage) => void;
  children: ReactNode;
}

/**
 * The homepage tour's one console window (ConsoleTour.tsx): chrome, the recall's title row and a body slot, at a fixed
 * height (680px, or less on a short laptop screen: --frame-h, home.module.css .stage). It never re-mounts and never
 * changes height: only the body inside it changes. The chrome's pages are plain words, the current one in the text
 * colour (the tour's own tabs above the frame are the one control that reads as tabs); a click on one moves the tour to
 * that page, for the pointer only: the tabs are the keyboard's and screen reader's controls. Each body says itself what
 * in it a visitor may touch.
 */
export const ConsoleFrame = forwardRef<HTMLDivElement, ConsoleFrameProps>(function ConsoleFrame({ page, description, credit, onPage, children, className, ...panel }, ref) {
  const pages = TOUR.chrome.pages;
  return (
    <div ref={ref} {...panel} className={clsx("flex h-[var(--frame-h,776px)] flex-col overflow-hidden rounded-frame bg-bg text-text shadow-float", className)}>
      <p className="sr-only" aria-live="polite">
        {description}
      </p>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* The chrome: its pages take a click (no tab stop, and hidden from screen readers, who have the tablist). */}
        <div aria-hidden="true" className="flex h-12 shrink-0 items-center gap-6 border-b border-line px-5">
          <span className="font-semibold">{TOUR.chrome.app}</span>
          <span className="flex h-full items-center gap-5 text-ui">
            {pages.map((p) => (
              <button
                key={p}
                type="button"
                tabIndex={-1}
                onClick={() => onPage?.(p)}
                className={clsx(styles.chromePage, "h-full cursor-pointer", p === page ? "text-text" : "text-muted hover:text-text-2")}
              >
                {p}
              </button>
            ))}
          </span>
          <span className="ml-auto text-ui whitespace-nowrap text-muted select-none">{TOUR.chrome.company}</span>
        </div>
        <div className="flex h-11 shrink-0 items-end justify-between gap-6 px-5">
          <span className="text-ui">
            <span className="font-medium">
              Kikea <span className="whitespace-nowrap">X-VESOLJE</span> nursing pillows
            </span>
            <span className="ml-2 whitespace-nowrap text-muted">{TOUR.recall.id}</span>
          </span>
          {credit && (
            <span key={typeof credit === "string" ? credit : "filter"} className={clsx("text-ui whitespace-nowrap text-muted", styles.credit)}>
              {credit}
            </span>
          )}
        </div>
        <div className="relative min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
});
