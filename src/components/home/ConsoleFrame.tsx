"use client";

import clsx from "clsx";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { Wordmark } from "@/components/ui";
import styles from "./tour.module.css";
import { TOUR } from "./tour-copy";

export type FramePage = Exclude<(typeof TOUR.chrome.pages)[number], "New recall">;

export interface ConsoleFrameProps extends HTMLAttributes<HTMLDivElement> {
  /** The page the frame's app bar shows as current. */
  page: FramePage;
  /** What the step shows, for screen readers: the frame itself is a picture. Announced on each change. */
  description: string;
  /** What a visitor has filtered the page to, with a way out, said in the app bar before the recall. */
  notice?: ReactNode;
  /** A click on one of the app bar's pages: the tour moves to its step. */
  onPage?: (page: FramePage) => void;
  /** A pointer over one of the app bar's pages (Insights loads its dashboard on intent). */
  onPageIntent?: (page: FramePage) => void;
  children: ReactNode;
}

/**
 * The homepage tour's one console window (ConsoleTour.tsx): the console's own app bar over a body slot, at a fixed
 * height (680px, or less on a short laptop screen: --frame-h, tour.module.css .stage). It never re-mounts and never
 * changes height: only the body inside it changes. The app bar is the console's (ConsoleNav.tsx): the Claim Check mark
 * and name, its four pages as plain words (the current one in the text colour), and on the right the recall it shows,
 * where the console's recall switcher sits, with its auto-pay setting. A click on Claims, Insights or Report moves the
 * tour to it, for the pointer only (the steps above the window are the keyboard's and screen reader's controls); New
 * recall is drawn, not a step. Each body says itself what in it a visitor may touch.
 */
export const ConsoleFrame = forwardRef<HTMLDivElement, ConsoleFrameProps>(function ConsoleFrame({ page, description, notice, onPage, onPageIntent, children, className, ...panel }, ref) {
  return (
    <div ref={ref} {...panel} className={clsx("flex h-[var(--frame-h,680px)] flex-col overflow-hidden rounded-frame bg-bg text-text shadow-float", className)}>
      <p className="sr-only" aria-live="polite">
        {description}
      </p>
      {/* The app bar: its pages take a click (no tab stop, and hidden from screen readers, who have the tablist). */}
      <div className="flex h-12 shrink-0 items-center gap-8 border-b border-line px-5">
        <span aria-hidden="true" className="select-none">
          <Wordmark size="sm" />
        </span>
        <span aria-hidden="true" className="flex h-full items-center gap-5 text-ui">
          {TOUR.chrome.pages.map((p) =>
            p === "New recall" ? (
              <span key={p} className="flex h-full items-center text-muted">
                {p}
              </span>
            ) : (
              <button
                key={p}
                type="button"
                tabIndex={-1}
                onClick={() => onPage?.(p)}
                onPointerEnter={() => onPageIntent?.(p)}
                className={clsx(styles.chromePage, "h-full cursor-pointer", p === page ? "text-text" : "text-muted hover:text-text-2")}
              >
                {p}
              </button>
            ),
          )}
        </span>
        <span className="ml-auto flex min-w-0 items-baseline gap-5 text-ui whitespace-nowrap select-none">
          {notice}
          <span aria-hidden="true" className="flex items-baseline gap-2">
            <span className="text-text-2">{TOUR.recall.product}</span>
            <span className="font-mono text-muted">{TOUR.recall.id}</span>
            {/* Room for it beside a filter's notice only on a wide window. */}
            <span className={clsx("text-muted", notice && "max-2xl:hidden")}>
              <span className="text-faint">· </span>
              {TOUR.recall.autoPay}
            </span>
          </span>
        </span>
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
});
