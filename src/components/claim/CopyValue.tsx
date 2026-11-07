"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/ui";

/**
 * Copies the text of its row's [data-copy-value], read from the page, so the value itself never travels in a prop to
 * the client: it reaches the browser only as the text the server rendered.
 */
export function CopyValue({ label }: { label: string }) {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const copy = async (button: HTMLButtonElement) => {
    const value = button.closest("[data-copy]")?.querySelector("[data-copy-value]")?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(value);
      setCopied("yes");
    } catch {
      setCopied("no");
    }
    setTimeout(() => setCopied(null), 2000);
  };
  return (
    <>
      <button
        type="button"
        onClick={(e) => copy(e.currentTarget)}
        aria-label={copied === "yes" ? `${label} copied` : `Copy the ${label}`}
        className="relative inline-flex h-8 min-w-[4.5rem] shrink-0 items-center justify-center gap-1.5 rounded-control px-2.5 text-ui font-medium text-text shadow-[inset_0_0_0_1px_var(--line-2)] transition-colors duration-160 after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {copied === "yes" ? (
          <>
            <CheckIcon size={14} className="text-pay" /> Copied
          </>
        ) : copied === "no" ? (
          "Select it"
        ) : (
          "Copy"
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied === "yes" ? `${label} copied to the clipboard` : ""}
      </span>
    </>
  );
}
