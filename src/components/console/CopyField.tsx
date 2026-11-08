"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/ui";

/** A read-only mono value with a Copy button that confirms in place. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied("yes");
    } catch {
      setCopied("no");
    }
    setTimeout(() => setCopied(null), 2000);
  };
  return (
    <div className="flex min-w-0 items-stretch overflow-hidden rounded-control border border-line-strong bg-surface">
      <input
        readOnly
        value={value}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-ui text-text focus-visible:outline-none"
      />
      <button
        type="button"
        onClick={copy}
        aria-label={copied === "yes" ? `${label} copied` : `Copy ${label.toLowerCase()}`}
        className="inline-flex min-w-20 shrink-0 items-center justify-center gap-1.5 border-l border-line-strong px-3 text-ui font-medium text-text hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        {copied === "yes" ? (
          <>
            <CheckIcon className="text-pay" /> Copied
          </>
        ) : copied === "no" ? (
          "Select it"
        ) : (
          "Copy"
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied === "yes" ? "Copied to the clipboard" : ""}
      </span>
    </div>
  );
}
