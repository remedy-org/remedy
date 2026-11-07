"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { EmptyState } from "@/components/ui";
import { ledgerOf, type ClaimRow } from "@/app/console/_lib/view";
import type { Recall } from "@/lib/types";
import { ClaimsGrid, type ClaimsGridHandle } from "./ClaimsGrid";
import { Keys } from "./Keys";
import { formatCount, plural } from "./format";
import { Ledger } from "./Ledger";
import type { ReviewIntent } from "./ReviewActions";
import { StatusTabs, TABS, type Tab } from "./StatusTabs";
import { useQueuePoll, type PollState } from "./useQueuePoll";

// The evidence views load on the first open, not with the page: the queue's first load stays small.
const EvidencePanel = dynamic(() => import("./EvidenceDrawer").then((m) => m.EvidencePanel), { ssr: false, loading: () => <PanelShell /> });
const EvidenceDrawer = dynamic(() => import("./EvidenceDrawer").then((m) => m.EvidenceDrawer), { ssr: false });

function PanelShell() {
  return <div aria-hidden="true" className="h-full w-[440px] shrink-0 rounded-card bg-surface shadow-float" />;
}

const EMPTY_TAB: Record<Exclude<Tab, "all">, { title: string; description: string }> = {
  paid: {
    title: "No paid claims yet",
    description: "A claim is paid when every check passes and auto-pay is on, or when a person approves it.",
  },
  held: {
    title: "Nothing waiting for review",
    description: "Claims with an unclear answer, or any passing claim while auto-pay is off, wait here for a person.",
  },
  rejected: {
    title: "No rejected claims",
    description: "A claim is rejected when the model's answer fails a check, such as a wrong code or label.",
  },
  blocked: {
    title: "No blocked claims",
    description: "Blocked claims never reached the model: a reused photo, an expired camera session or a second claim from one account.",
  },
  pending: {
    title: "Nothing in progress",
    description: "A claim is in progress from the moment its owner gets a code until the photos are checked.",
  },
};

// From 1024px the queue fills the viewport (page.tsx); from 1280px the evidence panel docks beside the grid, which
// keeps its 708px of columns beside the 452px panel. Below that the panel opens as a sheet over the grid.
const FILL = "(min-width: 1024px)";
const WIDE = "(min-width: 1280px)";
function useMedia(query: string) {
  return useSyncExternalStore(
    (on) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", on);
      return () => m.removeEventListener("change", on);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

export interface ClaimsQueueProps {
  recall: Pick<Recall, "id" | "unitsSold">;
  rows: ClaimRow[];
  // When the server read these rows (ISO).
  at: string;
  // Payouts in this build go to PayPal's sandbox: the ledger's money says so.
  sandbox?: boolean;
}

/**
 * The claims queue: the ledger, status tabs and search, the grid filling the viewport, the evidence panel beside it,
 * and a status line. Live while a claim can still change (useQueuePoll). Keyboard: / search, 1 to 6 tabs, ↑/↓ walks
 * the queue with the panel open, Enter opens, Esc closes, A and R open approve or reject on a held claim, ? lists them.
 */
export function ClaimsQueue({ recall, rows: initial, at: initialAt, sandbox = false }: ClaimsQueueProps) {
  const { rows, at, failed, state, refresh } = useQueuePoll(recall.id, initial, initialAt);
  const wide = useMedia(WIDE);
  const fill = useMedia(FILL);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [intent, setIntent] = useState<ReviewIntent | null>(null);
  const [help, setHelp] = useState(false);
  const grid = useRef<ClaimsGridHandle>(null);
  const searchBox = useRef<HTMLInputElement>(null);

  const ledger = useMemo(() => ledgerOf(rows, recall), [rows, recall]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(TABS.map((t) => [t.id, 0])) as Record<Tab, number>;
    c.all = rows.length;
    for (const r of rows) if (r.decision in c) c[r.decision as Tab]++;
    return c;
  }, [rows]);
  const tabRows = useMemo(() => (tab === "all" ? rows : rows.filter((r) => r.decision === tab)), [rows, tab]);
  // Search: every word must appear in the claim id, code, PayPal account's last four or reason.
  const found = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return tabRows;
    return tabRows.filter((r) => {
      const text = `${r.id} ${r.code ?? ""} ${r.payer} ${r.reason}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [tabRows, search]);
  const openRow = rows.find((r) => r.id === open) ?? null;

  const close = useCallback(() => {
    const id = open;
    setOpen(null);
    setIntent(null);
    if (id) requestAnimationFrame(() => grid.current?.focusRow(id));
  }, [open]);

  const openClaim = useCallback((id: string) => {
    setIntent(null);
    setOpen(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // An open dialog (the ? sheet) handles its own keys, Esc included: closing the panel behind it would be the wrong layer.
      if (help || (e.target instanceof Element && e.target.closest("dialog[open]"))) return;
      if (e.key === "Escape" && open && wide && !typing(e.target)) {
        e.preventDefault();
        close();
        return;
      }
      if (typing(e.target)) return;
      if (e.key === "/") {
        e.preventDefault();
        searchBox.current?.focus();
      } else if (/^[1-6]$/.test(e.key)) {
        setTab(TABS[Number(e.key) - 1].id);
      } else if ((e.key === "a" || e.key === "r") && openRow?.decision === "held" && wide) {
        e.preventDefault();
        setIntent((i) => ({
          mode: e.key === "a" ? "approve" : "reject",
          n: (i?.n ?? 0) + 1,
        }));
      } else if (e.key === "?") {
        setHelp(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, wide, close, openRow, help]);

  const samples = ledger.samples;
  const demos = ledger.demos;

  return (
    <section aria-label="Claims" className="flex min-h-0 flex-1 flex-col">
      <Ledger ledger={ledger} sandbox={sandbox} />

      <div className="mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line">
        <StatusTabs value={tab} counts={counts} onChange={setTab} controls="claims-panel" />
        <label className="relative mb-1.5 flex w-full items-center sm:w-64">
          <span className="sr-only">Search claims by id, code, PayPal account or reason</span>
          <input
            ref={searchBox}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearch("");
                e.currentTarget.blur();
              }
            }}
            placeholder="Search claims, codes, reasons"
            className="h-9 w-full rounded-control border border-line bg-surface pr-9 pl-3 text-ui text-text placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-0"
          />
          <kbd
            className={clsx("pointer-events-none absolute right-2 hidden h-5 min-w-5 items-center justify-center rounded-[4px] border border-line-strong/60 font-mono text-[11px] text-faint", !search && "sm:inline-flex")}
            aria-hidden="true"
          >
            /
          </kbd>
        </label>
      </div>

      {(samples > 0 || demos > 0) && (
        <p className="flex items-start gap-2 py-2.5 font-mono text-micro text-faint">
          <span aria-hidden="true" className="mt-[5px] size-1.5 shrink-0 rotate-45 border border-faint" />
          <span>
            {samples > 0 && <>{plural(samples, "sample claim")} from the eval set: AI-made test photos, never paid. </>}
            {demos > 0 && <>{formatCount(demos)} filed through the judges&apos; demo with sandbox money.</>}
          </span>
        </p>
      )}

      <div id="claims-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex min-h-0 flex-1 gap-3">
        <div className="relative min-h-0 min-w-0 flex-1">
          {!tabRows.length ? (
            <EmptyState title={EMPTY_TAB[tab as Exclude<Tab, "all">].title} description={EMPTY_TAB[tab as Exclude<Tab, "all">].description} />
          ) : (
            <>
              {found.length > 0 && (
                <ClaimsGrid
                  ref={grid}
                  rows={found}
                  openId={open}
                  onOpen={openClaim}
                  onFocusRow={(id) => open && wide && id !== open && openClaim(id)}
                  fill={fill}
                />
              )}
              {found.length === 0 && (
                <div className="flex justify-center px-4 pt-10">
                  <EmptyState
                    title="No claims match"
                    description={`Nothing in ${tab === "all" ? "this recall" : `the ${TABS.find((t) => t.id === tab)?.label} tab`} matches “${search}”. Search by claim id, code, the PayPal account's last four or the reason.`}
                  />
                </div>
              )}
            </>
          )}
        </div>
        {/* The panel is docked from just under the console header to the foot of the window, over the recall's heading
            and ledger, so the evidence has the height; this keeps its width free beside the grid. */}
        {wide && open && <div aria-hidden="true" className="w-[440px] shrink-0" />}
        {wide && open && (
          <div className="fixed top-[65px] right-8 bottom-3 z-20 flex">
            <EvidencePanel claimId={open} version={openRow?.version} onClose={close} intent={intent} />
          </div>
        )}
      </div>
      {!wide && open && <EvidenceDrawer claimId={open} version={openRow?.version} onClose={() => setOpen(null)} />}

      <footer className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1 pt-2 font-mono text-micro text-faint" aria-live="polite">
        <span>
          {found.length === tabRows.length ? plural(tabRows.length, "claim") : `${formatCount(found.length)} of ${plural(tabRows.length, "claim")}`}
          {ledger.settling > 0 && ` · ${formatCount(ledger.settling)} settling at PayPal`}
        </span>
        <Status state={state} at={at} failed={failed} onRefresh={refresh} />
        <button
          type="button"
          onClick={() => setHelp(true)}
          className="ml-auto hidden items-center gap-1.5 rounded-control px-1 hover:text-muted lg:inline-flex"
        >
          <Keys k={["?"]}>Shortcuts</Keys>
        </button>
      </footer>

      {help && <ShortcutSheet onClose={() => setHelp(false)} />}
    </section>
  );
}

function Ago({ at }: { at: number }) {
  const [now, setNow] = useState(at);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((now - at) / 1000));
  return <>{s < 60 ? `${s} s` : `${Math.floor(s / 60)} min`} ago</>;
}

function Status({ state, at, failed, onRefresh }: { state: PollState; at: number; failed: boolean; onRefresh: () => void }) {
  const refresh = (
    <button type="button" onClick={onRefresh} className="text-muted underline decoration-line-strong underline-offset-2 hover:text-text">
      Refresh
    </button>
  );
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={clsx("size-1.5 rounded-full", state === "live" && !failed ? "bg-pay" : "border border-faint")} />
      {failed ? (
        <>Couldn&apos;t update · {refresh}</>
      ) : state === "live" ? (
        <>
          Live · updated <Ago key={at} at={at} />
        </>
      ) : state === "paused" ? (
        <>Paused while this tab is hidden</>
      ) : state === "ended" ? (
        <>Live updates stopped after 10 minutes · {refresh}</>
      ) : (
        <>
          Up to date · updated <Ago key={at} at={at} /> · {refresh}
        </>
      )}
    </span>
  );
}

const SHORTCUTS: [string[], string][] = [
  [["/"], "Search claims"],
  [["1", "6"], "Switch status tab"],
  [["↑", "↓"], "Move between claims; the panel follows"],
  [["Enter"], "Open a claim's evidence"],
  [["Esc"], "Close the evidence"],
  [["A"], "Approve a held claim (confirm with a second click)"],
  [["R"], "Reject a held claim"],
];

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      aria-labelledby="shortcuts-title"
      className="m-auto w-[360px] max-w-[calc(100vw-2rem)] rounded-card bg-surface p-0 text-text shadow-float backdrop:bg-[oklch(0.1_0.004_75/0.5)]"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 id="shortcuts-title" className="text-ui font-medium">
          Keyboard
        </h2>
        <button type="button" onClick={() => ref.current?.close()} className="rounded-control px-2 py-1 font-mono text-micro text-faint hover:text-text">
          Esc
        </button>
      </div>
      <dl className="flex flex-col gap-3 px-5 py-4">
        {SHORTCUTS.map(([keys, what]) => (
          <div key={what} className="grid grid-cols-[88px_1fr] items-center gap-3 text-ui">
            <dt className="flex gap-1">
              {keys.map((k, i) => (
                <span key={k} className="inline-flex items-center gap-1">
                  {i > 0 && keys.length === 2 && k === "6" && <span className="text-faint">to</span>}
                  <kbd className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[4px] border border-line-strong/60 px-1.5 font-mono text-micro text-muted">
                    {k}
                  </kbd>
                </span>
              ))}
            </dt>
            <dd className="text-muted">{what}</dd>
          </div>
        ))}
      </dl>
    </dialog>
  );
}
