"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/ui";

/**
 * Copies this page's address, so an owner can come back to a held claim without finding the address bar. On paper: ink
 * text and a hairline underline, the paper's ink focus ring.
 */
export function CopyPageLink() {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied("yes");
    } catch {
      setCopied("no");
    }
  };
  return (
    <>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-control text-ui font-medium text-ink underline decoration-paper-line underline-offset-4 hover:decoration-ink"
      >
        {copied === "yes" && <CheckIcon size={14} className="text-pay-ink" />}
        {copied === "yes" ? "Link copied" : copied === "no" ? "Couldn't copy: use the address bar" : "Copy this page's link"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied === "yes" ? "Link copied" : ""}
      </span>
    </>
  );
}
