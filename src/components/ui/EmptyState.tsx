import clsx from "clsx";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** What is missing, as a fact: "No claims yet". */
  title: ReactNode;
  /** Why, and what will fill it: "Claims appear here as owners file them." */
  description?: ReactNode;
  /** Usually one secondary Button. */
  action?: ReactNode;
  /** Optional mono eyebrow, e.g. "Recall 27-071". */
  eyebrow?: ReactNode;
  className?: string;
}

/** Centred in a hairline frame, words only: never an illustration. */
export function EmptyState({ title, description, action, eyebrow, className }: EmptyStateProps) {
  return (
    <div className={clsx("flex flex-col items-center gap-3 rounded-card border border-line px-6 py-12 text-center", className)}>
      {eyebrow && <p className="micro text-faint">{eyebrow}</p>}
      <p className="text-body font-medium text-text">{title}</p>
      {description && <p className="max-w-read text-ui text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
