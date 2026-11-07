import { beforeEach, describe, expect, it, vi } from "vitest";
import { PayPalError } from "../paypal/client";
import { beginLogin, callbackUrl, checkState, errorPath, loginFailure, STATE_MAX_AGE } from "./paypal-login";

beforeEach(() => {
  vi.stubEnv("PAYPAL_CLIENT_ID", "id");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
  vi.stubEnv("OPENAI_API_KEY", "sk");
  vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
  vi.stubEnv("SESSION_SECRET", "s".repeat(40));
});

const now = new Date("2026-11-07T10:00:00Z");

describe("Log in with PayPal state", () => {
  it("returns to APP_URL's callback", () => {
    expect(callbackUrl()).toBe("http://127.0.0.1:3000/api/auth/paypal/callback");
  });

  it("round-trips the role and a safe next path", () => {
    const begun = beginLogin(new URLSearchParams({ as: "owner", next: "/r/kikea-x-vesolje/code" }), now);
    if ("error" in begun) throw new Error("expected a login");
    expect(checkState(begun.cookie, begun.state.state, now)).toMatchObject({ as: "owner", next: "/r/kikea-x-vesolje/code" });
  });

  it("defaults next per role and never leaves the site", () => {
    const begun = beginLogin(new URLSearchParams({ as: "company", next: "https://evil.test" }), now);
    if ("error" in begun) throw new Error("expected a login");
    expect(begun.state.next).toBe("/console");
    expect(beginLogin(new URLSearchParams({ as: "admin" }), now)).toEqual({ error: "role" });
  });

  it("refuses a wrong, missing or stale state", () => {
    const begun = beginLogin(new URLSearchParams({ as: "company" }), now);
    if ("error" in begun) throw new Error("expected a login");
    expect(checkState(begun.cookie, "other", now)).toBeNull();
    expect(checkState(undefined, begun.state.state, now)).toBeNull();
    expect(checkState(begun.cookie, null, now)).toBeNull();
    expect(checkState(begun.cookie, begun.state.state, new Date(now.getTime() + (STATE_MAX_AGE + 1) * 1000))).toBeNull();
  });

  it("sends a failed login back with the reason", () => {
    const begun = beginLogin(new URLSearchParams({ as: "company", next: "/console/report" }), now);
    if ("error" in begun) throw new Error("expected a login");
    expect(errorPath(begun.state, "denied")).toBe("/signin?next=%2Fconsole%2Freport&auth_error=denied");
    expect(errorPath({ ...begun.state, as: "owner", next: "/r/kikea-x-vesolje" }, "paypal")).toBe("/r/kikea-x-vesolje?auth_error=paypal");
    expect(errorPath(null, "state")).toBe("/signin?auth_error=state");
  });

  it("sends an owner back to the recall screen, not to a step that would start another login", () => {
    const owner = (next: string) => ({ state: "s".repeat(16), as: "owner" as const, next, iat: 0 });
    expect(errorPath(owner("/api/claims/start?recall=kikea-x-vesolje"), "refused")).toBe("/r/kikea-x-vesolje?auth_error=refused");
    expect(errorPath(owner("/r/kikea-x-vesolje/try/samples"), "refused")).toBe("/r/kikea-x-vesolje/try?auth_error=refused");
    expect(errorPath(owner("/r/kikea-x-vesolje/try/RM-0412"), "paypal")).toBe("/r/kikea-x-vesolje/try?auth_error=paypal");
    expect(errorPath(owner("/r/kikea-x-vesolje/claim/RM-0412"), "denied")).toBe("/r/kikea-x-vesolje?auth_error=denied");
    expect(errorPath(owner("/api/claims/start?recall=../x"), "paypal")).toBe("/api/claims/start?recall=..%2Fx&auth_error=paypal");
    expect(errorPath(owner("/"), "paypal")).toBe("/?auth_error=paypal");
  });

  it("tells a PayPal refusal from an outage", () => {
    const paypalError = (status: number) => new PayPalError(`GET /v1/identity/openidconnect/userinfo?schema=openid -> ${status} :`, status, undefined, null, {});
    expect(loginFailure(paypalError(401))).toBe("refused");
    expect(loginFailure(paypalError(403))).toBe("refused");
    expect(loginFailure(paypalError(400))).toBe("paypal");
    expect(loginFailure(paypalError(500))).toBe("paypal");
    expect(loginFailure(paypalError(503))).toBe("paypal");
    expect(loginFailure(new TypeError("fetch failed"))).toBe("paypal");
    // Our app's id or secret is wrong: no other account would get in.
    expect(loginFailure(new PayPalError("POST /v1/oauth2/token -> 401 invalid_client: Client Authentication failed", 401, "invalid_client", null, {}))).toBe("paypal");
    expect(loginFailure(new DOMException("The operation timed out.", "TimeoutError"))).toBe("paypal");
    expect(errorPath(null, "refused")).toBe("/signin?auth_error=refused");
  });
});
