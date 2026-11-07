"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QueueResponse } from "@/app/api/console/claims/route";
import { isLive, type ClaimRow } from "@/app/console/_lib/view";

// The claims grid's live updates, inside the Blob budget. GET /api/console/claims costs 1 read (3 on a cold instance).
// It's asked:
//   - every 8 s, only while something can still change (isLive: a claim checking or settling, or a demo claim filed
//     in the last 10 minutes), only while the tab is visible, and for at most 10 minutes per page view;
//   - once when the tab becomes visible again (a judge comes back from filing a demo claim in another tab);
//   - when the person asks (the footer's Refresh).
// Worst case per page view: 75 polls, 75 to 225 reads; an idle queue (every claim decided and settled) costs none.
export const POLL_MS = 8_000;
export const POLL_FOR_MS = 10 * 60_000;

export type PollState = "live" | "idle" | "paused" | "ended";

export function useQueuePoll(recallId: string, initial: ClaimRow[], initialAt: string) {
  const [rows, setRows] = useState(initial);
  const [at, setAt] = useState(() => Date.parse(initialAt));
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [started] = useState(() => Date.now());
  const [ended, setEnded] = useState(false);
  const busy = useRef(false);

  // A server render (router.refresh after a review) brings fresh rows.
  const [seenInitial, setSeenInitial] = useState(initial);
  if (initial !== seenInitial) {
    setSeenInitial(initial);
    setRows(initial);
    setAt(Date.parse(initialAt));
  }

  const fetchNow = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch(`/api/console/claims?recall=${encodeURIComponent(recallId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as QueueResponse;
      setRows(data.rows);
      setAt(Date.parse(data.at));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  }, [recallId]);

  useEffect(() => {
    const onChange = () => {
      const now = document.visibilityState === "visible";
      setVisible(now);
      if (now && Date.now() - started < POLL_FOR_MS) void fetchNow();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [fetchNow, started]);

  const live = isLive(rows);
  useEffect(() => {
    if (!live || !visible || ended) return;
    const left = POLL_FOR_MS - (Date.now() - started);
    const timer = window.setTimeout(
      () => (Date.now() - started >= POLL_FOR_MS ? setEnded(true) : void fetchNow()),
      Math.max(0, Math.min(POLL_MS, left)),
    );
    return () => window.clearTimeout(timer);
  }, [live, visible, ended, at, failed, fetchNow, started]);

  const state: PollState = ended ? "ended" : !live ? "idle" : visible ? "live" : "paused";
  return {
    rows,
    at,
    failed,
    state,
    refresh: () => {
      setEnded(false);
      void fetchNow();
    },
  };
}
