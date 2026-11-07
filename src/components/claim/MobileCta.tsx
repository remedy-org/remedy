"use client";

import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";

/**
 * Phones only: whenever the step's own button is off screen, above (scrolled past) or below (not reached yet), the same
 * action waits in a 72px bar at the bottom (above the home indicator), so it is always on the first screen and reading
 * never means scrolling for it. The bottom 90px count as off screen: iOS Safari's toolbar covers them. `note`: a line the
 * bar carries above the button when the step's own line beside its button would be hidden, such as time running out.
 */
export function MobileCta({ target, label, disabled, note, ...to }: { target: string; label: string; disabled?: boolean; note?: ReactNode } & ({ href: string; onClick?: never } | { onClick(): void; href?: never })) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.getElementById(target);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { rootMargin: "0px 0px -90px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);
  return (
    <div
      aria-hidden={!show}
      inert={!show}
      data-mobile-cta=""
      data-cta-shown={show ? "" : undefined}
      className={clsx(
        "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/92 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-[translate,opacity] duration-160 ease-snap sm:hidden",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      {note && <p className="mb-2.5 text-ui font-medium text-text">{note}</p>}
      {to.href !== undefined ? (
        <Button href={to.href} size="lg" block prefetch={false} tabIndex={show ? 0 : -1} disabled={disabled}>
          {label}
        </Button>
      ) : (
        <Button size="lg" block onClick={to.onClick} tabIndex={show ? 0 : -1} disabled={disabled}>
          {label}
        </Button>
      )}
    </div>
  );
}
