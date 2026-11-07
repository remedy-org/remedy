import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPayPal } from "./test-helpers";

beforeEach(() => vi.resetModules());
const load = () => import("./identity");

describe("loginUrl", () => {
  it("builds the spike's Log in with PayPal URL on the sandbox web host", async () => {
    mockPayPal();
    const { loginUrl } = await load();
    const url = new URL(loginUrl({ redirectUri: "http://127.0.0.1:3000/callback", state: "s1" }));
    expect(url.origin + url.pathname).toBe("https://www.sandbox.paypal.com/signin/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      flowEntry: "static",
      client_id: "client",
      response_type: "code",
      scope: "openid profile email https://uri.paypal.com/services/paypalattributes",
      redirect_uri: "http://127.0.0.1:3000/callback",
      state: "s1",
    });
  });

  it("uses www.paypal.com in live", async () => {
    mockPayPal();
    vi.stubEnv("PAYPAL_API_BASE", "https://api-m.paypal.com");
    const { loginUrl } = await load();
    expect(loginUrl({ redirectUri: "https://x.test/cb", state: "s" })).toMatch(/^https:\/\/www\.paypal\.com\/signin\/authorize\?/);
  });
});

describe("identify", () => {
  it("exchanges the code, then reads payer ID and verified flag", async () => {
    const calls = mockPayPal(
      { body: { access_token: "USER-TOKEN", token_type: "Bearer" } },
      { body: { user_id: "u", name: "Pat Doe", payer_id: "47KT8H23PUJ3Q", verified_account: "true", emails: [{ value: "pat@example.com", primary: true }] } },
    );
    const { identify } = await load();
    expect(await identify("CODE")).toEqual({ payerId: "47KT8H23PUJ3Q", verified: true, email: "pat@example.com", name: "Pat Doe" });
    expect(calls[0]).toMatchObject({ method: "POST", url: expect.stringMatching(/\/v1\/oauth2\/token$/), body: "grant_type=authorization_code&code=CODE" });
    expect(calls[0].headers.Authorization).toMatch(/^Basic /);
    expect(calls[1].url).toMatch(/\/v1\/identity\/oauth2\/userinfo\?schema=paypalv1\.1$/);
    expect(calls[1].headers.Authorization).toBe("Bearer USER-TOKEN");
  });

  it("falls back to the OpenID userinfo endpoint", async () => {
    const calls = mockPayPal({ status: 403, body: { name: "PERMISSION_DENIED" } }, { body: { payer_id: "P2", verified_account: false, email: "a@b.c" } });
    const { userInfo } = await load();
    expect(await userInfo("T")).toEqual({ payerId: "P2", verified: false, email: "a@b.c", name: null });
    expect(calls[1].url).toMatch(/\/v1\/identity\/openidconnect\/userinfo\?schema=openid$/);
  });

  it("reports both userinfo endpoints refusing the token as a refusal, not an outage", async () => {
    mockPayPal({ body: { access_token: "USER-TOKEN" } }, { status: 401, body: {} }, { status: 401, body: {} });
    const { identify } = await load();
    const { loginFailure } = await import("../auth/paypal-login");
    const failure = await identify("CODE").catch((e: unknown) => e);
    expect(failure).toMatchObject({ name: "PayPalError", status: 401 });
    expect(loginFailure(failure)).toBe("refused");
  });

  it("reports PayPal refusing the app's own credentials as an outage, not a refusal of the account", async () => {
    mockPayPal({ status: 401, body: { error: "invalid_client", error_description: "Client Authentication failed" } });
    const { identify } = await load();
    const { loginFailure } = await import("../auth/paypal-login");
    const failure = await identify("CODE").catch((e: unknown) => e);
    expect(failure).toMatchObject({ name: "PayPalError", status: 401, issue: "invalid_client" });
    expect(loginFailure(failure)).toBe("paypal");
  });

  it("reports a PayPal 5xx as an outage", async () => {
    mockPayPal({ status: 503, body: { name: "SERVICE_UNAVAILABLE" } });
    const { identify } = await load();
    const { loginFailure } = await import("../auth/paypal-login");
    expect(loginFailure(await identify("CODE").catch((e: unknown) => e))).toBe("paypal");
  });

  it("refuses an identity without a payer ID", async () => {
    mockPayPal({ body: { user_id: "u" } });
    const { userInfo } = await load();
    await expect(userInfo("T")).rejects.toThrow(/no payer ID/);
  });
});
