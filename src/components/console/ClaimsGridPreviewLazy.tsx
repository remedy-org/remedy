"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ClaimsGridPreviewProps } from "./ClaimsGridPreview";

// The grid's JS (AG Grid, about 240KB) loads only when the preview is a viewport away, never with the homepage, and
// never below 720px.
const GRID_FROM = "(min-width: 720px)";
const Preview = dynamic(() => import("./ClaimsGridPreview").then((m) => m.ClaimsGridPreview), { ssr: false });

/**
 * ClaimsGridPreview for the homepage: the fallback (a complete still) until the real grid has drawn its rows. The grid
 * mounts hidden under the fallback once the section is one viewport away, and takes its place only while the frame is
 * out of view, so a reader never sees it blank or change (an anchor jump straight to it keeps the still until they
 * scroll away). The whole frame is a product shot: inert, so nothing in it takes a click or a tab stop.
 * Mount it from a server component with previewProps() (components/console/preview.ts):
 *   <ClaimsGridPreviewLazy {...previewProps()} fallback={<StaticStill />} />
 */
export function ClaimsGridPreviewLazy({ fallback, ...props }: ClaimsGridPreviewProps & { fallback?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  // The grid replaces the still once it has drawn and the frame is out of view; once swapped, the grid stays.
  const [swapped, setSwapped] = useState(false);
  const seen = useRef({ ready: false, inView: false });
  const settle = () => {
    if (seen.current.ready && !seen.current.inView) setSwapped(true);
  };

  useEffect(() => {
    const el = ref.current;
    // Phones keep the static replica (its card form): the grid would only draw four still cards there, not worth
    // AG Grid's 240KB.
    if (!el || !window.matchMedia(GRID_FROM).matches) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "100% 0px" });
    const view = new IntersectionObserver(([e]) => {
      seen.current.inView = e.isIntersecting;
      settle();
    });
    io.observe(el);
    view.observe(el);
    return () => {
      io.disconnect();
      view.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className="relative" inert>
      {!swapped && (fallback ?? <Placeholder height={props.height} />)}
      {near && (
        // Opacity as well as visibility: AG Grid's scrollbars set their own visibility, which shows through a hidden parent.
        <div className={clsx(!swapped && "invisible absolute inset-x-0 top-0 opacity-0")}>
          <Preview
            {...props}
            onReady={() => {
              seen.current.ready = true;
              settle();
            }}
          />
        </div>
      )}
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
