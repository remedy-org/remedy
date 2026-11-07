"use client";

import { useEffect, useRef } from "react";
import type { ClaimStatus } from "./model";

// Each poll is one read of the claim from the store, and those are capped per month.
const POLL_MS = 5000;
// Photos sent from the phone just before the code ran out are still checked, so the poll goes on this long after it.
const POLL_GRACE_MS = 2 * 60_000;

/**
 * Photos can arrive from elsewhere: the phone from the QR handoff, or another tab. Polls the claim's status and calls
 * `onArrive` once it has photos or a decision, so the code step and the camera move on instead of running their
 * countdown regardless. Not while the tab is hidden, not while `paused` (this tab is sending), and not past
 * POLL_GRACE_MS after the session ended.
 */
export function useClaimArrival(claimId: string, expiresAt: string, onArrive: () => void, { off, paused }: { off?: boolean; paused?: boolean } = {}) {
  const onArriveRef = useRef(onArrive);
  const pausedRef = useRef(paused);
  useEffect(() => {
    onArriveRef.current = onArrive;
    pausedRef.current = paused;
  });
  useEffect(() => {
    if (off) return;
    let done = false;
    const end = Date.parse(expiresAt) + POLL_GRACE_MS;
    const poll = async () => {
      if (done || pausedRef.current || document.hidden) return;
      if (Date.now() > end) return void clearInterval(t);
      try {
        const res = await fetch(`/api/claims/${claimId}/status`, { cache: "no-store" });
        if (!res.ok || done || pausedRef.current) return;
        const status = (await res.json()) as ClaimStatus;
        if (status.photos > 0 || status.decision !== "pending") {
          done = true;
          onArriveRef.current();
        }
      } catch {
        // Offline for a moment: the next tick tries again.
      }
    };
    const t = setInterval(poll, POLL_MS);
    // Back on this tab after taking the photos on the phone: look now rather than at the next tick.
    const onVisible = () => void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      done = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [claimId, expiresAt, off]);
}
