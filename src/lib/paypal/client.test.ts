import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPayPal, tokenResponse } from "./test-helpers";

// Fresh module per test, so the token cache starts empty.
beforeEach(() => vi.resetModules());
const load = () => import("./client");
const Any = z.object({}).loose();

describe("paypal client", () => {
  it("fetches an app token with basic auth and reuses it until it expires", async () => {
    const calls = mockPayPal(tokenResponse, { body: {} }, { body: {} });
    const { paypal } = await load();
    await paypal("GET", "/v1/a", Any);
    await paypal("GET", "/v1/b", Any);

    expect(calls.map((c) => c.url)).toEqual([
      "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      "https://api-m.sandbox.paypal.com/v1/a",
      "https://api-m.sandbox.paypal.com/v1/b",
    ]);
    expect(calls[0].headers.Authorization).toBe(`Basic ${Buffer.from("client:secret").toString("base64")}`);
    expect(calls[0].body).toBe("grant_type=client_credentials");
    expect(calls[1].headers.Authorization).toBe("Bearer APP-TOKEN");
  });

  it("gets a new token a minute before the old one expires", async () => {
    vi.useFakeTimers();
    const calls = mockPayPal({ body: { access_token: "T1", expires_in: 120 } }, { body: {} }, { body: { access_token: "T2", expires_in: 120 } }, { body: {} });
    const { paypal } = await load();
    await paypal("GET", "/v1/a", Any);
    vi.advanceTimersByTime(61_000);
    await paypal("GET", "/v1/a", Any);
    vi.useRealTimers();
    expect(calls.map((c) => c.headers.Authorization).slice(1)).toEqual(["Bearer T1", expect.stringMatching(/^Basic /), "Bearer T2"]);
  });

  it("sends the given PayPal-Request-Id on POST, a random one otherwise", async () => {
    const calls = mockPayPal(tokenResponse, { body: {} }, { body: {} });
    const { paypal } = await load();
    await paypal("POST", "/v1/x", Any, { json: { a: 1 }, requestId: "RM-0412" });
    await paypal("POST", "/v1/x", Any, { json: { a: 1 } });
    expect(calls[1].headers["PayPal-Request-Id"]).toBe("RM-0412");
    expect(calls[2].headers["PayPal-Request-Id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls[1].headers["Content-Type"]).toBe("application/json");
    expect(calls[1].body).toBe('{"a":1}');
  });

  it("throws a typed error with PayPal's issue and debug id", async () => {
    mockPayPal(tokenResponse, { status: 422, body: { name: "INSUFFICIENT_FUNDS", message: "Sender has insufficient funds" } });
    const { paypal, PayPalError } = await load();
    const err = await paypal("POST", "/v1/payments/payouts", Any, { json: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(PayPalError);
    expect(err).toMatchObject({ status: 422, issue: "INSUFFICIENT_FUNDS", debugId: "dbg-1" });
    expect(err.message).toContain("Sender has insufficient funds");
  });

  it("reads OAuth-style errors too", async () => {
    mockPayPal({ status: 401, body: { error: "invalid_client", error_description: "Client Authentication failed" } });
    const { appToken } = await load();
    await expect(appToken()).rejects.toMatchObject({ status: 401, issue: "invalid_client" });
  });
});
