import clsx from "clsx";
import type { ReactNode } from "react";
import { RemedyMark } from "@/components/ui/Wordmark";
import { CLAIM } from "./claim";

/**
 * The claim page's own top bar, inside every screen the custody sequence shows: the app chrome's lockup, then, as the
 * claim flow's header has it (FlowShell), a hairline and the recall the claim is for. No step meter: the rail beside it
 * is the sequence's one list of chapters. The console's bar carries the recall's CPSC number instead.
 */
export function ScreenBar({ console: isConsole, compact }: { console?: boolean; compact?: boolean }) {
  return (
    <div className={clsx("flex h-12 shrink-0 items-center gap-4 border-b border-line", compact ? "px-4" : "px-6")}>
      {/* The app chrome's lockup (Wordmark sm): 600 at -0.025em, the mark 0.25em from the name on the 18 x 12 pixel grid. */}
      <span className="inline-flex items-baseline gap-[0.25em] text-body font-semibold tracking-[-0.025em]">
        <RemedyMark className="relative top-[0.172px] h-3 w-[1.125rem]" />
        {isConsole ? "Console" : "Remedy"}
      </span>
      {!compact && !isConsole && (
        <>
          <span aria-hidden="true" className="h-4 w-px shrink-0 bg-line-2" />
          <span className="truncate text-ui text-muted">{CLAIM.product} recall</span>
        </>
      )}
      {isConsole && <span className="ml-auto font-mono text-micro text-faint">{CLAIM.recall}</span>}
    </div>
  );
}

/** A phone at 1:1: 320px of real UI, radius 32, a hairline. Not a device mock-up, just the screen's edge. */
export function PhoneFrame({ children, className, bar }: { children: ReactNode; className?: string; bar?: boolean }) {
  return (
    <div className={clsx("w-80 max-w-full overflow-hidden rounded-[2rem] border border-line bg-bg shadow-float", className)}>
      {bar && <ScreenBar compact />}
      {children}
    </div>
  );
}
