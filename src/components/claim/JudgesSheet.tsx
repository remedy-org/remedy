"use client";

import { useRef, type ReactNode } from "react";
import { CrossIcon } from "@/components/ui";

/** Below 1200px the judges' notes live behind a pill that opens them as a bottom sheet (a modal dialog). */
export function JudgesSheet({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        className="micro inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-text shadow-float transition-colors duration-160 hover:bg-surface-2"
      >
        <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
        For judges
      </button>
      <dialog
        ref={ref}
        aria-label="Notes for judges"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-[16px] bg-surface p-0 text-text shadow-float backdrop:bg-[oklch(0_0_0/0.5)]"
      >
        <div className="mx-auto flex max-w-[30rem] flex-col gap-4 px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <span className="mx-auto h-1 w-10 rounded-full bg-line-strong" aria-hidden="true" />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => ref.current?.close()} aria-label="Close the notes" className="-mt-2 flex size-11 items-center justify-center rounded-control text-muted hover:text-text">
              <CrossIcon />
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
