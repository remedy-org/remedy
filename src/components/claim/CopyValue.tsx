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
        // Text-style, not a raised key: a helper beside the value, never competing with the page's one action.
        className="relative inline-flex h-8 min-w-[4.5rem] shrink-0 items-center justify-center gap-1.5 rounded-button px-2.5 text-ui font-medium text-muted transition-[background-color,color,scale] duration-160 ease-snap after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] hover:bg-surface-3 hover:text-text active:scale-[0.96] active:bg-surface-3 active:text-text active:duration-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
