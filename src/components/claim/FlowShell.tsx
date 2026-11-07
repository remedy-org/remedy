import clsx from "clsx";
import type { ReactNode } from "react";
import { ThemeToggle, Wordmark } from "@/components/ui";

export interface FlowShellProps {
  children: ReactNode;
  /** Judges' demo: labelled in the header and above every step. */
  demo?: boolean;
  /** The company running the recall, for the footer. */
  company?: string;
  /** Two columns on laptops (the recall screen); otherwise one 480px column. */
  wide?: boolean;
}

/** The claim flow's frame: quiet header, one centred column on the graphite background, a plain footer. */
export function FlowShell({ children, demo, company, wide }: FlowShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Wordmark href="/" />
            {demo && (
              <span className="micro inline-flex h-6 items-center rounded-control border border-line-strong px-2 text-muted">Demo</span>
            )}
          </div>
          <ThemeToggle />
        </div>
      </header>

      {demo && (
        <div className="border-b border-line bg-surface-2">
          <p className="mx-auto max-w-content px-4 py-2.5 text-ui text-muted sm:px-8">
            <span className="font-medium text-text">Demo mode.</span> Sample photos instead of your camera, and PayPal sandbox money: nothing here is a real refund.
          </p>
        </div>
      )}

      <main className={clsx("mx-auto w-full flex-1 px-4 pt-8 pb-16 sm:px-8 sm:pt-12", wide ? "max-w-content" : "max-w-[calc(var(--container-claim)+4rem)]")}>{children}</main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-content flex-col gap-1 px-4 py-6 text-ui text-faint sm:flex-row sm:justify-between sm:px-8">
          <p>{company ? `Refunds for ${company}'s recall are paid through PayPal Payouts.` : "Refunds are paid through PayPal Payouts."}</p>
          <p>Photos are seen only by Remedy and the company running the recall.</p>
        </div>
      </footer>
    </div>
  );
}
