import type { ReactNode } from "react";
import { ThemeToggle, Wordmark } from "@/components/ui";
import { JUDGES_DOCK_ID } from "./JudgesSheet";

export interface FlowShellProps {
  children: ReactNode;
  /** Judges' demo: a SANDBOX DEMO chip in the header. The judges' rail (WithJudges) says the rest. */
  demo?: boolean;
  /** Payouts go to PayPal's sandbox in this build (isSandboxBuild): a SANDBOX chip on every claim page. */
  sandbox?: boolean;
  /** The company running the recall, for the footer. */
  company?: string;
}

/**
 * The claim flow's frame, on the homepage's own page frame (.page: the same gutter, so the wordmark never moves between
 * them): a quiet header, the steps on graphite with the film grain, a plain footer. Each step sets its own width (480px for a card, 640px for the camera and the samples, 960px for the checks).
 */
export function FlowShell({ children, demo, sandbox, company }: FlowShellProps) {
  return (
    <div className="grain flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="page flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Wordmark href="/" />
            {(demo || sandbox) && (
              <span className="micro inline-flex h-6 shrink-0 items-center rounded-control border border-line-strong px-2 whitespace-nowrap text-muted">
                Sandbox<span className={demo ? "max-[399px]:hidden" : "hidden"}>&nbsp;demo</span>
              </span>
            )}
            {/* The judges' pill docks here below 1200px (JudgesSheet). */}
            {demo && <div id={JUDGES_DOCK_ID} className="flex min-[1200px]:hidden" />}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="page flex-1 pt-8 pb-16 sm:pt-12 max-sm:[body:has([data-camera])_&]:pb-6">{children}</main>

      {/* A phone's camera step fills the screen; the footer would only sit under it. */}
      <footer className="border-t border-line max-sm:[body:has([data-camera])_&]:hidden">
        <div className="page flex flex-col gap-1 py-6 text-ui text-faint sm:flex-row sm:justify-between">
          <p>{company ? `Refunds for ${company}'s recall are sent through PayPal Payouts.` : "Refunds are sent through PayPal Payouts."}</p>
          <p>Photos are seen only by Remedy and the company running the recall.</p>
        </div>
      </footer>
    </div>
  );
}
