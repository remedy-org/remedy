"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

/**
 * Phones only: once the consent button has scrolled up out of view, the same action waits in a 72px bar at the bottom
 * (above the home indicator), so reading the steps never means scrolling back for it.
 */
export function MobileCta({ target, href, label }: { target: string; href: string; label: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.getElementById(target);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.bottom < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [target]);
  return (
    <div
      aria-hidden={!show}
      inert={!show}
      data-cta-shown={show ? "" : undefined}
      className={clsx(
        "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/92 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-[translate,opacity] duration-160 ease-snap sm:hidden",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <Button href={href} size="lg" block prefetch={false} tabIndex={show ? 0 : -1}>
        {label}
      </Button>
    </div>
  );
}
