import clsx from "clsx";
import type { ReactNode } from "react";
import { AlertIcon } from "./icons";

export interface ErrorStateProps {
  /** What went wrong, plainly: "PayPal didn't answer". */
  title: ReactNode;
  /** What it means and what to do: "Your claim is held, not lost. Try again in a minute." */
  description?: ReactNode;
  /** A retry or a way out. */
  action?: ReactNode;
  /** Mono reference for support, e.g. PayPal's debug id. */
  reference?: string;
  /** inline = a row inside a card; block = fills the view. */
  variant?: "block" | "inline";
  className?: string;
}

export function ErrorState({ title, description, action, reference, variant = "block", className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={clsx(
        "flex gap-3 rounded-card border border-line",
        variant === "block" ? "flex-col items-start px-6 py-8" : "items-start bg-stop-soft px-4 py-3",
        className,
      )}
    >
      <span className={clsx("flex shrink-0 items-center gap-2 text-stop", variant === "inline" && "pt-0.5")}>
        <AlertIcon />
        {variant === "block" && <span className="micro">Error</span>}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-text">{title}</p>
        {description && <p className="mt-1 max-w-read text-ui text-muted">{description}</p>}
        {reference && <p className="mt-2 font-mono text-micro text-faint">Ref {reference}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}
