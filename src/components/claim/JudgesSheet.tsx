"use client";

import { useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, CrossIcon } from "@/components/ui";

/** FlowShell's header slot beside the wordmark, where the Guide button docks so it never floats over a step. */
export const JUDGES_DOCK_ID = "judges-dock";

const noop = () => () => {};

/**
 * Below 1200px the guide lives behind a quiet 36px button in the header (a button's shape, not a status pill's) that
 * opens it as a bottom sheet (a modal dialog). It renders into the header's slot once the page has hydrated.
 */
export function JudgesSheet({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const dock = useSyncExternalStore(
    noop,
    () => document.getElementById(JUDGES_DOCK_ID),
    () => null,
  );
  const pill = (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        ref.current?.showModal();
        setOpen(true);
      }}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={id}
      className="shrink-0 px-3"
    >
      Guide
    </Button>
  );
  return (
    <>
      {dock && createPortal(pill, dock)}
      {/* tabIndex -1: a scrolling sheet is otherwise a Tab stop of its own in Chromium, ringed in amber. */}
      <dialog
        ref={ref}
        id={id}
        tabIndex={-1}
        aria-label="Guide"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        onClose={() => setOpen(false)}
        className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-[16px] bg-surface p-0 text-text shadow-float outline-none backdrop:bg-[oklch(0_0_0/0.5)]"
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
