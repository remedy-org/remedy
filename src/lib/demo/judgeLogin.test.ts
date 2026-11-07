import { describe, expect, it, vi } from "vitest";
import { judgeLogin } from "./judgeLogin";

vi.mock("server-only", () => ({}));

const set = (vars: Record<string, string>) => Object.entries(vars).forEach(([k, v]) => vi.stubEnv(k, v));
const LOGINS = {
  SANDBOX_PERSONAL_EMAIL: "judge.owner@example.test",
  SANDBOX_PERSONAL_PASSWORD: "sandbox-test-only",
  SANDBOX_BUSINESS_EMAIL: " judge.company@example.test ",
  SANDBOX_BUSINESS_PASSWORD: "sandbox-test-only",
};

describe("judgeLogin", () => {
  it("reads each account's login in a sandbox build, trimmed", () => {
    set({ ...LOGINS, PAYPAL_API_BASE: "https://api-m.sandbox.paypal.com" });
    expect(judgeLogin("personal")).toEqual({ email: "judge.owner@example.test", password: "sandbox-test-only" });
    expect(judgeLogin("business")).toEqual({ email: "judge.company@example.test", password: "sandbox-test-only" });
  });

  it("is null in a live build, even with the values set", () => {
    set({ ...LOGINS, PAYPAL_API_BASE: "https://api-m.paypal.com" });
    expect(judgeLogin("personal")).toBeNull();
    expect(judgeLogin("business")).toBeNull();
  });

  it("is null when either value is unset or blank", () => {
    set({ ...LOGINS, PAYPAL_API_BASE: "", SANDBOX_PERSONAL_PASSWORD: "", SANDBOX_BUSINESS_EMAIL: "   " });
    expect(judgeLogin("personal")).toBeNull();
    expect(judgeLogin("business")).toBeNull();
  });
});
