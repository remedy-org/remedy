import clsx from "clsx";
import type { ReactNode } from "react";
import { RemedyMark } from "@/components/ui/Wordmark";
import { CLAIM } from "./claim";

/**
 * The claim page's own top bar, inside every screen the custody sequence shows: recall, then the claim app's step meter.
 * The meter has no number: the rail beside it is the sequence's one counter (01 to 06).
 */
export function ScreenBar({ step, console: isConsole, compact }: { step: number; console?: boolean; compact?: boolean }) {
  return (
    <div className={clsx("flex h-12 shrink-0 items-center gap-4 border-b border-line", compact ? "px-4" : "px-6")}>
      {/* The app chrome's lockup (Wordmark sm): 600 at -0.025em, the mark 0.25em from the name on the 18 x 12 pixel grid. */}
      <span className="inline-flex items-baseline gap-[0.25em] text-body font-semibold tracking-[-0.025em]">
        <RemedyMark className="relative top-[0.172px] h-3 w-[1.125rem]" />
        {isConsole ? "Console" : "Remedy"}
      </span>
      {!compact && <span className="truncate text-ui text-muted">Kikea X-VESOLJE nursing pillow</span>}
      <span className="ml-auto flex items-center gap-3">
        {!isConsole && (
          <span className="flex gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((s) => (
              <span key={s} className={clsx("h-0.5 rounded-full transition-colors duration-160", compact ? "w-3" : "w-5", s === step ? "bg-accent" : s < step ? "bg-muted" : "bg-line-strong/50")} />
            ))}
          </span>
        )}
        {isConsole && <span className="micro text-faint">{CLAIM.recall}</span>}
      </span>
    </div>
  );
}

/** A phone at 1:1: 320px of real UI, radius 32, a hairline. Not a device mock-up, just the screen's edge. */
export function PhoneFrame({ children, className, step }: { children: ReactNode; className?: string; step?: number }) {
  return (
    <div className={clsx("w-80 max-w-full overflow-hidden rounded-[2rem] border border-line bg-bg shadow-float", className)}>
      {step !== undefined && <ScreenBar step={step} compact />}
      {children}
    </div>
  );
}
