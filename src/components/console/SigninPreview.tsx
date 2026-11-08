"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import type { Ledger as LedgerData } from "@/app/console/_lib/view";
import { Ledger } from "./Ledger";
import type { PreviewRow } from "./ClaimsGridPreview";
import { StatusTabs, type Tab } from "./StatusTabs";

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
 * (not the homepage's still), flat and at 1:1, running off the right edge and dissolving at its foot. Laptops only, so a
 * phone never loads the grid. Inert and out of the accessibility tree: the form beside it says what it is in words. It
 * fades in once the grid has drawn, over an empty frame of the same size, so nothing moves.
 */
export function SigninPreview({ rows, ledger, counts, height }: { rows: PreviewRow[]; ledger: LedgerData; counts: Record<Tab, number>; height: number }) {
  const large = useSyncExternalStore(subscribe, () => window.matchMedia(LARGE).matches, () => false);
  const [ready, setReady] = useState(false);
  if (!large) return null;
  return (
    <div
      aria-hidden="true"
      inert
      className="pointer-events-none relative w-[1120px] select-none [mask-image:linear-gradient(to_bottom,#000_62%,transparent_96%)]"
    >
      <div className="overflow-hidden rounded-card bg-bg text-text shadow-card">
        <div className="flex h-12 items-center gap-6 border-b border-line px-5">
          <span className="font-semibold tracking-[-0.025em]">Remedy</span>
          <span className="flex gap-5 text-ui font-medium">
            <span className="text-text">Claims</span>
            <span className="text-muted">Insights</span>
            <span className="text-muted">Report</span>
          </span>
          <span className="ml-auto text-ui text-muted">Kikea Store</span>
        </div>
        <div className="px-5 pt-5">
          <p className="text-head-sm font-medium">X-VESOLJE Nursing Pillows</p>
          <Ledger ledger={ledger} className="mt-3" />
          <div className="mt-1 border-b border-line">
            <StatusTabs value="all" counts={counts} onChange={noop} controls="signin-preview" />
          </div>
        </div>
        <div className={clsx("px-5 pt-3 transition-opacity duration-500 ease-out", ready ? "opacity-100" : "opacity-0")} style={{ height }}>
          <ClaimsGrid rows={rows} openId={null} onOpen={noop} onReady={() => setReady(true)} fill />
        </div>
      </div>
    </div>
  );
}
