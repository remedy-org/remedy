"use client";

import { useSyncExternalStore } from "react";
import type { DrawerClaim } from "@/app/console/_lib/drawer";
import type { ClaimRow } from "@/app/console/_lib/view";

// Decisions on the shared recall's starter claims. They were filed before PayPal Payouts was connected and sit in every
// company's console, so a person's approve or reject is kept for this browser tab: the claim leaves Held here, with the
// evidence as decided, and another company's queue is untouched. Nothing is paid either way.

const KEY = "remedy:starter-decisions";
type Decided = Record<string, DrawerClaim>;
const EMPTY: Decided = {};
let cache: Decided | null = null;
const listeners = new Set<() => void>();

function read(): Decided {
  if (cache) return cache;
  try {
    cache = JSON.parse(window.sessionStorage.getItem(KEY) ?? "{}") as Decided;
  } catch {
    cache = {};
  }
  return cache;
}

/** Keeps a starter claim's decision (the claim as the server decided it, never saved there). */
export function keepStarterDecision(claim: DrawerClaim) {
  cache = { ...read(), [claim.id]: claim };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // A private window without storage keeps it for this page view only.
  }
  listeners.forEach((l) => l());
}

/** A starter claim this tab decided, if any. */
export const starterDecision = (id: string): DrawerClaim | null => (typeof window === "undefined" ? null : (read()[id] ?? null));

const subscribe = (on: () => void) => {
  listeners.add(on);
  return () => listeners.delete(on);
};

/** Every starter claim this tab decided; empty on the server and in the first render, so hydration matches. */
export function useStarterDecisions(): Decided {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** The grid's rows with this tab's decisions on starter claims: approved (no payout) or rejected on review. */
export function withStarterDecisions(rows: ClaimRow[], decided: Decided): ClaimRow[] {
  if (decided === EMPTY || !Object.keys(decided).length) return rows;
  return rows.map((r) => {
    const d = decided[r.id];
    if (!d || !r.seeded || r.decision !== "held") return r;
    const approved = d.decision === "paid";
    return {
      ...r,
      decision: approved ? "paid" : "rejected",
      reason: approved ? "Approved on review" : "Rejected on review",
      note: approved ? "Approved on review" : "Rejected on review",
      amount: approved ? r.amount : null,
      cents: approved ? r.cents : null,
      timeline: r.timeline && { ...r.timeline, end: approved ? "paid" : "stopped" },
    };
  });
}
