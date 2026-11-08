import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_SPEC } from "@/lib/demo/kikea";
import type { Store } from "@/lib/store";
import { localStore } from "@/lib/store/local";

let dir: string;
let store: Store;
const draftSpec = vi.hoisted(() => vi.fn());
// The route's helpers in @/app/console/_lib/api are marked server-only.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/demo", () => ({ getAppStore: async () => store }));
vi.mock("@/lib/session", () => ({ getSession: async () => ({ role: "company", payerId: "COMPANY1", verified: true }) }));
vi.mock("@/app/console/_lib/import", () => ({ readCpsc: async () => ({ RecallNumber: "27071" }) }));
vi.mock("@/lib/spec", () => ({ draftSpec }));

const { POST } = await import("./route");

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "remedy-draft-"));
  store = localStore(dir);
  draftSpec.mockReset().mockResolvedValue(DEMO_SPEC);
  vi.stubEnv("PAYPAL_CLIENT_ID", "id");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
  vi.stubEnv("OPENAI_API_KEY", "sk");
  vi.stubEnv("DRAFT_DAILY_LIMIT", "1");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const post = () => POST(new Request("http://127.0.0.1/api/console/recalls/draft", { method: "POST", body: JSON.stringify({ ref: "27-071" }) }) as never);

describe("POST /api/console/recalls/draft", () => {
  it("counts each draft, and past the daily limit refuses without calling the model", async () => {
    const first = await post();
    expect(first.status).toBe(200);
    const day = new Date().toISOString().slice(0, 10);
    expect((await store.getUsage(day)).draft).toBe(1);

    const second = await post();
    expect(second.status).toBe(429);
    expect((await second.json()).error).toMatch(/^Remedy drafts up to 1 recall a day, .* Write the checks yourself, or try the draft again in (under an hour|about \d+ hours)\.$/);
    expect(draftSpec).toHaveBeenCalledTimes(1);
    expect((await store.getUsage(day)).draft).toBe(1);
  });
});
