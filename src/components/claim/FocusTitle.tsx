"use client";

import { useEffect } from "react";

/**
 * Focuses a step's heading, and brings it to the middle of the screen when it is off it: on a short or zoomed screen a
 * step's photo can fill the first screen, and focus no one can see is lost. A heading already in view stays put.
 */
export function focusInView(el: HTMLElement | null) {
  if (!el) return;
  el.focus({ preventScroll: true });
  const { top, bottom } = el.getBoundingClientRect();
  if (top < 0 || bottom > window.innerHeight) el.scrollIntoView({ block: "center" });
}

/** Moves focus to a screen's h2 once it mounts: the result replaces the checking step after router.refresh(). */
export function FocusTitle({ id }: { id: string }) {
  useEffect(() => {
    focusInView(document.getElementById(id));
  }, [id]);
  return null;
}
