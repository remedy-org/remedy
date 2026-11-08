"use client";

import { useLinkStatus } from "next/link";
import { useEffect, useRef } from "react";

/**
 * Inside a Link: while its page is on its way (a dynamic page the router hasn't prefetched), the link marks itself busy
 * (data-pending, aria-busy), so the current screen stays put with the tapped control quietened, in place of a skeleton.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const a = ref.current?.closest("a");
    if (!a) return;
    a.toggleAttribute("data-pending", pending);
    if (pending) a.setAttribute("aria-busy", "true");
    else a.removeAttribute("aria-busy");
  }, [pending]);
  return <span ref={ref} hidden />;
}
