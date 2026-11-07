"use client";

import { useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CrossIcon } from "@/components/ui";

/** FlowShell's header slot beside the SANDBOX DEMO chip, where the pill docks so it never floats over a step. */
export const JUDGES_DOCK_ID = "judges-dock";

const noop = () => () => {};

/**
 * Below 1200px the judges' notes live behind a 32px pill in the header that opens them as a bottom sheet (a modal
 * dialog). The pill renders into the header's slot once the page has hydrated.
 */
export function JudgesSheet({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const dock = useSyncExternalStore(
    noop,
    () => document.getElementById(JUDGES_DOCK_ID),
    () => null,
  );
  const pill = (
    <button
      type="button"
      onClick={() => ref.current?.showModal()}
      aria-haspopup="dialog"
      className="micro inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 whitespace-nowrap text-text transition-colors duration-160 after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[''] hover:bg-surface-2 relative"
    >
      <span className="size-1.5 rounded-full bg-faint" aria-hidden="true" />
      <span className="max-[399px]:hidden">For judges</span>
      <span className="min-[400px]:hidden">Judges</span>
    </button>
  );
  return (
    <>
      {dock && createPortal(pill, dock)}
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
