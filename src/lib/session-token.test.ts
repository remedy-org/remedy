import { describe, expect, it, vi } from "vitest";
import { mintSession, readSession, safeNext, sign, unsign } from "./session-token";

const KEY = "k".repeat(32);
const pat = { role: "company" as const, payerId: "47KT8H23PUJ3Q", verified: true, name: "Pat Doe", email: "pat@example.com" };
const at = (iso: string) => new Date(iso);

describe("sign and unsign", () => {
  it("round-trips JSON and refuses a changed body, signature or key", () => {
    const token = sign({ a: 1 }, KEY);
    expect(unsign(token, KEY)).toEqual({ a: 1 });
    const [body, sig] = token.split(".");
    expect(unsign(`${Buffer.from('{"a":2}').toString("base64url")}.${sig}`, KEY)).toBeNull();
    expect(unsign(`${body}.${sig.slice(1)}x`, KEY)).toBeNull();
    expect(unsign(token, "j".repeat(32))).toBeNull();
    expect(unsign("garbage", KEY)).toBeNull();
    expect(unsign(`${token}.extra`, KEY)).toBeNull();
  });
});

describe("sessions", () => {
  it("reads back a fresh session for its own role only", () => {
    const token = mintSession(pat, { now: at("2026-11-07T10:00:00Z"), key: KEY });
    expect(readSession(token, "company", { now: at("2026-11-07T11:00:00Z"), key: KEY })).toEqual({ ...pat, iat: Date.parse("2026-11-07T10:00:00Z") / 1000 });
    expect(readSession(token, "owner", { now: at("2026-11-07T11:00:00Z"), key: KEY })).toBeNull();
    expect(readSession(undefined, "company", { key: KEY })).toBeNull();
  });

  it("expires an owner after 2 hours and a company after 7 days", () => {
    const now = at("2026-11-07T10:00:00Z");
    const owner = mintSession({ ...pat, role: "owner" }, { now, key: KEY });
    const company = mintSession(pat, { now, key: KEY });
    expect(readSession(owner, "owner", { now: at("2026-11-07T11:59:00Z"), key: KEY })).not.toBeNull();
    expect(readSession(owner, "owner", { now: at("2026-11-07T12:01:00Z"), key: KEY })).toBeNull();
    expect(readSession(company, "company", { now: at("2026-11-14T09:59:00Z"), key: KEY })).not.toBeNull();
    expect(readSession(company, "company", { now: at("2026-11-14T10:01:00Z"), key: KEY })).toBeNull();
  });

  it("refuses the dev secret in production", () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "id");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("OPENAI_API_KEY", "sk");
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => mintSession(pat)).toThrow(/SESSION_SECRET/);
  });
});

describe("safeNext", () => {
  it("keeps same-site paths and drops everything else", () => {
    expect(safeNext("/r/kikea-x-vesolje/code?x=1", "/")).toBe("/r/kikea-x-vesolje/code?x=1");
    for (const bad of [null, "", "console", "//evil.test", "/\\evil.test", "https://evil.test/console"]) expect(safeNext(bad, "/console")).toBe("/console");
  });
});
