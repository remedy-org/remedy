"use client";

import { useRef } from "react";

/**
 * CPSC's photo across the compact brief (below 1024px), on its paper plate, as a button: big enough to tell the three
 * pillows apart, with "Enlarge" on it, and a tap opens it full width with CPSC's caption, so an owner can say "that's
 * ours" before logging in. Escape, the close button or a tap outside it closes it.
 */
export function RecallPhoto({ url, caption, product }: { url: string; caption?: string; product: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
        aria-label={`Enlarge CPSC’s photo of the recalled ${product}`}
        className="group relative flex h-28 w-full items-center justify-center rounded-control bg-paper p-2 ring-1 ring-line brightness-[0.84] transition-shadow duration-160 hover:ring-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus in-data-[theme=light]:brightness-100"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="block max-h-full w-auto max-w-full object-contain mix-blend-multiply" />
        <span aria-hidden="true" className="absolute right-1.5 bottom-1.5 inline-flex h-6 items-center gap-1 rounded-[4px] bg-paper px-1.5 text-micro font-medium text-ink ring-1 ring-paper-line">
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" aria-hidden="true">
            <circle cx="5.25" cy="5.25" r="3.5" />
            <path d="M7.9 7.9l2.6 2.6" />
          </svg>
          Enlarge
        </span>
      </button>
      <dialog
        ref={dialog}
        aria-label={`CPSC’s photo of the recalled ${product}`}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100%-2rem),40rem)] max-w-none overflow-y-auto rounded-card bg-surface p-0 text-text shadow-float backdrop:bg-[oklch(0_0_0/0.6)]"
      >
        <figure className="flex flex-col gap-3 p-4">
          <div className="rounded-control bg-paper p-4 ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={caption ? "" : `The recalled ${product}`} className="mx-auto block max-h-[60dvh] w-auto max-w-full object-contain mix-blend-multiply" />
          </div>
          {caption && <figcaption className="text-ui text-pretty text-muted">{caption}</figcaption>}
          <form method="dialog" className="flex justify-end">
            <button type="submit" className="inline-flex min-h-11 items-center rounded-control px-3 text-ui font-medium text-text hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus">
              Close
            </button>
          </form>
        </figure>
      </dialog>
    </>
  );
}
