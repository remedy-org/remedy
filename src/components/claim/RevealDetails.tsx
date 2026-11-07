"use client";

import type { DetailsHTMLAttributes } from "react";

/**
 * A <details> that brings what it opens into view: opened from its summary at the foot of the screen, the evidence
 * would otherwise unfold below the fold with nothing visibly happening. Only an open from the summary scrolls (focus is
 * on it), never one rendered open. Instant under reduced motion.
 */
export function RevealDetails(props: Omit<DetailsHTMLAttributes<HTMLDetailsElement>, "onToggle">) {
  return (
    <details
      {...props}
      onToggle={(e) => {
        const details = e.currentTarget;
        if (!details.open || !details.contains(document.activeElement)) return;
        const smooth = matchMedia("(prefers-reduced-motion: no-preference)").matches;
        details.scrollIntoView({ block: "nearest", behavior: smooth ? "smooth" : "auto" });
      }}
    />
  );
}
