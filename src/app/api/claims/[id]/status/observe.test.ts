import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleClaim } from "@/lib/__fixtures__/claim";

// No real store, session, payout, or pipeline module is loaded by this test.
const mocks = vi.hoisted(() => ({ getClaim: vi.fn(), getSession: vi.fn(), recheckPayout: vi.fn() }));
vi.mock("@/lib/demo", () => ({ getAppStore: async () => ({ getClaim: mocks.getClaim }) }));
vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/components/claim/payout-live", () => ({ recheckPayout: mocks.recheckPayout }));
vi.mock("../../_lib/http", () => ({
  json: (status: number, error: string) => Response.json({ error }, { status }),
  fail: () => Response.json({ error: "Test error" }, { status: 500 }),
}));

const { GET } = await import("./route");
const OWNER = "test-owner";
const poll = (query = "?observe=1") => GET(new Request(`http://fixture.invalid/api/claims/RM-test/status${query}`) as never, { params: Promise.resolve({ id: "RM-test" }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ role: "owner", payerId: OWNER });
  mocks.getClaim.mockResolvedValue(sampleClaim({ payerId: OWNER, decision: "paid", payout: { batchId: "test-only", status: "PENDING", updatedAt: "2026-11-11T00:00:00Z" } }));
  mocks.recheckPayout.mockImplementation(async (_store, claim) => ({ ...claim, payout: { ...claim.payout, status: "SUCCESS" } }));
});

describe("stored receipt observation (no persistence)", () => {
  it("answers from the stored claim without running payout recovery", async () => {
    const res = await poll();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ decision: "paid", photos: 1, payout: "PENDING" });
    expect(mocks.getClaim).toHaveBeenCalledExactlyOnceWith("RM-test");
    expect(mocks.recheckPayout).not.toHaveBeenCalled();
  });

  it("requires an owner session before reading the claim", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await poll()).status).toBe(401);
    expect(mocks.getClaim).not.toHaveBeenCalled();
    expect(mocks.recheckPayout).not.toHaveBeenCalled();
  });

  it("refuses another owner's claim and a missing claim", async () => {
    mocks.getClaim.mockResolvedValueOnce(sampleClaim({ payerId: "someone-else" }));
    expect((await poll()).status).toBe(404);
    mocks.getClaim.mockResolvedValueOnce(null);
    expect((await poll()).status).toBe(404);
    expect(mocks.recheckPayout).not.toHaveBeenCalled();
  });

  it("preserves the default payout refresh path", async () => {
    expect(await (await poll("")).json()).toMatchObject({ payout: "SUCCESS" });
    expect(mocks.recheckPayout).toHaveBeenCalledOnce();
  });
});
