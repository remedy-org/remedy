"use client";

import { useState, type ReactNode } from "react";

/** Remounts its children so their landing animations play again. */
export function StampReplay({ children }: { children: ReactNode }) {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-col items-start gap-4">
      <div key={run} className="contents">
        {children}
      </div>
      <button
        type="button"
        onClick={() => setRun((n) => n + 1)}
        className="inline-flex min-h-11 items-center rounded-control text-ui text-muted underline-offset-4 transition-colors duration-160 hover:text-text hover:underline"
      >
        Replay the landing
      </button>
    </div>
  );
}
