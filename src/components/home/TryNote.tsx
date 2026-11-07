import clsx from "clsx";
import type { CSSProperties } from "react";
import { judgeLogin } from "@/lib/demo/judgeLogin";

/** Under each "try the samples" link: where the judges' sandbox login is (on /try itself when it's set), and whose money. */
export function TryNote({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <p className={clsx("font-mono text-micro text-faint", className)} style={style}>
      {judgeLogin("personal") ? "Test login provided on the next page" : "Test login in the submission notes"} · sandbox money
    </p>
  );
}
