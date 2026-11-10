import { afterEach, describe, expect, it, vi } from "vitest";
import { checkDemoPhotoReceipt, DEMO_RECEIPT_TIMEOUT_MS, sendDemoPhoto } from "./demoPhotoRequest";

afterEach(() => vi.useRealTimers());

describe("demo photo transport (in-memory responses only)", () => {
  it("posts once to the same claim and accepts a late success", async () => {
    let reply!: (response: Response) => void;
    const request = vi.fn(() => new Promise<Response>((resolve) => { reply = resolve; }));
    const result = sendDemoPhoto("RM-test", request);
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]).toMatchObject(["/api/claims/RM-test/photos", { method: "POST" }]);
    reply(Response.json({ id: "RM-test", photos: 1 }, { status: 202 }));
    expect(await result).toEqual({ kind: "received", view: { id: "RM-test", photos: 1 } });
  });

  it("continues on 409 without waiting for a response body", async () => {
    const response = new Response(null, { status: 409 });
    const json = vi.spyOn(response, "json");
    expect(await sendDemoPhoto("RM-test", vi.fn(async () => response))).toEqual({ kind: "received", view: null });
    expect(json).not.toHaveBeenCalled();
  });

  it.each([400, 401, 404, 413])("permits retry only after a known pre-write rejection (%i)", async (status) => {
    expect(await sendDemoPhoto("RM-test", vi.fn(async () => Response.json({ error: "Not accepted" }, { status })))).toEqual({ kind: "retry", message: "Not accepted" });
  });

  it.each([408, 429, 500, 502, 504])("keeps an uncertain response locked against a duplicate send (%i)", async (status) => {
    expect(await sendDemoPhoto("RM-test", vi.fn(async () => Response.json({ error: "Server error" }, { status })))).toMatchObject({ kind: "uncertain" });
  });

  it("treats a disconnected request as unknown receipt, not permission to resend", async () => {
    const request = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    expect(await sendDemoPhoto("RM-test", request)).toMatchObject({ kind: "uncertain" });
    expect(request).toHaveBeenCalledOnce();
  });

  it("checks stored receipt with a read-only query and never resends", async () => {
    const request = vi.fn(async () => Response.json({ decision: "blocked", photos: 1 }));
    expect(await checkDemoPhotoReceipt("RM-test", request)).toEqual({ kind: "received" });
    expect(request).toHaveBeenCalledExactlyOnceWith("/api/claims/RM-test/status?observe=1", expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }));
  });

  it("does not allow another POST merely because photos are not confirmed yet", async () => {
    const request = vi.fn(async () => Response.json({ decision: "pending", photos: 0 }));
    expect(await checkDemoPhotoReceipt("RM-test", request)).toMatchObject({ kind: "waiting" });
    expect(request).toHaveBeenCalledOnce();
  });

  it("bounds a hung status response, including a hung JSON body", async () => {
    vi.useFakeTimers();
    const response = new Response();
    vi.spyOn(response, "json").mockReturnValue(new Promise(() => {}));
    const request = vi.fn<typeof fetch>(async () => response);
    const result = checkDemoPhotoReceipt("RM-test", request);
    await vi.advanceTimersByTimeAsync(DEMO_RECEIPT_TIMEOUT_MS);
    expect(await result).toMatchObject({ kind: "error", message: expect.stringContaining("didn’t answer") });
    expect((request.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(true);
  });

  it("offers another status check when offline or the status is invalid", async () => {
    expect(await checkDemoPhotoReceipt("RM-test", vi.fn(async () => { throw new TypeError("offline"); }))).toMatchObject({ kind: "error" });
    expect(await checkDemoPhotoReceipt("RM-test", vi.fn(async () => Response.json({})))).toMatchObject({ kind: "error" });
  });
});
