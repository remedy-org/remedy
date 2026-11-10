import clsx from "clsx";
import type { ReactNode } from "react";
import { RemedyMark } from "@/components/ui/Wordmark";
import { CLAIM } from "./claim";

/**
 * The claim page's own top bar, inside every screen the custody sequence shows: the app chrome's lockup, then, as the
 * claim flow's header has it (FlowShell), a hairline and the recall the claim is for. No step meter: the rail beside it
 * is the sequence's one list of chapters. The console's bar is the For companies tour's: the same lockup, and on the
 * right the recall it shows, its product as CPSC titles it and its number.
 */
export function ScreenBar({ console: isConsole, compact }: { console?: boolean; compact?: boolean }) {
  return (
    <div className={clsx("flex h-12 shrink-0 items-center gap-4 border-b border-line", compact ? "px-4" : "px-6")}>
      {/* The app chrome's lockup (Wordmark sm): 600 at -0.025em, the mark 0.25em from the name on the 18 x 12 pixel grid. */}
      <span className="inline-flex items-baseline gap-[0.25em] text-body font-semibold tracking-[-0.025em]">
        <RemedyMark className="relative top-[0.172px] h-3 w-[1.125rem]" />
        Remedy
      </span>
      {!compact && !isConsole && (
        <>
          <span aria-hidden="true" className="h-4 w-px shrink-0 bg-line-2" />
          <span className="truncate text-ui text-muted">{CLAIM.product} recall</span>
          <span className="ml-auto shrink-0 text-micro text-muted">PayPal sandbox</span>
        </>
      )}
      {isConsole && (
        <span className="ml-auto flex items-baseline gap-2 text-ui whitespace-nowrap">
          <span className="text-text-2">{CLAIM.product}</span>
          <span className="text-muted">
            CPSC <span className="font-mono">{CLAIM.recall.replace(/^CPSC /, "")}</span>
          </span>
        </span>
      )}
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
