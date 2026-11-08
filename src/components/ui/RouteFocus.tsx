"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * After a client-side page change, focus returns to the top of the document, before the skip link, so the next Tab is
 * "Skip to content", as on a full page load. A page that focuses its own heading on arrival (a claim step) runs after
 * this and keeps it.
 */
export function RouteFocus() {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(pathname);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    ref.current?.focus({ preventScroll: true });
  }, [pathname]);
  return <div ref={ref} tabIndex={-1} className="sr-only" />;
}
