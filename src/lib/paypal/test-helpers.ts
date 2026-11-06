import { vi } from "vitest";

export interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | undefined;
}

// Stubs fetch with canned responses in order, and records every request. Test-only.
export function mockPayPal(...responses: { status?: number; body: unknown }[]) {
  const calls: Call[] = [];
  vi.stubEnv("PAYPAL_CLIENT_ID", "client");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
  vi.stubEnv("PAYPAL_API_BASE", "");
  vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-1");
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ method: init.method ?? "GET", url, headers: init.headers as Record<string, string>, body: init.body?.toString() });
      const next = responses.shift();
      if (!next) throw new Error(`unexpected request ${init.method} ${url}`);
      return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: { "paypal-debug-id": "dbg-1" } });
    }),
  );
  return calls;
}

export const tokenResponse = { body: { access_token: "APP-TOKEN", expires_in: 32400, token_type: "Bearer" } };
