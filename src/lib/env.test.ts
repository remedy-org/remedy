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

  it("names what's missing", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => env()).toThrow(/OPENAI_API_KEY/);
  });
});
