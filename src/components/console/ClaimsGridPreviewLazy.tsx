"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ClaimsGridPreviewProps } from "./ClaimsGridPreview";

// The grid's JS (AG Grid, about 240KB) loads only when the preview is a viewport away, never with the homepage, and
// never below `from` px (720 by default; the homepage's tour, whose phones get a story instead, passes 1024).
const Preview = dynamic(() => import("./ClaimsGridPreview").then((m) => m.ClaimsGridPreview), { ssr: false });

/**
 * ClaimsGridPreview for the homepage: the fallback (a complete still) until the real grid has drawn its rows. The grid
 * mounts hidden under the fallback once the section is one viewport away, and takes its place only while the frame is
 * out of view, so a reader never sees it blank or change (an anchor jump straight to it keeps the still until they
 * scroll away, or, with `swapOnPick`, until they pick a step of the tour: a change they asked for, which the grid's
 * 160ms fade in rides on). The whole frame is a product shot: inert, so nothing in it takes a click or a tab stop.
 * Mount it from a server component with previewProps() (components/console/preview.ts):
 *   <ClaimsGridPreviewLazy {...previewProps()} fallback={<StaticStill />} />
 */
export function ClaimsGridPreviewLazy({
  fallback,
  from = 720,
  onSwap,
  swapOnPick = false,
  interactive = false,
  className,
  ...props
}: ClaimsGridPreviewProps & {
  fallback?: ReactNode;
  from?: number;
  /** The grid has taken the fallback's place. */
  onSwap?: () => void;
  /** The visitor has picked a step: the grid may take the still's place now, in view, with a 160ms fade. */
  swapOnPick?: boolean;
  /**
   * Once the real grid is in, a visitor may touch it: scroll its rows, sort a column, see a row light up under the
   * pointer. Nothing in it takes a tab stop (the grid's cells and headers take no focus in its still mode). Otherwise
   * it is a picture: inert.
   */
  interactive?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  // The grid replaces the still once it has drawn and the frame is out of view; once swapped, the grid stays.
  const [swapped, setSwapped] = useState(false);
  // In view, the still stays under the fading grid for its 160ms, then goes.
  const [stillGone, setStillGone] = useState(false);
  const seen = useRef({ ready: false, inView: false, pick: swapOnPick });
  const settle = () => {
    if (seen.current.ready && (!seen.current.inView || seen.current.pick)) setSwapped(true);
  };
  useEffect(() => {
    seen.current.pick = swapOnPick;
    if (swapOnPick && seen.current.ready) setSwapped(true);
  }, [swapOnPick]);
  useEffect(() => {
    if (!swapped || !props.bare) return;
    const t = window.setTimeout(() => setStillGone(true), seen.current.inView ? 200 : 0);
    return () => window.clearTimeout(t);
  }, [swapped, props.bare]);
  const swapNotice = useRef(onSwap);
  useEffect(() => {
    swapNotice.current = onSwap;
  }, [onSwap]);
  useEffect(() => {
    if (swapped) swapNotice.current?.();
  }, [swapped]);

  useEffect(() => {
    const el = ref.current;
    // Phones keep the static replica (its card form): the grid would only draw four still cards there, not worth
    // AG Grid's 240KB.
    if (!el || !window.matchMedia(`(min-width: ${from}px)`).matches) return;
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
    // Measured once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className={clsx("relative", className)} inert={!(interactive && swapped && stillGone)}>
      {(!swapped || (props.bare && !stillGone)) && (fallback ?? <Placeholder height={props.height} />)}
      {near && (
        // Opacity as well as visibility: AG Grid's scrollbars set their own visibility, which shows through a hidden parent.
        // Bare (the tour), the grid always lies over the still, so a swap in view is a fade, never a jump.
        <div
          className={clsx(
            props.bare ? "absolute inset-0 transition-opacity duration-160 ease-snap motion-reduce:transition-none" : !swapped && "absolute inset-x-0 top-0",
            !swapped && "invisible opacity-0",
          )}
        >
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
