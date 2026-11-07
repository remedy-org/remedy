import clsx from "clsx";
import type { ReactNode } from "react";
import { ThemeToggle, Wordmark } from "@/components/ui";

export interface FlowShellProps {
  children: ReactNode;
  /** Judges' demo: a SANDBOX DEMO chip in the header. The judges' rail (WithJudges) says the rest. */
  demo?: boolean;
  /** The company running the recall, for the footer. */
  company?: string;
  /** Kept for the loading skeleton: the recall screen is wide; every step sets its own width inside. */
  wide?: boolean;
}

/**
 * The claim flow's frame: a quiet header, the steps on graphite with the film grain, a plain footer. Each step sets its
 * own width (480px for a card, 640px for the camera and the samples, 960px for the checks).
 */
export function FlowShell({ children, demo, company, wide }: FlowShellProps) {
  return (
    <div className="grain flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Wordmark href="/" />
            {demo && <span className="micro inline-flex h-6 items-center rounded-control border border-line-strong px-2 text-muted">Sandbox demo</span>}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className={clsx("mx-auto w-full max-w-content flex-1 px-4 pt-8 pb-16 sm:px-8 sm:pt-12", wide && "lg:pt-16")}>{children}</main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-content flex-col gap-1 px-4 py-6 text-ui text-faint sm:flex-row sm:justify-between sm:px-8">
          <p>{company ? `Refunds for ${company}'s recall are sent through PayPal Payouts.` : "Refunds are sent through PayPal Payouts."}</p>
          <p>Photos are seen only by Remedy and the company running the recall.</p>
        </div>
      </footer>
    </div>
  );
}
