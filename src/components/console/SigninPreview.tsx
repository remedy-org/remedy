"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { Wordmark } from "@/components/ui";
import type { PreviewRow } from "./ClaimsGridPreview";
import { TABS } from "./StatusTabs";

const ClaimsGrid = dynamic(() => import("./ClaimsGrid").then((m) => m.ClaimsGrid), { ssr: false });

const LARGE = "(min-width: 1024px)";
const subscribe = (on: () => void) => {
  const m = window.matchMedia(LARGE);
  m.addEventListener("change", on);
  return () => m.removeEventListener("change", on);
};
const noop = () => {};

/**
 * The sign-in page's picture of what is behind it: the claims queue on the shared recall, drawn by the console's own grid
 * (not the homepage's still), flat and at 1:1, ending on the page frame's right edge as the header does, and dissolving at
 * its foot. Laptops only, so a
 * phone never loads the grid. Inert and out of the accessibility tree: the form beside it says what it is in words. It
 * fades in once the grid has drawn, over an empty frame of the same size, so nothing moves.
 */
export function SigninPreview({ rows, height }: { rows: PreviewRow[]; height: number }) {
  const large = useSyncExternalStore(subscribe, () => window.matchMedia(LARGE).matches, () => false);
  const [ready, setReady] = useState(false);
  if (!large) return null;
  return (
    <div
      aria-hidden="true"
      inert
      className="pointer-events-none relative w-full select-none [mask-image:linear-gradient(to_bottom,#000_62%,transparent_96%)]"
    >
      {/* A window's edge in both themes: one hairline border (the mask would clip a ring drawn outside it), no lift. */}
      <div className="overflow-hidden rounded-card border border-line-2 bg-surface text-text">
        <div className="flex h-12 items-center gap-6 border-b border-line bg-surface-2 px-5">
          <Wordmark />
          <span className="flex gap-5 font-display text-ui font-medium">
            <span className="text-accent-text">Claims</span>
            <span className="text-muted">Insights</span>
            <span className="text-muted">New recall</span>
            <span className="text-muted">Report</span>
          </span>
          <span className="ml-auto text-ui text-muted">Recall team</span>
        </div>
        <div className="px-5 pt-5">
          <p className="font-display text-head-sm font-medium">X-VESOLJE Nursing Pillows</p>
          {/* The tabs by name alone: their counts are the live console's to give. Each on one line; a narrow window clips
              the last behind a fade, as the console's own strip does on a phone. */}
          <div className="mt-3 flex overflow-hidden border-b border-line [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)]">
            {TABS.map((t, i) => (
              <span key={t.id} className={clsx("relative inline-flex min-h-11 shrink-0 items-center px-3 text-ui font-medium whitespace-nowrap first:pl-0", i === 0 ? "text-accent-text after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-accent first:after:left-0" : "text-muted")}>
                {t.label}
              </span>
            ))}
          </div>
        </div>
        {/* The queue flush in the window, as the homepage tour draws it: no wrapper border or radius inside the window's
            own edge (a box in a box), the window's ground under the rows and the header. */}
        <div
          className={clsx(
            "px-5 pt-3 transition-opacity duration-500 ease-out",
            "[&_.ag-root-wrapper]:rounded-none [&_.ag-root-wrapper]:border-0 [&_.ag-root-wrapper]:[--ag-wrapper-border:none] [&_.ag-root-wrapper]:[--ag-wrapper-border-radius:0]",
            "[&_.ag-root-wrapper]:[--ag-background-color:var(--bg)] [&_.ag-root-wrapper]:[--ag-data-background-color:var(--bg)] [&_.ag-root-wrapper]:[--ag-chrome-background-color:var(--bg)] [&_.ag-root-wrapper]:[--ag-odd-row-background-color:var(--bg)] [&_.ag-root-wrapper]:[--ag-header-background-color:var(--bg)]",
            ready ? "opacity-100" : "opacity-0",
          )}
          style={{ height }}
        >
          <ClaimsGrid rows={rows} openId={null} onOpen={noop} onReady={() => setReady(true)} fill keepOrder />
        </div>
      </div>
    </div>
  );
}
