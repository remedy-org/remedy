import clsx from "clsx";
import type { ReactNode } from "react";
import { RemedyMark } from "@/components/ui/Wordmark";
import { CLAIM } from "./claim";

/**
 * The claim page's own top bar, inside every screen the custody sequence shows: recall, then the step meter. The
 * counter names screens of the claim app, so it never reads as a rival to the five chapters beside it.
 */
export function ScreenBar({ step, console: isConsole, compact }: { step: number; console?: boolean; compact?: boolean }) {
  return (
    <div className={clsx("flex h-12 shrink-0 items-center gap-4 border-b border-line", compact ? "px-4" : "px-6")}>
      <span className="flex items-center gap-2 text-ui font-medium">
        <RemedyMark className="h-3 w-[1.125rem]" />
        {isConsole ? "Console" : "Remedy"}
      </span>
      {!compact && <span className="truncate text-ui text-muted">{isConsole ? CLAIM.company : "Kikea X-VESOLJE nursing pillow"}</span>}
      <span className="ml-auto flex items-center gap-3">
        {!isConsole && (
          <>
            <span className="flex gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((s) => (
                <span key={s} className={clsx("h-0.5 rounded-full transition-colors duration-160", compact ? "w-3" : "w-5", s <= step ? "bg-accent" : "bg-line-strong/50")} />
              ))}
            </span>
            <span className="font-mono text-micro whitespace-nowrap text-faint tabular-nums">Screen {step} of 4</span>
          </>
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
