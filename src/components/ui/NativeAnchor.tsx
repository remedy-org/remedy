"use client";

import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from "react";

/**
 * A plain link that loads its page as a whole document: a route that redirects off the site (the PayPal login) or files
 * something (a new claim), where the client router's fetch would only fail and run the route twice. Once tapped it marks
 * itself busy (data-pending, aria-busy) and keeps its label until the next page paints; a return from the back/forward
 * cache clears it.
 */
export function NativeAnchor({ onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const reset = () => setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || props.target) return;
    if (pending) e.preventDefault();
    else setPending(true);
  };
  return <a {...props} onClick={click} aria-busy={pending || undefined} data-pending={pending ? "" : undefined} />;
}
