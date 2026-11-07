"use client";

import { useEffect, useRef } from "react";
import type { ClaimStatus, ClaimView } from "./model";

// Each poll is one read of the claim from the store, and those are capped per month: every 2.5 s while this step is
// open and visible, so the laptop follows the phone within a few seconds.
const POLL_MS = 2500;
// Photos sent from the phone just before the code ran out are still checked, so the poll goes on this long after it.
const POLL_GRACE_MS = 2 * 60_000;

/**
 * Photos can arrive from elsewhere: the phone from the QR handoff, or another tab. Polls the claim's status and, once it
 * has photos or a decision, reads the claim's view (its photos, checks and timeline) and calls `onArrive` with it (null
 * if that read failed), so the code step and the camera move straight on to the photo and its checks. Not while the tab is hidden, not while `paused` (this tab is sending), and not past
 * POLL_GRACE_MS after the session ended.
 */
export function useClaimArrival(claimId: string, expiresAt: string, onArrive: (view: ClaimView | null) => void, { off, paused }: { off?: boolean; paused?: boolean } = {}) {
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
          const view = await fetch(`/api/claims/${claimId}`, { cache: "no-store" })
            .then((r) => (r.ok ? (r.json() as Promise<ClaimView>) : null))
            .catch(() => null);
          onArriveRef.current(view);
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
