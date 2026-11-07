"use client";

import dynamic from "next/dynamic";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ClaimsGridPreviewProps } from "./ClaimsGridPreview";

// What shows until the grid's JS arrives: the caller's fallback (the homepage passes its static replica), or a
// same-size placeholder. A context, because next/dynamic's loading component takes no props.
const Fallback = createContext<ReactNode>(null);
const Loading = () => <>{useContext(Fallback)}</>;

// The grid's JS (AG Grid, about 240KB) loads only when the preview is a viewport away, never with the homepage, and
// never below 720px.
const GRID_FROM = "(min-width: 720px)";
const Preview = dynamic(() => import("./ClaimsGridPreview").then((m) => m.ClaimsGridPreview), { ssr: false, loading: Loading });

/**
 * ClaimsGridPreview for the homepage: the fallback until the section is one viewport away, then the real grid.
 * Mount it from a server component with previewProps() (components/console/preview.ts):
 *   <ClaimsGridPreviewLazy {...previewProps()} fallback={<StaticStill />} />
 */
export function ClaimsGridPreviewLazy({ fallback, ...props }: ClaimsGridPreviewProps & { fallback?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    // Phones keep the static replica (its card form): the grid would only draw four still cards there, not worth
    // AG Grid's 240KB.
    if (!el || !window.matchMedia(GRID_FROM).matches) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const still = fallback ?? <Placeholder height={props.height} />;
  return (
    <div ref={ref} className="relative">
      <Fallback.Provider value={still}>{near ? <Preview {...props} /> : still}</Fallback.Provider>
    </div>
  );
}

/** The frame's footprint (chrome, heading, ledger, tabs, grid, footer) so nothing moves when the grid arrives. */
function Placeholder({ height }: { height: number }) {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-frame bg-bg shadow-float">
      <div className="h-12 border-b border-line" />
      <div className="h-[143px] border-b border-line" />
      <div style={{ height: height }} className="p-3 sm:px-5">
        <div className="h-full rounded-card border border-line bg-surface" />
      </div>
      <div className="h-[33px] border-t border-line" />
    </div>
  );
}
