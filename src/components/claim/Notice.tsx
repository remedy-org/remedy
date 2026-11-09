import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Something the owner has to know before the step's action, on the page and not in a box: one sentence-case line of
 * what happened on a 2px rule (red when something went wrong, neutral for a limit), and one line of what to do. No
 * eyebrow, no icon: the rule and the words carry it.
 */
export function Notice({ title, children, tone = "stop", role = "alert", className }: { title: ReactNode; children?: ReactNode; tone?: "stop" | "neutral"; role?: "alert" | "status"; className?: string }) {
  return (
    <div role={role} className={clsx("flex flex-col gap-1 border-l-2 pl-4", tone === "stop" ? "border-stop" : "border-line-strong", className)}>
      <p className="text-body font-medium text-pretty text-text">{title}</p>
      {children && <div className="text-ui text-pretty text-muted">{children}</div>}
    </div>
  );
}
