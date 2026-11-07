import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleClaim, sampleRecall } from "@/lib/__fixtures__/claim";
import type { Session } from "@/lib/session";
import type { Store } from "@/lib/store";
import { localStore } from "@/lib/store/local";

vi.mock("server-only", () => ({}));
let store: Store;
let session: Session | null;
vi.mock("@/lib/demo", () => ({ getAppStore: async () => store }));
vi.mock("@/lib/session", () => ({ getSession: async () => session }));

const { GET } = await import("./route");
const get = (q = "?recall=27-071") => GET(new NextRequest(`http://127.0.0.1:3000/api/console/claims${q}`));
const company: Session = { role: "company", payerId: "COMPANY00001", verified: true, name: null, email: null, iat: 0 };

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "remedy-queue-"));
  store = localStore(dir);
  session = company;
  for (const k of ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "OPENAI_API_KEY"]) vi.stubEnv(k, "unused");
  await store.putRecall(sampleRecall());
  await store.putClaim(sampleClaim({ id: "RM-0001", seeded: true, decision: "paid", payout: { batchId: "SEED1", status: "SUCCESS", updatedAt: "2026-11-07T10:00:00.000Z" } }));
  await store.putClaim(sampleClaim({ id: "RM-0002", demo: true }));
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
    expect(body.rows.map((r: { id: string }) => r.id).sort()).toEqual(["RM-0001", "RM-0002"]);
    const text = JSON.stringify(body);
    expect(text).not.toContain("RM-0412/1.jpg");
    expect(text).not.toContain("5b1d7c1e");
    expect(body.rows[0].photos[0].thumb).toMatch(/^\/api\/console\/claims\/RM-000\d\/photos\/0\?t=[\w-]+&w=96$/);
  });

  it("says so for a recall this company can't see", async () => {
    await store.putRecall({ ...sampleRecall(), id: "27-099", slug: "someone-elses", owner: "SOMEONEELSE01" });
    expect((await get("?recall=27-099")).status).toBe(404);
    expect((await get("?recall=27-123")).status).toBe(404);
  });
});
