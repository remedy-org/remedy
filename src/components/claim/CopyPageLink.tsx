"use client";

import { useState } from "react";
import { Button, CheckIcon } from "@/components/ui";

/**
 * Copies this page's address, so an owner can come back to a held claim without finding the address bar. A quiet button:
 * underline is for links only.
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
      <Button variant="secondary" size="sm" onClick={copy}>
        {copied === "yes" && <CheckIcon size={14} className="text-pay" />}
        {copied === "yes" ? "Link copied" : copied === "no" ? "Couldn't copy: use the address bar" : "Copy this page's link"}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied === "yes" ? "Link copied" : ""}
      </span>
    </>
  );
}
