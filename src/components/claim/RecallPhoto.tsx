"use client";

import { useRef } from "react";

/**
 * A phone's small CPSC photo beside the recall line, as a button: it opens the photo full width with CPSC's caption, so
 * an owner can say "that's ours" before logging in. Escape, the close button or a tap outside it closes it.
 */
export function RecallPhoto({ url, caption, product }: { url: string; caption?: string; product: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
        aria-label={`See CPSC's photo of the recalled ${product}`}
        className="shrink-0 rounded-control bg-paper p-1 ring-1 ring-line transition-shadow duration-160 hover:ring-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" width={64} height={64} className="block size-16 object-contain mix-blend-multiply" />
      </button>
      <dialog
        ref={dialog}
        aria-label={`CPSC's photo of the recalled ${product}`}
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
