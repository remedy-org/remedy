"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ClaimsGridPreviewProps } from "./ClaimsGridPreview";

// The grid's JS (AG Grid, about 240KB) loads only when the preview is a viewport away, never with the homepage.
const Preview = dynamic(() => import("./ClaimsGridPreview").then((m) => m.ClaimsGridPreview), { ssr: false, loading: () => null });

/**
 * ClaimsGridPreview for the homepage: a same-size placeholder until the section is one viewport away, then the real
 * grid. Mount it from a server component with previewProps() (components/console/preview.ts):
 *   <ClaimsGridPreviewLazy {...previewProps()} />
 */
export function ClaimsGridPreviewLazy(props: ClaimsGridPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative">
      {near ? <Preview {...props} /> : <Placeholder height={props.height} />}
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
