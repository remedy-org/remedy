import type { ClaimView } from "./model";

export const DEMO_SEND_WAIT_MS = 12_000;
export const DEMO_RECEIPT_TIMEOUT_MS = 10_000;

type Fetch = typeof fetch;
export type DemoPhotoResult =
  | { kind: "received"; view: ClaimView | null }
  | { kind: "retry" | "uncertain"; message: string };

const UNCONFIRMED = "The reply was lost. Your photo may already have arrived. Check this claim before sending again.";

/** A lost reply is not a failed send: only the route's pre-write rejections permit another POST. */
export async function sendDemoPhoto(claimId: string, request: Fetch = fetch): Promise<DemoPhotoResult> {
  try {
    const res = await request(`/api/claims/${claimId}/photos`, { method: "POST", body: new FormData() });
    // A previous send has arrived. There is no need to wait for or parse an error body.
    if (res.status === 409) return { kind: "received", view: null };
    const body = await res.json().catch(() => null);
    if (res.ok) return { kind: "received", view: body as ClaimView | null };
    if ([400, 401, 404, 413].includes(res.status)) {
      return { kind: "retry", message: typeof body?.error === "string" ? body.error : "The photo wasn’t accepted. Try sending it again." };
    }
    return { kind: "uncertain", message: UNCONFIRMED };
  } catch {
    return { kind: "uncertain", message: UNCONFIRMED };
  }
}

export type DemoReceiptResult = { kind: "received" } | { kind: "waiting" | "error"; message: string };

/** This check never resends the photo. Its timeout stops only this status request, not the original POST. */
export async function checkDemoPhotoReceipt(claimId: string, request: Fetch = fetch): Promise<DemoReceiptResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<DemoReceiptResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ kind: "error", message: "Claim status didn’t answer. Keep this claim open and check again." });
    }, DEMO_RECEIPT_TIMEOUT_MS);
  });
  const read = async (): Promise<DemoReceiptResult> => {
    try {
      const res = await request(`/api/claims/${claimId}/status?observe=1`, { cache: "no-store", signal: controller.signal });
      const body = await res.json().catch(() => null);
      if (!res.ok) return { kind: "error", message: typeof body?.error === "string" ? body.error : "Couldn’t read this claim. Check again when you’re online." };
      if (typeof body?.photos !== "number" || typeof body?.decision !== "string") return { kind: "error", message: "Couldn’t read this claim’s status. Check again." };
      if (body.photos > 0 || body.decision !== "pending") return { kind: "received" };
      return { kind: "waiting", message: "Receipt isn’t confirmed yet. The first send may still be running. Keep this claim open and check again shortly." };
    } catch {
      return { kind: "error", message: "Couldn’t read this claim. Check again when you’re online." };
    }
  };
  try {
    return await Promise.race([read(), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
