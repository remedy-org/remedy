"use client";

import clsx from "clsx";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { Wordmark } from "@/components/ui";
import { TOUR } from "./tour-copy";

export interface ConsoleFrameProps extends HTMLAttributes<HTMLDivElement> {
  /** What the step shows, for screen readers: the frame itself is a picture. Announced on each change. */
  description: string;
  /** What a visitor has filtered the page to, with a way out, said in the app bar before the recall. */
  notice?: ReactNode;
  children: ReactNode;
}

/**
 * The homepage tour's one console window (ConsoleTour.tsx): the console's own app bar over a body slot, at a fixed
 * height (680px, or less on a short laptop screen: --frame-h, tour.module.css .stage). It never re-mounts and never
 * changes height: only the body inside it changes. The app bar is the console's (ConsoleNav.tsx) without its page links:
 * the steps over the window are the tour's one set of pages, so the bar carries the Claim Check mark and name, and on
 * the right the recall it shows, where the console's recall switcher sits, with its auto-pay setting. Each body says
 * itself what in it a visitor may touch.
 */
export const ConsoleFrame = forwardRef<HTMLDivElement, ConsoleFrameProps>(function ConsoleFrame({ description, notice, children, className, ...panel }, ref) {
  return (
    <div ref={ref} {...panel} className={clsx("flex h-[var(--frame-h,680px)] flex-col overflow-hidden rounded-frame bg-bg text-text shadow-float", className)}>
      <p className="sr-only" aria-live="polite">
        {description}
      </p>
      <div className="flex h-12 shrink-0 items-center gap-8 border-b border-line px-5">
        <span aria-hidden="true" className="select-none">
          <Wordmark size="sm" />
        </span>
        <span className="ml-auto flex min-w-0 items-baseline gap-5 text-ui whitespace-nowrap select-none">
          {notice}
          <span aria-hidden="true" className="flex items-baseline gap-2">
            <span className="text-text-2">{TOUR.recall.product}</span>
            <span className="text-muted">
              CPSC <span className="font-mono">{TOUR.recall.id}</span>
            </span>
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
