import type { ReactNode } from "react";

/** 11px mono keycaps, then what they do. */
export function Keys({ k, children }: { k: string[]; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {k.map((key) => (
        <kbd key={key} className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-line-strong/60 px-1 font-mono text-micro leading-none text-muted">
          {key}
        </kbd>
      ))}
      <span>{children}</span>
    </span>
  );
}
