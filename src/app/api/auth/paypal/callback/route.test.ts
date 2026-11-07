import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { beginLogin, STATE_COOKIE } from "@/lib/auth/paypal-login";
import { mockPayPal } from "@/lib/paypal/test-helpers";

// The route reads cookie options from @/lib/session, which is marked server-only.
vi.mock("server-only", () => ({}));

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// A callback for a login started with this role and next, and the state cookie start would have set.
async function callback(as: string, next: string) {
  const begun = beginLogin(new URLSearchParams({ as, next }));
  if ("error" in begun) throw new Error("expected a login");
  const { GET } = await import("./route");
  const url = `http://127.0.0.1:3000/api/auth/paypal/callback?code=CODE&state=${begun.state.state}`;
  return GET(new NextRequest(url, { headers: { cookie: `${STATE_COOKIE}=${begun.cookie}` } }));
}

describe("GET /api/auth/paypal/callback", () => {
  it("lands an owner PayPal refused on the recall screen, which shows why, not back at PayPal", async () => {
    mockPayPal({ body: { access_token: "USER-TOKEN" } }, { status: 401, body: {} }, { status: 401, body: {} });
    const res = await callback("owner", "/api/claims/start?recall=kikea-x-vesolje");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://127.0.0.1:3000/r/kikea-x-vesolje?auth_error=refused");
  });

  it("calls bad app credentials an outage, on the demo's recall screen", async () => {
    mockPayPal({ status: 401, body: { error: "invalid_client", error_description: "Client Authentication failed" } });
    const res = await callback("owner", "/r/kikea-x-vesolje/try/samples");
    expect(res.headers.get("location")).toBe("http://127.0.0.1:3000/r/kikea-x-vesolje/try?auth_error=paypal");
  });
});
