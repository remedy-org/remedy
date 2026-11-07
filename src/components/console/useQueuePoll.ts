"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QueueResponse } from "@/app/api/console/claims/route";
import { isLive, type ClaimRow } from "@/app/console/_lib/view";

// The claims grid's live updates, inside the Blob budget. GET /api/console/claims costs 1 read (3 on a cold instance).
// It's asked:
//   - every 8 s, only while something can still change (isLive: a claim filed in the last 12.5 minutes still pending,
//     a payout settling in its first half hour, or a demo claim filed in the last 10 minutes), only while the tab is
//     visible, and for at most 10 minutes per page view;
//   - once when the tab becomes visible again, if the queue is live (a judge comes back from filing a demo claim);
//   - when the person asks (the footer's Refresh).
// A failed poll is retried after 16 s, then 32 s; after 3 failures in a row it stops and says so, with Refresh.
// Worst case per page view: 75 polls, 75 to 225 reads; an idle queue (every claim decided and settled, nothing new)
// costs none, and neither does an abandoned claim or a payout parked at UNCLAIMED.
export const POLL_MS = 8_000;
export const POLL_FOR_MS = 10 * 60_000;
export const MAX_FAILS = 3;

export type PollState = "live" | "idle" | "paused" | "ended";

export function useQueuePoll(recallId: string, initial: ClaimRow[], initialAt: string) {
  const [rows, setRows] = useState(initial);
  const [at, setAt] = useState(() => Date.parse(initialAt));
  // Failures in a row, and a count of finished fetches: each one schedules the next poll.
  const [fails, setFails] = useState(0);
  const [done, setDone] = useState(0);
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
      setFails(0);
    } catch {
      setFails((f) => f + 1);
    } finally {
      busy.current = false;
      setDone((d) => d + 1);
    }
  }, [recallId]);

  const live = isLive(rows);
  const liveRef = useRef(live);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  useEffect(() => {
    const onChange = () => {
      const now = document.visibilityState === "visible";
      setVisible(now);
      if (now && liveRef.current && Date.now() - started < POLL_FOR_MS) void fetchNow();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [fetchNow, started]);

  const gaveUp = fails >= MAX_FAILS;
  useEffect(() => {
    if (!live || !visible || ended || gaveUp) return;
    const left = POLL_FOR_MS - (Date.now() - started);
    const wait = POLL_MS * 2 ** fails;
    const timer = window.setTimeout(() => (Date.now() - started >= POLL_FOR_MS ? setEnded(true) : void fetchNow()), Math.max(0, Math.min(wait, left)));
    return () => window.clearTimeout(timer);
  }, [live, visible, ended, gaveUp, fails, done, at, fetchNow, started]);

  const state: PollState = ended ? "ended" : !live ? "idle" : visible ? "live" : "paused";
  return {
    rows,
    at,
    // Only once the retries ran out: a single dropped poll is retried quietly.
    failed: gaveUp || (!live && fails > 0),
    state,
    refresh: () => {
      setEnded(false);
      setFails(0);
      void fetchNow();
    },
  };
}
