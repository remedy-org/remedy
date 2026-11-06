import clsx from "clsx";
import type { Decision } from "@/lib/types";

export type Status = Decision;

const styles: Record<Status, { label: string; className: string; dot: string }> = {
  paid: { label: "Paid", className: "bg-pay-soft text-pay", dot: "bg-pay" },
  held: { label: "Held", className: "bg-hold-soft text-hold", dot: "bg-hold" },
  rejected: { label: "Rejected", className: "bg-stop-soft text-stop", dot: "bg-stop" },
  // Blocked = stopped by a pre-check before the model; a hollow dot tells it apart from Rejected.
  blocked: { label: "Blocked", className: "bg-stop-soft text-stop", dot: "border border-stop" },
  pending: { label: "In progress", className: "bg-surface-2 text-muted", dot: "border border-muted" },
};

export interface StatusPillProps {
  status: Status;
  /** Replaces the default word, e.g. "Paid · SUCCESS". Keep it short. */
  label?: string;
  className?: string;
}

/** A dot then a word, in the state's soft background. Never colour alone. */
export function StatusPill({ status, label, className }: StatusPillProps) {
  const s = styles[status];
  return (
    <span className={clsx("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-ui font-medium whitespace-nowrap", s.className, className)}>
      <span className={clsx("size-1.5 shrink-0 rounded-full", s.dot)} aria-hidden="true" />
      {label ?? s.label}
    </span>
  );
}

export const statusLabel = (status: Status) => styles[status].label;
