import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleClaim, sampleRecall } from "@/lib/__fixtures__/claim";
import type { Session } from "@/lib/session";
import type { Store } from "@/lib/store";
import { localStore } from "@/lib/store/local";
import { DEMO_CLAIMS } from "@/lib/demo/claims";

const DEMO_IDS = DEMO_CLAIMS.map((d) => d.id);

vi.mock("server-only", () => ({}));
let store: Store;
let session: Session | null;
vi.mock("@/lib/demo", async (original) => ({ ...(await original<typeof import("@/lib/demo")>()), getAppStore: async () => store }));
vi.mock("@/lib/session", () => ({ getSession: async () => session }));

const { GET } = await import("./route");
const ROUND = "dr_0123456789abcdef0123456789abcdef";
const get = (q = "?recall=27-071", round: string | null = ROUND) =>
  GET(new NextRequest(`http://127.0.0.1:3000/api/console/claims${q}`, { headers: round ? { cookie: `remedy_demo_round=${round}` } : {} }));
const company: Session = { role: "company", payerId: "COMPANY00001", verified: true, name: null, email: null, iat: 0 };

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "remedy-queue-"));
  store = localStore(dir);
  session = company;
  for (const k of ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "OPENAI_API_KEY"]) vi.stubEnv(k, "unused");
  await store.putRecall(sampleRecall());
  // An earlier seed's claim: never listed, the dataset's claims are.
  await store.putClaim(sampleClaim({ id: "RM-0001", seeded: true, decision: "paid", payout: { batchId: "SEED1", status: "SUCCESS", updatedAt: "2026-11-07T10:00:00.000Z" } }));
  // A demo run of this browser's round, and one of another browser's.
  await store.putClaim(sampleClaim({ id: "RM-0002", demo: true, demoRound: ROUND }));
  await store.putClaim(sampleClaim({ id: "RM-0004", demo: true, demoRound: "dr_ffffffffffffffffffffffffffffffff" }));
  // Another person's real claim on the shared demo recall: never shown to this company.
  await store.putClaim(sampleClaim({ id: "RM-0003", payerId: "SOMEONEELSE01" }));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("GET /api/console/claims", () => {
  it("needs the company's session", async () => {
    session = null;
    expect((await get()).status).toBe(401);
  });

  it("returns the grid's rows for the recall, never cached, with sealed photo URLs and no store keys", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const body = await res.json();
    expect(body.recallId).toBe("27-071");
    const ids = body.rows.map((r: { id: string }) => r.id);
    expect(ids.filter((id: string) => !DEMO_IDS.includes(id))).toEqual(["RM-0002"]);
    expect(ids.filter((id: string) => DEMO_IDS.includes(id)).sort()).toEqual([...DEMO_IDS].sort());
    // Another browser sees the seven claims and none of this one's runs.
    expect((await (await get(undefined, null)).json()).rows.map((r: { id: string }) => r.id).sort()).toEqual([...DEMO_IDS].sort());
    const text = JSON.stringify(body);
    expect(text).not.toContain("RM-0412/1.jpg");
    expect(text).not.toContain("5b1d7c1e");
    expect(body.rows.find((r: { id: string }) => r.id === "RM-0002").photos[0].thumb).toMatch(/^\/api\/console\/claims\/RM-0002\/photos\/0\?t=[\w-]+&w=96$/);
    expect(text).not.toContain("seed/");
  });

  it("says so for a recall this company can't see", async () => {
    await store.putRecall({ ...sampleRecall(), id: "27-099", slug: "someone-elses", owner: "SOMEONEELSE01" });
    expect((await get("?recall=27-099")).status).toBe(404);
    expect((await get("?recall=27-123")).status).toBe(404);
  });
});
