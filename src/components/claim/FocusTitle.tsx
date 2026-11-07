"use client";

import { useEffect } from "react";

/** Moves focus to a screen's h2 once it mounts: the result replaces the checking step after router.refresh(). */
export function FocusTitle({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.focus({ preventScroll: true });
  }, [id]);
  return null;
}
