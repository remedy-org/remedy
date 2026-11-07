import { describe, expect, it, vi } from "vitest";
import { DEV_SESSION_SECRET, env } from "./env";

describe("env", () => {
  it("applies defaults and treats empty values as missing", () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "id");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("OPENAI_API_KEY", "sk");
    vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
    vi.stubEnv("PAYPAL_API_BASE", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("VISION_MODEL", "");
    vi.stubEnv("VISION_EFFORT", "");
    vi.stubEnv("SESSION_SECRET", "");
    const e = env();
    expect(e).toMatchObject({ PAYPAL_API_BASE: "https://api-m.sandbox.paypal.com", VISION_MODEL: "gpt-6.1-sol", VISION_EFFORT: "high" });
    expect(e.BLOB_READ_WRITE_TOKEN).toBeUndefined();
    expect(e.SESSION_SECRET).toBe(DEV_SESSION_SECRET);
  });

  it("defaults the spending limits and reads them as whole numbers", () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "id");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("OPENAI_API_KEY", "sk");
    for (const k of ["VISION_DAILY_LIMIT", "DRAFT_DAILY_LIMIT", "CLAIM_DAILY_LIMIT", "CLAIM_MONTHLY_LIMIT", "ACCOUNT_CLAIM_DAILY_LIMIT", "ACCOUNT_DEMO_DAILY_LIMIT"]) vi.stubEnv(k, "");
    expect(env()).toMatchObject({ VISION_DAILY_LIMIT: 100, DRAFT_DAILY_LIMIT: 20, CLAIM_DAILY_LIMIT: 60, CLAIM_MONTHLY_LIMIT: 150, ACCOUNT_CLAIM_DAILY_LIMIT: 5, ACCOUNT_DEMO_DAILY_LIMIT: 12 });
    vi.stubEnv("VISION_DAILY_LIMIT", "0");
    expect(env().VISION_DAILY_LIMIT).toBe(0);
    vi.stubEnv("VISION_DAILY_LIMIT", "lots");
    expect(() => env()).toThrow(/VISION_DAILY_LIMIT/);
  });

  it("names what's missing", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => env()).toThrow(/OPENAI_API_KEY/);
  });
});
