"use client";

import clsx from "clsx";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { Button, CrossIcon } from "@/components/ui";
import { Keys } from "./Keys";
import { LinkedIds } from "./LinkedIds";
import type { reviewLabels } from "./ReviewActions";

export interface PhotoViewerProps {
  claimId: string;
  /** The claim's photo routes; the viewer loads each at full size. */
  photos: string[];
  /** The photo that was clicked (0-based). */
  start: number;
  /** Opens zoomed on this spot (0 to 1), as Zoom to tag does. */
  zoomAt?: { x: number; y: number } | null;
  /** The one-time code the tag must read: on top, beside the photos it is checked against. */
  code?: string;
  /** What decided a held or refused claim, as the panel's heading says it: the question to look at the photos with. */
  question?: { title: string; detail?: string | null } | null;
  /** Held: approve or reject from here. The viewer closes and the panel's footer opens the same confirm. */
  onReview?: (mode: "approve" | "reject") => void;
  /** The panel's names for those actions, and which leads (reviewLabels): the viewer says them the same way. */
  labels?: ReturnType<typeof reviewLabels>;
  /** Opens a claim the question names, in the panel. */
  onOpen?: (id: string) => void;
  onClose: () => void;
}

// How far a click zooms in: enough to read the weave of the fabric and the tag's pen strokes.
const ZOOM = 3;

/**
 * The photos full size, over the console, as prints on a light table: every photo of the claim side by side at one
 * height, each frame the photo's own shape (no matte), with the claim id and the question that held it on top. A click
 * zooms every photo into the same spot, and moving the pointer moves them together, so two photos of one item can be
 * compared fibre by fibre; a second click (or Esc) zooms back out. A and R approve or reject from here as in the panel
 * (the viewer closes on the panel's confirm, which takes the second A), ← and → move between the photos where one shows
 * at a time, Esc goes back to the panel. On a phone it shows one photo at a time.
 */
export function PhotoViewer({ claimId, photos, start, zoomAt, code, question, onReview, labels, onOpen, onClose }: PhotoViewerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const figures = useRef<(HTMLElement | null)[]>([]);
  const [current, setCurrent] = useState(start);
  // Each photo's width over its height, once loaded; the table's room; and where the photos are zoomed (0 to 1), if they are.
  const [ratios, setRatios] = useState<(number | null)[]>(() => photos.map(() => null));
  const table = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(zoomAt ?? null);
  useLayoutEffect(() => {
    const el = table.current;
    if (!el) return;
    const measure = () => {
      const s = getComputedStyle(el);
      const px = (v: string) => Number.parseFloat(v) || 0;
      setRoom({ w: el.clientWidth - px(s.paddingLeft) - px(s.paddingRight), h: el.clientHeight - px(s.paddingTop) - px(s.paddingBottom) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // One height for every photo shown, as tall as the table allows and as wide as their shapes fit side by side (a 16px
  // gap, the caption's 24px under each). A phone shows one at a time.
  const GAP = 16;
  const CAPTION = 24;
  const shown = room && room.w < 640 ? [current] : photos.map((_, i) => i);
  const known = shown.every((i) => ratios[i]);
  const height = room && known ? Math.max(80, Math.min(room.h - CAPTION, (room.w - GAP * (shown.length - 1)) / shown.reduce((n, i) => n + ratios[i]!, 0))) : null;
  const at = (e: MouseEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)), y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)) };
  };

  useEffect(() => {
    ref.current?.showModal();
    figures.current[start]?.focus();
  }, [start]);

  const go = (step: number) => {
    const next = (current + step + photos.length) % photos.length;
    setCurrent(next);
    figures.current[next]?.focus();
  };
  const review = (mode: "approve" | "reject") => {
    onReview?.(mode);
    ref.current?.close();
  };

  return (
    <dialog
      ref={ref}
      // React bubbles close through its own tree: on tablets and phones the viewer sits inside the evidence sheet, itself
      // a dialog, which must stay open.
      onClose={(e) => {
        e.stopPropagation();
        onClose();
      }}
      // Esc zooms back out first; the next one goes back to the evidence.
      onCancel={(e) => {
        if (!zoom) return;
        e.preventDefault();
        setZoom(null);
      }}
      onKeyDown={(e) => {
        // The panel's keys, where the call is made: A opens the approve confirm (A again pays), R the reason.
        if (onReview && labels && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) {
          const key = e.key.toLowerCase();
          if ((key === "a" && !labels.blocked) || key === "r") {
            e.preventDefault();
            return review(key === "a" ? "approve" : "reject");
          }
        }
        if (photos.length < 2 || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        e.preventDefault();
        go(e.key === "ArrowRight" ? 1 : -1);
      }}
      aria-labelledby="viewer-title"
      className="fixed inset-0 m-auto flex h-[calc(100dvh-2rem)] max-h-none w-[calc(100vw-2rem)] max-w-none flex-col overflow-hidden rounded-card bg-surface p-0 text-text shadow-float backdrop:bg-[oklch(0.1_0.004_75/0.7)]"
    >
      <header className="flex items-start gap-4 border-b border-line px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 id="viewer-title" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-body font-medium">{claimId}</span>
            <span className="text-ui text-muted">{photos.length === 1 ? "1 photo" : `${photos.length} photos`}</span>
          </h2>
          {question && (
            <p className="mt-1 text-ui text-muted">
              <span className="text-text">
                <LinkedIds text={question.title} onOpen={onOpen} self={claimId} />
              </span>
              {question.detail && (
                <>
                  {" "}
                  <LinkedIds text={question.detail} onOpen={onOpen} self={claimId} />
                </>
              )}
            </p>
          )}
        </div>
        {code && (
          <p className="flex shrink-0 items-baseline gap-2 self-center text-ui text-muted">
            Tag must read <span className="font-mono text-head-sm font-medium tracking-wide text-text">{code}</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-text"
          aria-label="Back to the evidence"
        >
          <CrossIcon />
        </button>
      </header>

      <div ref={table} className="flex min-h-0 flex-1 items-center justify-center gap-4 p-4 sm:p-5">
        {photos.map((src, i) => {
          const r = ratios[i];
          const size = height && r ? { width: Math.round(height * r), height: Math.round(height) } : undefined;
          return (
            <figure
              key={src}
              ref={(el) => {
                figures.current[i] = el;
              }}
              tabIndex={-1}
              aria-label={`Photo ${i + 1} of ${photos.length}`}
              // A phone shows the current photo alone; wider screens show them all. Until the shapes are known, each
              // takes an even share of the table, unseen, so nothing is drawn at a wrong size.
              className={clsx("flex min-w-0 flex-col gap-2 rounded-control outline-none", !shown.includes(i) && "hidden", !size && "invisible flex-1")}
            >
              <div
                className={clsx("relative overflow-hidden rounded-control ring-1 ring-line", zoom ? "cursor-zoom-out" : "cursor-zoom-in", !size && "h-40")}
                style={size}
                onClick={(e) => {
                  const p = at(e);
                  setZoom((z) => (z ? null : p));
                }}
                onPointerMove={(e) => zoom && setZoom(at(e))}
              >
                {/* A private, session-checked route at full size: next/image's optimizer can't fetch it with the cookie. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Photo ${i + 1} of ${photos.length} for ${claimId}`}
                  draggable={false}
                  onLoad={(e) => {
                    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                    if (w && h) setRatios((rs) => rs.map((v, j) => (j === i ? w / h : v)));
                  }}
                  className="absolute inset-0 size-full object-cover transition-transform duration-160 ease-out select-none motion-reduce:transition-none"
                  style={zoom ? { transform: `scale(${ZOOM})`, transformOrigin: `${zoom.x * 100}% ${zoom.y * 100}%` } : undefined}
                />
              </div>
              <figcaption className={clsx("h-4 text-micro", i === current ? "text-text" : "text-muted")}>
                Photo {i + 1} of {photos.length}
              </figcaption>
            </figure>
          );
        })}
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line px-5 py-3">
        {onReview && labels && (
          // As in the panel's footer: Reject leads, and approve isn't offered, while approve's checks would stop the payout.
          <div className="flex flex-wrap gap-3">
            {!labels.blocked && (
              <Button size="sm" onClick={() => review("approve")}>
                {labels.approve}
              </Button>
            )}
            {/* Amber is for moving money only: a reject is the quiet button even when it leads. */}
            <Button size="sm" variant="secondary" onClick={() => review("reject")}>
              {labels.reject}
            </Button>
          </div>
        )}
        <p className="ml-auto flex items-center gap-4 text-micro text-faint" aria-hidden="true">
          {onReview && labels && !labels.blocked && <Keys k={["A"]}>{labels.approveKey}</Keys>}
          {onReview && labels && <Keys k={["R"]}>Reject</Keys>}
          {/* Only where one photo shows at a time (a phone): wider, every photo is already in view. */}
          {photos.length > 1 && (
            <span className="sm:hidden">
              <Keys k={["←", "→"]}>Switch photo</Keys>
            </span>
          )}
          <span className="hidden sm:inline">{zoom ? "Click to zoom out" : "Click a photo to zoom both"}</span>
          <Keys k={["Esc"]}>{zoom ? "Zoom out" : "Back to the evidence"}</Keys>
        </p>
      </footer>
    </dialog>
  );
}
