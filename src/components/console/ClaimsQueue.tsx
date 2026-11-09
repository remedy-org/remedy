"use client";

import clsx from "clsx";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { CheckIcon, CrossIcon } from "@/components/ui";
import { duration, formatCents, ledgerOf, searchKey, searchText, type ClaimRow } from "@/app/console/_lib/view";
import { MONEY_WORD } from "@/lib/payoutWords";
import type { Recall } from "@/lib/types";
import { BulkBar, type BulkMode, type BulkResult } from "./BulkBar";
import { ClaimsGrid, type ClaimsGridHandle, type GridTotals, type GroupBy, type SortOrder } from "./ClaimsGrid";
import type { DecisionModel } from "./DecisionFilter";
import { EvidenceShell } from "./EvidenceShell";
import { Keys } from "./Keys";
import { holdable, keyQueue } from "./keyQueue";
import { formatCount, plural } from "./format";
import { Ledger } from "./Ledger";
import type { ReviewIntent } from "./ReviewActions";
import { StatusTabs, TABS, type Tab } from "./StatusTabs";
import { verdictOf } from "./VerdictMark";
import { useQueuePoll, type PollState } from "./useQueuePoll";

// The evidence views load on the first open, not with the page: the queue's first load stays small. The queue fetches
// the module once it has drawn (below), so a first open rarely waits; if it does, the panel shows its own header from
// the grid's row and its skeleton, never a blank card.
const loadEvidence = () => import("./EvidenceDrawer");
const EvidencePanel = lazy(() => loadEvidence().then((m) => ({ default: m.EvidencePanel })));
const EvidenceDrawer = lazy(() => loadEvidence().then((m) => ({ default: m.EvidenceDrawer })));
const noSubscribe = () => () => {};

// The evidence panel's width: 440px on a laptop, growing with the screen to 680px, so the photos (the evidence) read at
// 1920 without opening the viewer.
export const PANEL_W = "w-[clamp(440px,34vw,680px)]";

const EMPTY_TAB: Record<Exclude<Tab, "all">, { title: string; description: string }> = {
  paid: {
    title: "No paid claims yet",
    description: "A claim is paid once PayPal confirms the payout Remedy sent for it.",
  },
  settling: {
    title: "Nothing settling",
    description: "A payout Remedy sent waits here until PayPal confirms it.",
  },
  approved: {
    title: "No approved claims waiting",
    description: "A claim the rule passed, or a person approved, with nothing sent through PayPal yet.",
  },
  held: {
    title: "Nothing waiting for review",
    description: "Claims with an unclear answer, or any passing claim while auto-pay is off, wait here for a person.",
  },
  rejected: {
    title: "No rejected claims",
    description: "A claim is rejected when its photos fail a check, such as a wrong code or label.",
  },
  blocked: {
    title: "No blocked claims",
    description: "The account checks stop a claim before its photos are read: a reused photo, an expired camera session or a second claim from one account.",
  },
  pending: {
    title: "Nothing in progress",
    description: "A claim is in progress from the moment its owner gets a code until the photos are checked.",
  },
};

// From 1024px the queue fills the viewport (page.tsx); from 1280px the evidence panel docks beside the tabs, grid and
// footer, which keep the grid's 708px of columns beside the 452px panel. Below that the panel opens as a sheet over the
// grid.
const FILL = "(min-width: 1024px)";
const WIDE = "(min-width: 1280px)";
// Below 640px (phones, where the claims are cards) the toolbar keeps to the tabs' row: the search folds to its icon, and
// grouping and export step aside for the cards' sort. From 640px the grid has its columns and headers, 200% zoom on a
// laptop included.
const ROOMY = "(min-width: 640px)";
// From 1440px the eight tabs, grouping, export and an open search share one row; below it an empty search folds to its
// icon, as it does beside the docked panel, so the toolbar never wraps the search onto a row of its own.
const BROAD = "(min-width: 1440px)";
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
// Focus on the page itself, a control of the queue's chrome (a tab, a button) or the grid's header row (after a sort),
// not in the grid's rows, the panel or a dialog: where ↓ and j go into the list.
const outsideList = (t: EventTarget | null) =>
  !(t instanceof Element) || t === document.body || Boolean(t.closest(".claims-grid .ag-header")) || !t.closest(".claims-grid, .evidence-panel, dialog");

// A tab is a Verdict filter on one decision; the column's own filter can say more (several decisions, reasons).
const tabFilter = (t: Tab): DecisionModel | null => (t === "all" ? null : { decisions: [t], reasons: [] });
const tabOf = (m: DecisionModel | null): Tab => (m && m.decisions.length === 1 && !m.reasons.length ? (m.decisions[0] as Tab) : "all");

const GROUPS: { id: GroupBy; label: string }[] = [
  { id: "none", label: "None" },
  { id: "reason", label: "Reason" },
  { id: "day", label: "Day" },
];

const isTab = (v: string | undefined): v is Tab => TABS.some((t) => t.id === v);

export interface ClaimsQueueProps {
  recall: Pick<Recall, "id" | "unitsSold" | "product">;
  rows: ClaimRow[];
  // When the server read these rows (ISO).
  at: string;
  // From the URL (?tab=held&q=pillow&claim=RM-1460), which the queue keeps in step, so a view can be reloaded or shared.
  initialTab?: string;
  initialSearch?: string;
  initialOpen?: string;
}

/**
 * The claims queue: the ledger, status tabs and search, the grid filling the viewport, the evidence panel beside it,
 * and a status line. Live while a claim can still change (useQueuePoll). Keyboard: / search, 1 to 6 tabs, ↓ or j from
 * outside the list goes into it, ↑/↓ walks the queue with the panel open, Enter opens, Esc closes, A and R open approve
 * or reject on a held claim, ? lists them.
 */
export function ClaimsQueue({ recall, rows: initial, at: initialAt, initialTab, initialSearch = "", initialOpen }: ClaimsQueueProps) {
  const [open, setOpen] = useState<string | null>(() => (initialOpen && initial.some((r) => r.id === initialOpen) ? initialOpen : null));
  // The pointer or keyboard focus in the grid: new claims wait rather than shift the rows (useQueuePoll).
  const [pointerIn, setPointerIn] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  const { rows, pending, showPending, at, failed, state, refresh } = useQueuePoll(recall.id, initial, initialAt, pointerIn || focusIn || open !== null);
  useEffect(() => {
    // The evidence module, fetched while the reviewer reads the list.
    const t = window.setTimeout(() => void loadEvidence(), 1200);
    return () => window.clearTimeout(t);
  }, []);
  const wide = useMedia(WIDE);
  // The evidence views are drawn in the browser only (they load the claim there).
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const fill = useMedia(FILL);
  const roomy = useMedia(ROOMY);
  const broad = useMedia(BROAD);
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : "all");
  // The Verdict column's filter: the tab's, or what the column's menu picked.
  const [filter, setFilter] = useState<DecisionModel | null>(() => tabFilter(isTab(initialTab) ? initialTab : "all"));
  const [search, setSearch] = useState(initialSearch);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  // What the grid shows after its filters: how many claims, and the money they approved and sent.
  const [totals, setTotals] = useState<GridTotals | null>(null);
  const shown = totals?.count ?? null;
  const [intent, setIntent] = useState<ReviewIntent | null>(null);
  // V or Space on the open claim: its photo viewer, at the first photo (a count, so each press opens it).
  const [viewPhotos, setViewPhotos] = useState(0);
  // A decision just made: said for 4 s in the footer's status line, beside the queue's freshness, so the next claim's
  // header keeps its own facts as it opens.
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);
  const [help, setHelp] = useState(false);
  // A or R on a claim they can't act on: said under that claim's row (else at the grid's foot) until the next key, or 4 s,
  // so a key never seems to do something silently.
  const [hint, setHintState] = useState<{ text: string; row: string | null } | null>(null);
  const setHint = useCallback((text: string | null, row: string | null = null) => setHintState(text ? { text, row } : null), []);
  // The claims picked for a bulk decision, in the grid's order, and the bulk bar's step.
  const [picked, setPicked] = useState<string[]>([]);
  const [bulk, setBulk] = useState<BulkMode>("idle");
  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const pick = useCallback((ids: string[]) => {
    setPicked(ids);
    if (!ids.length) setBulk("idle");
  }, []);
  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(null), 4000);
    // The next key moves on from it, wherever focus is (the grid takes j and k before the window sees them).
    const next = () => setHint(null);
    window.addEventListener("keydown", next, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", next, true);
    };
  }, [hint, setHint]);
  const grid = useRef<ClaimsGridHandle>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  // Keys typed while a decision saves, or while the claim they are meant for loads, wait and replay in order once its
  // panel is ready (keyQueue.ts). awaiting: the claim they wait for; savingSeen and decidedNow tell a save that went
  // through from one that didn't, whose keys are let go rather than landing on the claim that stayed.
  const awaiting = useRef<string | null>(null);
  const savingSeen = useRef(false);
  const decidedNow = useRef(false);
  // Beside the docked panel the toolbar has the grid's width only: an empty search folds to its icon, so the tabs and
  // controls never crowd it into "Search cla". It opens on a click or /, and stays open while it holds words.
  const [searchOpen, setSearchOpen] = useState(false);

  const ledger = useMemo(() => ledgerOf(rows, recall), [rows, recall]);
  // Search: every word must appear in the claim id, code, PayPal account's last four, reason or verdict line, as the
  // grid's quick filter reads them (searchText: O and 0 match each other). It applies to every tab, so the tabs count
  // what it matches.
  const searched = useMemo(() => {
    const words = searchKey(search.trim()).split(/\s+/).filter(Boolean);
    if (!words.length) return rows;
    return rows.filter((r) => {
      const text = searchKey(searchText(r));
      return words.every((w) => text.includes(w));
    });
  }, [rows, search]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(TABS.map((t) => [t.id, 0])) as Record<Tab, number>;
    c.all = searched.length;
    for (const r of searched) c[verdictOf(r)]++;
    return c;
  }, [searched]);
  const tabRows = useMemo(() => (tab === "all" ? rows : rows.filter((r) => verdictOf(r) === tab)), [rows, tab]);
  const found = useMemo(() => (tab === "all" ? searched : searched.filter((r) => r.decision === tab)), [searched, tab]);
  const filtered = filter !== null && tabOf(filter) === "all";
  const openRow = rows.find((r) => r.id === open) ?? null;
  const compact = ((wide && open !== null) || !roomy || !broad) && !search && !searchOpen;
  // A search with nothing in this tab: where its matches are instead, so an empty tab is never a dead end.
  const elsewhere = tab !== "all" && search ? TABS.filter((t) => t.id !== "all" && t.id !== tab && counts[t.id] > 0) : [];

  const close = useCallback(() => {
    const id = open;
    setOpen(null);
    setIntent(null);
    if (id) requestAnimationFrame(() => grid.current?.focusRow(id));
  }, [open]);

  // Opening a claim drops a key's intent for another claim, never this one's: an A pressed as Enter opened it stays.
  const openClaim = useCallback((id: string) => {
    setIntent((i) => (i?.id === id ? i : null));
    setOpen(id);
  }, []);

  // A claim opened from a link in another's evidence (the account's other claim): the panel offers the way back to it.
  const [trail, setTrail] = useState<{ id: string; from: string } | null>(null);
  const back = trail && trail.id === open ? trail.from : null;

  // A tab that doesn't list the open claim closes its panel: the evidence beside a list must be one of its rows.
  const changeTab = useCallback(
    (t: Tab) => {
      setTab(t);
      setFilter(tabFilter(t));
      // A new list is a new pick: claims the list no longer shows are never acted on unseen.
      pick([]);
      const row = open ? rows.find((r) => r.id === open) : null;
      if (row && t !== "all" && row.decision !== t) {
        setOpen(null);
        setIntent(null);
      }
    },
    [open, rows, pick],
  );

  // A claim the panel links to (the claim a repost copied, the account's other claim): its row, in the list that shows it.
  const show = useCallback(
    (id: string) => {
      if (!found.some((r) => r.id === id)) {
        setTab("all");
        setSearch("");
      }
      openClaim(id);
      // Beside the docked panel the row takes focus, so ↑, ↓, A and R go on from there; the sheet keeps it.
      if (wide) requestAnimationFrame(() => grid.current?.focusRow(id));
    },
    [found, openClaim, wide],
  );
  const goTo = useCallback(
    (id: string) => {
      if (open && id !== open) setTrail({ id, from: open });
      show(id);
    },
    [open, show],
  );
  const goBack = useCallback(() => {
    if (!back) return;
    setTrail(null);
    show(back);
  }, [back, show]);

  // After a person approves or rejects a held claim, the next held claim in the grid's order as it stood. Beside the
  // docked panel focus moves to its row and the panel follows; the sheet offers it in its footer.
  const [next, setNext] = useState<{ after: string; id: string | null } | null>(null);
  // This visit's decisions, and when the first decided claim was opened, for the one line that says what the session did
  // once the Held queue is clear.
  const openedAt = useRef<number | null>(null);
  useEffect(() => {
    if (open) openedAt.current = Date.now();
  }, [open]);
  const [session, setSession] = useState<{ since: number | null; done: { id: string; decision: string; at: number }[] }>({ since: null, done: [] });
  const decided = useCallback(
    (id: string, decision?: string, claim?: { amount?: string } | null) => {
      const order = grid.current?.displayedIds() ?? found.map((r) => r.id);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const held = order.filter((x) => x === id || byId.get(x)?.decision === "held");
      const i = held.indexOf(id);
      const nextId = (held[i + 1] ?? held[i - 1]) || null;
      setNext({ after: id, id: nextId });
      const said = decision === "rejected" ? `${id} rejected` : `${id} approved · ${claim?.amount ?? "refund"} sent`;
      // Keys typed while it saved are for the claim that opens next: they wait for its panel (keyQueue).
      decidedNow.current = true;
      const start = openedAt.current;
      const now = Date.now();
      setSession((s) => ({ since: s.since ?? start, done: [...s.done.filter((d) => d.id !== id), { id, decision: decision ?? "", at: now }] }));
      if (wide && nextId) awaiting.current = nextId;
      if (wide && nextId) {
        setNotice({ id: nextId, text: said });
        requestAnimationFrame(() => {
          setIntent(null);
          setOpen(nextId);
          grid.current?.focusRow(nextId);
        });
      } else if (wide) {
        setNotice({ id, text: said });
        requestAnimationFrame(() => grid.current?.focusRow(id));
      }
    },
    [found, rows, wide],
  );
  const nextHeld = next && next.after === open ? next.id : undefined;


  // A bulk decision finished: what happened, in the footer, and on to the next held claim the pick didn't hold. Claims
  // PayPal or the checks refused stay picked, so the bar keeps naming them.
  const bulkDone = useCallback(
    (results: BulkResult[], decision: "approve" | "reject") => {
      const done = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok).map((r) => r.id);
      if (done.length) setHint(`${plural(done.length, "claim")} ${decision === "reject" ? "rejected" : "paid through PayPal"}`);
      setBulk("idle");
      setPicked(failed);
      if (failed.length) return;
      refresh();
      const order = grid.current?.displayedIds() ?? found.map((r) => r.id);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const last = Math.max(...results.map((r) => order.indexOf(r.id)));
      const acted = new Set(results.map((r) => r.id));
      const later = order.slice(last + 1).find((id) => byId.get(id)?.decision === "held" && !acted.has(id));
      const earlier = order.slice(0, Math.max(0, last)).find((id) => byId.get(id)?.decision === "held" && !acted.has(id));
      const to = later ?? earlier ?? null;
      // No held claim left outside the pick: the keyboard stays in the list, on the first picked claim it still shows.
      requestAnimationFrame(() => {
        if (to && wide) setOpen(to);
        if (to) return grid.current?.focusRow(to);
        const shown = grid.current?.displayedIds() ?? [];
        const back = results.map((r) => r.id).find((id) => shown.includes(id));
        if (back) grid.current?.focusRow(back);
        else grid.current?.focusFirst();
      });
    },
    [found, rows, wide, refresh, setHint],
  );

  // The tab, search and open claim live in the URL (replaceState: no navigation, no server render), so a reload or a
  // shared link comes back to the same view.
  useEffect(() => {
    const url = new URL(window.location.href);
    const put = (k: string, v: string | null) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
    put("tab", tab === "all" ? null : tab);
    put("q", search.trim() || null);
    put("claim", open);
    if (url.href === window.location.href) return;
    try {
      window.history.replaceState(null, "", url);
    } catch {
      // Safari allows 100 replaceState calls in 30 s; the view itself is unaffected.
    }
  }, [tab, search, open]);

  useEffect(() => {
    if (!wide) return;
    const replayed = new WeakSet<Event>();
    const gated = () => {
      // The dock, not the panel: while the panel's module loads, its shell stands in, and keys typed then still wait.
      const panel = document.querySelector(".evidence-dock");
      if (!panel) {
        awaiting.current = null;
        return false;
      }
      if (panel.querySelector("[data-saving]")) {
        if (!savingSeen.current) decidedNow.current = false;
        savingSeen.current = true;
        return true;
      }
      if (savingSeen.current) {
        savingSeen.current = false;
        if (!decidedNow.current) {
          // PayPal refused it, or another tab decided it first: the claim stays, and keys meant for the next one never
          // land on it.
          keys.clear();
          setHint("Not saved, so the keys pressed meanwhile were let go");
          return false;
        }
      }
      const want = awaiting.current;
      if (want && !panel.querySelector(`[data-ready="${CSS.escape(want)}"]`)) return true;
      awaiting.current = null;
      return false;
    };
    const keys = keyQueue({
      gated,
      send: (k) => {
        const el = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
        const ev = new KeyboardEvent("keydown", { ...k, bubbles: true, cancelable: true, composed: true });
        replayed.add(ev);
        el.dispatchEvent(ev);
        // A letter typed into a reason while it waited: typed in now, as the browser would have.
        if (!ev.defaultPrevented && k.key.length === 1 && !k.metaKey && !k.ctrlKey && !k.altKey && (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)) {
          document.execCommand("insertText", false, k.key);
        }
      },
      frame: (fn) => requestAnimationFrame(fn),
      now: () => performance.now(),
      onDrop: () => setHint("Keys pressed while the claim was saving were let go"),
    });
    // Capture, on the window: before the grid, the panel or a field sees the key.
    const onKey = (e: KeyboardEvent) => {
      if (replayed.has(e) || e.repeat || e.key === "Tab" || !holdable(e) || !keys.holds()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      keys.hold({ key: e.key, code: e.code, shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey });
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      keys.clear();
    };
  }, [wide, setHint]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // An open dialog (the ? sheet, the photo viewer) handles its own keys, Esc included: closing the panel behind it
      // would be the wrong layer. The evidence sheet (below 1280px) is the panel itself: A and R work in it as beside the grid.
      if (help || (e.target instanceof Element && e.target.closest("dialog[open]:not(.evidence-sheet)"))) return;
      const inSheet = e.target instanceof Element && Boolean(e.target.closest(".evidence-sheet"));
      if (inSheet && e.key !== "a" && e.key !== "r") return;
      // A column's filter is open: Esc closes it (focus back on its header), / closes it and goes to search, and no other
      // single key reaches the queue's shortcuts while it is up.
      if (document.querySelector(".ag-popup .ag-filter, .ag-popup .ag-menu")) {
        if (e.key === "Escape") {
          e.preventDefault();
          grid.current?.closeFilter();
        } else if (e.key === "/" && !typing(e.target)) {
          e.preventDefault();
          grid.current?.closeFilter();
          setSearchOpen(true);
          requestAnimationFrame(() => searchBox.current?.focus());
        }
        return;
      }
      // Esc lets a pick go before it closes the panel.
      if (e.key === "Escape" && picked.length && !typing(e.target)) {
        e.preventDefault();
        pick([]);
        return;
      }
      if (e.key === "Escape" && open && wide && !typing(e.target)) {
        e.preventDefault();
        close();
        return;
      }
      if (typing(e.target)) return;
      const reviewing = Boolean(document.querySelector(".evidence-panel [data-review-open]"));
      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchBox.current?.focus());
      } else if ((e.key === "J" || e.key === "K") && e.shiftKey && open) {
        // ⇧J and ⇧K scroll the open claim's evidence by most of a screen, wherever focus is: the grid keeps its row.
        const scroller = document.querySelector<HTMLElement>(".evidence-panel [data-scroller], .evidence-sheet [data-scroller]");
        if (!scroller) return;
        e.preventDefault();
        scroller.scrollBy({ top: (e.key === "J" ? 1 : -1) * scroller.clientHeight * 0.8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      } else if (wide && open && !reviewing && ["ArrowDown", "ArrowUp", "j", "k"].includes(e.key) && e.target instanceof Element && e.target.closest(".evidence-panel")) {
        // Focus on one of the panel's buttons (a photo, Cancel just pressed, a link): ↓ ↑ j k still walk the queue, as
        // the key line says, and the list takes focus back.
        e.preventDefault();
        grid.current?.step(open, e.key === "ArrowDown" || e.key === "j" ? 1 : -1);
      } else if (/^[1-8]$/.test(e.key)) {
        // Never while a claim's confirm, reason or save is up, nor while an A, R or Enter waits for its claim to load: a
        // digit there is a quick reason or a slip, not a new list.
        if (!reviewing && !awaiting.current) changeTab(TABS[Number(e.key) - 1].id);
      } else if ((e.key === "v" || e.key === "V") && open) {
        // The open claim's photos, full size.
        e.preventDefault();
        setViewPhotos((n) => n + 1);
      } else if ((e.key === "j" || (e.key === "ArrowDown" && fill)) && outsideList(e.target)) {
        // Into the list from anywhere on the page: the open claim's row, else the first. Below 1024px the page scrolls,
        // so ↓ keeps scrolling it there, and j (or Tab) goes into the list.
        e.preventDefault();
        if (open) grid.current?.focusRow(open);
        else grid.current?.focusFirst();
      } else if ((e.key === "a" || e.key === "r") && picked.length > 1) {
        // A pick of several: the bulk bar's approve or reject, for its held claims.
        e.preventDefault();
        const held = rows.filter((r) => pickedSet.has(r.id) && r.decision === "held").length;
        if (!held) setHint("None of the picked claims is held: only held claims can be approved or rejected");
        else setBulk(e.key === "a" ? "approve" : "reject");
      } else if (e.key === "a" || e.key === "r") {
        // Never while the open claim's confirm or reason is up (or sending): a letter typed there, or after focus
        // dropped to the page, must not swap the form for another.
        if (document.querySelector(".evidence-panel [data-review-open]")) return;
        // The grid row with focus, else the open claim: A and R open it and start the confirm.
        const focused = e.target instanceof Element && e.target.closest(".claims-grid") ? grid.current?.focusedRowId() : null;
        const id = picked[0] ?? focused ?? open;
        const row = rows.find((r) => r.id === id);
        e.preventDefault();
        if (!row) {
          setHint("Open a held claim first: A approves it, R rejects it");
          return;
        }
        if (row.decision !== "held") {
          setHint(`${row.id} isn’t held: only held claims can be approved or rejected`, row.id);
          return;
        }
        setHint(null);
        if (row.id !== open) openClaim(row.id);
        // The keys after this one wait until its panel has loaded (keyQueue).
        if (wide) awaiting.current = row.id;
        setIntent((i) => ({
          mode: e.key === "a" ? "approve" : "reject",
          n: (i?.n ?? 0) + 1,
          id: row.id,
        }));
      } else if (e.key === "?") {
        setHelp(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, wide, fill, close, openClaim, changeTab, rows, help, picked, pickedSet, pick, setHint]);

  // The column's menu changed the Verdict filter: a single decision is its tab, anything else is All, filtered.
  const onDecisionFilter = useCallback((m: DecisionModel | null) => {
    setFilter(m);
    setTab(tabOf(m));
  }, []);

  const clearSearch = () => {
    setSearch("");
    searchBox.current?.focus();
  };

  return (
    <section aria-labelledby="claims-heading" className="flex min-h-0 flex-1 flex-col">
      <h2 className="sr-only">Summary</h2>
      <Ledger ledger={ledger} />
      <h2 id="claims-heading" className="sr-only">
        Claims
      </h2>

      {/* From 1280px the open claim's panel is a column beside the tabs, grid and footer, from under the ledger to the
          foot of the window: the evidence has the height, and the search, the heading's actions and the footer stay in
          reach. */}
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* One row while it fits: the search narrows first, and only a narrow queue wraps the controls to a second line. */}
          <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-line">
            <StatusTabs value={tab} counts={counts} onChange={changeTab} controls="claims-panel" />
            <div className="mb-1.5 ml-auto flex shrink-0 items-center gap-3 max-sm:hidden">
              <GroupControl value={groupBy} onChange={setGroupBy} />
              <button
                type="button"
                onClick={() => grid.current?.exportCsv()}
                className="inline-flex h-8 items-center rounded-control px-1 text-ui whitespace-nowrap text-muted transition-colors hover:text-text"
              >
                Export CSV
              </button>
            </div>
            {/* Card rows have no header to click: below 640px the sort is its own control, beside search. */}
            {!roomy && <SortControl key={tab} initial={tab === "held" ? "oldest" : "newest"} onChange={(o) => grid.current?.sortBy(o)} />}
            {compact ? (
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(true);
                  requestAnimationFrame(() => searchBox.current?.focus());
                }}
                aria-label="Search claims (/)"
                title="Search claims (/)"
                className="mb-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-control text-muted shadow-[inset_0_0_0_1px_var(--line)] hover:text-text"
              >
                <SearchGlyph />
              </button>
            ) : (
              <div className="relative mb-1.5 flex w-full items-center sm:w-auto sm:max-w-64 sm:grow sm:basis-40">
                <label className="w-full">
                  <span className="sr-only">Search claims by id, code, PayPal account or reason</span>
                  <input
                    ref={searchBox}
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      pick([]);
                      setHint(null);
                    }}
                    onBlur={() => setSearchOpen(false)}
                    onKeyDown={(e) => {
                      // Esc clears the box and goes back to the list, so the next j or ↓ walks the claims; ↓ goes there too.
                      if (e.key !== "Escape" && e.key !== "ArrowDown") return;
                      e.preventDefault();
                      if (e.key === "Escape") setSearch("");
                      if (open) grid.current?.focusRow(open);
                      else grid.current?.focusFirst();
                    }}
                    placeholder="Search claims, codes…"
                    className="h-9 w-full rounded-control border border-line bg-surface pr-9 pl-3 text-ui text-text placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-0 [&::-webkit-search-cancel-button]:appearance-none"
                  />
                </label>
                {/* Clear shows whenever there is text, focused or not (the browser's own × hides on blur). */}
                {search ? (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label="Clear search"
                    className="absolute right-1 inline-flex size-7 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2 hover:text-text"
                  >
                    <CrossIcon className="size-3.5" />
                  </button>
                ) : (
                  <kbd
                    className="pointer-events-none absolute right-2 hidden h-5 min-w-5 items-center justify-center rounded-[4px] border border-line-strong/60 font-mono text-micro text-faint sm:inline-flex"
                    aria-hidden="true"
                  >
                    /
                  </kbd>
                )}
              </div>
            )}
          </div>

          <div
            id="claims-panel"
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            // The console's "Skip to claims" link lands here, and focus goes on into the list: the open claim's row, else
            // the first. Only from that link, so a click on the panel's empty space never moves focus.
            tabIndex={-1}
            className="relative min-h-0 flex-1"
            onPointerEnter={() => setPointerIn(true)}
            onPointerLeave={() => setPointerIn(false)}
            onFocus={(e) => {
              setFocusIn(true);
              if (e.target !== e.currentTarget || !(e.relatedTarget instanceof HTMLAnchorElement) || e.relatedTarget.hash !== "#claims-panel") return;
              if (open) grid.current?.focusRow(open);
              else grid.current?.focusFirst();
            }}
            onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocusIn(false)}
          >
            {pending > 0 && (
              // Over the grid, not above it: showing or hiding it never moves a row.
              <div role="status" className="pointer-events-none absolute inset-x-0 top-11 z-10 flex justify-center">
                <button
                  type="button"
                  onClick={showPending}
                  className="pointer-events-auto inline-flex h-8 items-center gap-2 rounded-control bg-surface-2 px-3 text-ui text-text shadow-float hover:bg-surface-3"
                >
                  {plural(pending, "new claim")}
                  <span className="text-muted">· Show</span>
                </button>
              </div>
            )}
            {/* The grid holds every claim and filters them itself (the tab and the column's menu set its Verdict filter,
                search is its quick filter), so switching tabs never remounts it. With nothing to show, a note covers it. */}
            <ClaimsGrid
              ref={grid}
              label={`Claims for ${recall.product}`}
              rows={rows}
              // Held claims wait for a person: the longest waiting first.
              oldestFirst={tab === "held"}
              openId={open}
              onOpen={(id) => {
                // Enter (or a click) on a claim: keys typed before its evidence loads wait for it (keyQueue), as after A or R.
                if (wide) awaiting.current = id;
                openClaim(id);
              }}
              onViewPhotos={() => setViewPhotos((n) => n + 1)}
              onOpenLinked={goTo}
              onFocusRow={(id) => open && wide && id !== open && openClaim(id)}
              fill={fill}
              search={search}
              decisionFilter={filter}
              onDecisionFilter={onDecisionFilter}
              groupBy={groupBy}
              footnote={tab === "held" && !search ? "That’s every claim waiting for a person." : undefined}
              onShown={setTotals}
              picked={pickedSet}
              onPick={pick}
            />
            {hint && <RowHint key={`${hint.text}|${hint.row}`} text={hint.text} row={hint.row} />}
            {shown === 0 && (
              // Under the header row, sized to its words: the grid's frame stays, with the note where the rows would be.
              <div className="absolute inset-x-px top-[37px] bottom-px z-10 rounded-b-card bg-surface px-6 pt-8">
                {!tabRows.length && !filtered && !search && tab === "held" && session.done.length > 0 ? (
                  // The queue cleared in this visit: what the session did, in one line, at the moment the work is done.
                  <Note title="Held queue clear">{sessionLine(session.done, session.since)}</Note>
                ) : !tabRows.length && !filtered && !search ? (
                  <Note title={EMPTY_TAB[tab as Exclude<Tab, "all">].title}>{EMPTY_TAB[tab as Exclude<Tab, "all">].description}</Note>
                ) : search ? (
                  <Note
                    title={`No claims in ${tab === "all" ? "this recall" : TABS.find((t) => t.id === tab)?.label} match “${search}”`}
                    // A link, as the matches beside it are.
                    action={
                      <>
                        {elsewhere.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => changeTab(t.id)}
                            className="text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
                          >
                            {plural(counts[t.id], "match", "matches")} in {t.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={clearSearch}
                          className="text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
                        >
                          Clear search
                        </button>
                      </>
                    }
                  />
                ) : (
                  <Note
                    title="No claims pass the column filters"
                    action={
                      <button
                        type="button"
                        onClick={() => changeTab("all")}
                        className="text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
                      >
                        Clear filters
                      </button>
                    }
                  />
                )}
              </div>
            )}
          </div>

          {picked.length > 0 && (
            // Docked under the grid, over the footer: the pick's actions in reach, and no row hidden behind them.
            <div className="flex pt-2">
                <BulkBar
                  rows={rows.filter((r) => pickedSet.has(r.id)).sort((a, b) => picked.indexOf(a.id) - picked.indexOf(b.id))}
                  mode={bulk}
                  onMode={setBulk}
                  onClear={() => {
                    pick([]);
                    requestAnimationFrame(() => (open ? grid.current?.focusRow(open) : grid.current?.focusFirst()));
                  }}
                  onDone={bulkDone}
                  onOpen={goTo}
                  onBack={() => requestAnimationFrame(() => (picked[0] ? grid.current?.focusRow(picked[0]) : grid.current?.focusFirst()))}
                />
              </div>
            )}
          {/* One bar under the grid: what the filters show and its money on the left; freshness and the keys on the right. */}
          <footer className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-micro text-muted">
            <span>
              <span className="text-text-2">
                {shown === null || shown === rows.length ? plural(rows.length, "claim") : `${formatCount(shown)} of ${plural(rows.length, "claim")}`}
              </span>
              {/* The money the filters show, in the one payout vocabulary (lib/payoutWords.ts): each state once it holds any. */}
              {totals &&
                (["paid", "settling", "approved"] as const).map(
                  (k) =>
                    totals.cents[k] > 0 && (
                      <span key={k}>
                        {" · "}
                        <span className="font-mono">{formatCents(totals.cents[k])}</span> {MONEY_WORD[k].toLowerCase()}
                      </span>
                    ),
                )}
              {tab === "held" && " · oldest first"}
            </span>
            <span className="ml-auto inline-flex items-center gap-4">
              <span role="status" className={clsx("inline-flex items-center gap-1.5 text-text-2 transition-opacity duration-120", notice ? "opacity-100" : "opacity-0")}>
                {notice && (
                  <>
                    <CheckIcon size={12} className="text-pay" />
                    {notice.text}
                  </>
                )}
              </span>
              <Status state={state} at={at} failed={failed} onRefresh={refresh} />
              <button type="button" onClick={() => setHelp(true)} className="-my-1 inline-flex h-8 items-center gap-1.5 rounded-control px-2 hover:text-text">
                <Keys k={["?"]}>Shortcuts</Keys>
              </button>
            </span>
            {/* What a screen reader hears: the count after a search or filter, and new claims. Never the clock. */}
            <span className="sr-only" role="status">
              {shown !== null && shown !== rows.length ? `${formatCount(shown)} of ${plural(rows.length, "claim")}` : ""}
              {pending > 0 ? ` New claims: ${pending}` : ""}
            </span>
          </footer>
        </div>

        {wide && open && (
          <div className={`evidence-dock flex min-h-0 ${PANEL_W} shrink-0 pt-2`}>
            {hydrated ? (
            <Suspense fallback={<EvidenceShell row={openRow} onClose={close} />}>
            <EvidencePanel
              claimId={open}
              row={openRow}
              viewPhotos={viewPhotos}
              version={openRow?.version}
              filedAt={openRow?.createdAt}
              onClose={close}
              intent={intent}
              onOpen={goTo}
              onDecided={decided}
              nextHeld={nextHeld}
              back={back}
              onBack={goBack}
              picking={picked.length > 1}
              onReturn={() => open && grid.current?.focusRow(open)}
              onSaved={refresh}
            />
            </Suspense>
            ) : (
              <EvidenceShell row={openRow} onClose={close} />
            )}
          </div>
        )}
      </div>
      {hydrated && !wide && open && (
        <Suspense fallback={null}>
        <EvidenceDrawer
          claimId={open}
          row={openRow}
          viewPhotos={viewPhotos}
          version={openRow?.version}
          filedAt={openRow?.createdAt}
          onClose={close}
          intent={intent}
          onOpen={goTo}
          onDecided={decided}
          nextHeld={nextHeld}
          back={back}
          onBack={goBack}
          onSaved={refresh}
        />
        </Suspense>
      )}

      {help && <ShortcutSheet onClose={() => setHelp(false)} />}
    </section>
  );
}

/** "2 approved, 1 rejected, in 1 min 12 s.": this visit's decisions on the Held queue. */
function sessionLine(done: { decision: string; at: number }[], since: number | null): string {
  const approved = done.filter((d) => d.decision === "paid").length;
  const rejected = done.filter((d) => d.decision === "rejected").length;
  const parts = [approved && `${formatCount(approved)} approved`, rejected && `${formatCount(rejected)} rejected`].filter(Boolean).join(", ");
  const took = since === null ? null : Math.max(1, Math.round((Math.max(...done.map((d) => d.at)) - since) / 1000));
  return `${parts}${took === null ? "" : `, in ${duration(took)}`}.`;
}

/** A key's "can't do that" under the row it was pressed on (above it near the grid's foot), else at the grid's foot: where
 * the reviewer is looking, never in the footer's corner. A floating line, so no row moves. */
function RowHint({ text, row }: { text: string; row: string | null }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const at = row ? box.querySelector(`.claims-grid .ag-row[row-id="${CSS.escape(row)}"]`) : null;
    const b = box.getBoundingClientRect();
    const r = at?.getBoundingClientRect();
    if (!r || r.bottom < b.top || r.top > b.bottom) return;
    const below = r.bottom - b.top + 4;
    // Under the row's verdict, which it is about, never over the next row's claim id.
    const verdict = at?.querySelector('.ag-cell[col-id="decision"]')?.getBoundingClientRect();
    if (verdict) el.style.left = `${Math.max(16, Math.min(verdict.left - b.left, b.width - el.offsetWidth - 16))}px`;
    el.style.bottom = "auto";
    el.style.top = `${below + el.offsetHeight > b.height - 8 ? r.top - b.top - el.offsetHeight - 4 : below}px`;
  }, [row]);
  return (
    <p ref={ref} role="status" className="pointer-events-none absolute bottom-3 left-4 z-20 max-w-[calc(100%-2rem)] rounded-control bg-surface px-3 py-1.5 text-ui text-text-2 shadow-float">
      {text}
    </p>
  );
}

/** "just now", then "2 min ago": a calm clock, redrawn every 15 s rather than ticking each second. `stale` follows it
 * once it is a minute old (the Refresh link). */
function Ago({ at, stale }: { at: number; stale?: ReactNode }) {
  const [now, setNow] = useState(at);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);
  const min = Math.floor(Math.max(0, now - at) / 60_000);
  return (
    <>
      {min < 1 ? "just now" : `${min} min ago`}
      {min >= 1 && stale}
    </>
  );
}

/** The queue's freshness in one word: Live while it updates itself, else when it was last read, with Refresh once that
 * is a minute old. */
function Status({ state, at, failed, onRefresh }: { state: PollState; at: number; failed: boolean; onRefresh: () => void }) {
  const refresh = (
    <button
      type="button"
      onClick={onRefresh}
      className="-my-1 inline-flex min-h-6 items-center text-text-2 underline decoration-line-strong underline-offset-2 hover:text-text"
    >
      Refresh
    </button>
  );
  return (
    <span className="inline-flex items-baseline gap-2">
      <span aria-hidden="true" className={clsx("size-1.5 shrink-0 -translate-y-px self-center rounded-full", state === "live" && !failed ? "bg-pay" : "border border-faint")} />
      {failed ? (
        <>Couldn&rsquo;t update · {refresh}</>
      ) : state === "live" ? (
        <>
          Live · updated <Ago key={at} at={at} />
        </>
      ) : state === "paused" ? (
        <>Paused while this tab is hidden</>
      ) : state === "ended" ? (
        <>Live updates stopped after 10 minutes · {refresh}</>
      ) : (
        // One flex item: the wrapper's gap would otherwise open between each word run.
        <span>
          Updated <Ago key={at} at={at} stale={<> · {refresh}</>} />
        </span>
      )}
    </span>
  );
}

// Each row: its keys, what joins them ("/" for either, "to" for a range, "+" for together), and what they do.
const SHORTCUTS: [string[], "/" | "to" | "+" | null, string][] = [
  [["/"], null, "Search"],
  [["1", "8"], "to", "1 All · 2 Paid · 3 Sent, settling · 4 Approved · 5 Held · 6 Rejected · 7 Blocked · 8 In progress"],
  [["↓", "J"], "/", "Next claim"],
  [["↑", "K"], "/", "Previous claim"],
  [["Enter"], null, "Open the claim"],
  [["⇧", "J/K"], "+", "Scroll the open claim’s evidence"],
  [["V", "Space"], "/", "The open claim’s photos"],
  [["⇧", "↑/↓"], "+", "Pick several claims"],
  [["X"], null, "Pick or drop a claim"],
  [["A"], null, "Approve (press twice), in the panel or the photos"],
  [["R"], null, "Reject, in the panel or the photos"],
  [["⌘", "↵"], "+", "Send the reason"],
  [["Esc"], null, "Close the panel or clear the selection"],
  [["?"], null, "This sheet"],
];

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    // Focus goes back where it was when the sheet closes (the grid's row, the panel), never to the page.
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.showModal();
    return () => {
      if (before?.isConnected) before.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      aria-labelledby="shortcuts-title"
      className="m-auto w-[420px] max-w-[calc(100vw-2rem)] rounded-card bg-surface p-0 text-text shadow-float backdrop:bg-[oklch(0.1_0.004_75/0.5)]"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        {/* Focus starts on the title, not on the Esc button, whose ring read as a stray selection. */}
        <h2 id="shortcuts-title" className="text-ui font-medium outline-none" tabIndex={-1} autoFocus>
          Keyboard
        </h2>
        {/* Esc drawn as the keycap it is, as every key on the sheet is. */}
        <button type="button" onClick={() => ref.current?.close()} aria-label="Close shortcuts (Esc)" className="-mr-1.5 inline-flex h-8 items-center rounded-control px-1.5 text-micro text-faint hover:text-text">
          <kbd className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[4px] border border-line-strong/60 px-1.5 font-mono text-micro text-muted">Esc</kbd>
        </button>
      </div>
      <dl className="flex flex-col gap-3 px-5 py-4">
        {SHORTCUTS.map(([keys, join, what]) => (
          <div key={keys.join()} className="grid grid-cols-[112px_1fr] items-center gap-3 text-ui text-pretty">
            <dt className="flex items-center gap-1">
              {keys.map((k, i) => (
                <span key={k} className="inline-flex items-center gap-1">
                  {i > 0 && join && <span className="text-micro text-faint">{join}</span>}
                  {/* One size and ink for every cap; ⇧ and ⌘ in the sans, where the mono draws them small. */}
                  <kbd
                    className={clsx(
                      "inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[4px] border border-line-strong/60 px-1.5 text-micro text-muted",
                      k === "⇧" || k === "⌘" ? "font-sans text-ui leading-none" : "font-mono",
                    )}
                  >
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

/** Group by: one compact select, so the toolbar keeps to one row beside the open panel. */
function GroupControl({ value, onChange }: { value: GroupBy; onChange: (g: GroupBy) => void }) {
  return (
    <label className="relative inline-flex h-8 items-center text-ui">
      <span className="sr-only">Group claims by</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as GroupBy)}
        className={clsx(
          "h-8 appearance-none rounded-control bg-surface pr-7 pl-2.5 text-ui shadow-[inset_0_0_0_1px_var(--line)] hover:text-text",
          value === "none" ? "text-muted" : "text-text",
        )}
      >
        {GROUPS.map((g) => (
          <option key={g.id} value={g.id}>
            {g.id === "none" ? "No grouping" : `Group: ${g.label}`}
          </option>
        ))}
      </select>
      <svg aria-hidden="true" viewBox="0 0 10 6" className="pointer-events-none absolute right-2.5 h-1.5 w-2.5 text-muted">
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}

const SORTS: { id: SortOrder; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "amount", label: "Amount" },
];

function SortControl({ initial, onChange }: { initial: SortOrder; onChange: (o: SortOrder) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <label className="relative mb-1.5 ml-auto inline-flex h-9 items-center text-ui">
      <span className="sr-only">Sort claims</span>
      <select
        value={value}
        onChange={(e) => {
          const o = e.target.value as SortOrder;
          setValue(o);
          onChange(o);
        }}
        className="h-9 appearance-none rounded-control bg-surface pr-7 pl-2.5 text-ui text-muted shadow-[inset_0_0_0_1px_var(--line)] hover:text-text"
      >
        {SORTS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <svg aria-hidden="true" viewBox="0 0 10 6" className="pointer-events-none absolute right-2.5 h-1.5 w-2.5 text-muted">
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}

/** A magnifier drawn for the folded search: one 1.5px stroke, the weight of the select's chevron. */
function SearchGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
      <circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.25 10.25L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** The grid's empty note: a line, what it means, and what to do, on the left where the rows would start. */
function Note({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex max-w-read flex-col gap-1.5 text-ui">
      <p className="font-medium text-text">{title}</p>
      {children && <p className="text-muted">{children}</p>}
      {action && <p className="mt-1.5 flex flex-wrap gap-x-5 gap-y-2">{action}</p>}
    </div>
  );
}
