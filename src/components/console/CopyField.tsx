"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/ui";

/** A read-only mono value with a Copy button that confirms in place. secret: shown as dots (a password), still copied whole. */
export function CopyField({ value, label, secret }: { value: string; label: string; secret?: boolean }) {
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
    // The value takes the app's focus ring on the whole field when focused, as the Copy button does on its own.
    <div className="flex min-w-0 items-stretch overflow-hidden rounded-control border border-line-strong bg-surface has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus">
      <input
        readOnly
        type={secret ? "password" : "text"}
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
