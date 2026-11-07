import clsx from "clsx";
import type { CSSProperties } from "react";

/** Under each "try the samples" link: the judges' sandbox login is shown on /try itself, and whose money. */
export function TryNote({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <p className={clsx("font-mono text-micro text-faint", className)} style={style}>
      Sandbox login on the next page · sandbox money
    </p>
  );
}
