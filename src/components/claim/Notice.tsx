import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Something the owner has to know before the step's action, on the page and not in a box: one sentence-case line of
 * what happened on a 2px rule (red when something went wrong, neutral for a limit), and one line of what to do. No
 * eyebrow, no icon: the rule and the words carry it. `id`: it can take focus (FocusTitle), so a notice already on the
 * page when it loads is read out.
 */
export function Notice({ id, title, children, tone = "stop", role = "alert", className }: { id?: string; title: ReactNode; children?: ReactNode; tone?: "stop" | "neutral"; role?: "alert" | "status"; className?: string }) {
  return (
    <div
      id={id}
      tabIndex={id ? -1 : undefined}
      role={role}
      className={clsx(
        "flex flex-col gap-1 border-l-2 pl-4",
        tone === "stop" ? "border-stop" : "border-line-strong",
        id && "outline-hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus",
        className,
      )}
    >
      <p className="text-body font-medium text-pretty text-text">{title}</p>
      {children && <div className="text-ui text-pretty text-muted">{children}</div>}
    </div>
  );
}
