"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export interface RecallOption {
  id: string;
  product: string;
}

/** Switches the console between a workspace's recalls. Only shown when there is more than one. */
export function RecallPicker({ recalls, current, basePath }: { recalls: RecallOption[]; current: string; basePath: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex items-center gap-2 text-ui text-muted">
      <span className="sr-only">Recall</span>
      <select
        value={current}
        aria-busy={pending || undefined}
        onChange={(e) => start(() => router.push(`${basePath}?recall=${encodeURIComponent(e.target.value)}`))}
        className="h-9 max-w-[60vw] truncate rounded-control border border-line-strong bg-surface px-2 text-ui text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:max-w-[32ch]"
      >
        {recalls.map((r) => (
          <option key={r.id} value={r.id}>
            {r.id} · {r.product}
          </option>
        ))}
      </select>
    </label>
  );
}
