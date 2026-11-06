import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../env";

export class PayPalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    // PayPal's error name, e.g. "INSUFFICIENT_FUNDS" or "invalid_client".
    readonly issue: string | undefined,
    readonly debugId: string | null,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "PayPalError";
  }
}

// "app" = cached client-credentials token; "basic" = client id and secret (token endpoints); bearer = a user's token.
export type Auth = "app" | "basic" | { bearer: string };

export interface RequestOptions {
  auth?: Auth;
  json?: unknown;
  // A JSON body sent byte for byte (webhook verification must not re-serialize the event).
  raw?: string;
  form?: Record<string, string>;
  // Same id = same result: PayPal replays the first response instead of acting twice.
  requestId?: string;
}

const Token = z.object({ access_token: z.string(), expires_in: z.number() });
let cached: { value: string; expiresAt: number } | null = null;

function basic() {
  const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = env();
  return "Basic " + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
}

// Refreshed a minute early so a token never expires mid-request.
export async function appToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.value;
  const t = await paypal("POST", "/v1/oauth2/token", Token, { auth: "basic", form: { grant_type: "client_credentials" } });
  cached = { value: t.access_token, expiresAt: Date.now() + (t.expires_in - 60) * 1000 };
  return t.access_token;
}

export async function paypal<S extends z.ZodType>(
  method: "GET" | "POST",
  path: string,
  schema: S,
  { auth = "app", json, raw, form, requestId }: RequestOptions = {},
): Promise<z.infer<S>> {
  const headers: Record<string, string> = {
    Authorization: auth === "basic" ? basic() : `Bearer ${auth === "app" ? await appToken() : auth.bearer}`,
  };
  if (method === "POST") headers["PayPal-Request-Id"] = requestId ?? randomUUID();
  if (form) headers["Content-Type"] = "application/x-www-form-urlencoded";
  else if (json !== undefined || raw !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(env().PAYPAL_API_BASE + path, {
    method,
    headers,
    body: form ? new URLSearchParams(form) : raw ?? (json !== undefined ? JSON.stringify(json) : undefined),
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const issue = (body.name ?? body.error) as string | undefined;
    const detail = (body.message ?? body.error_description ?? "") as string;
    throw new PayPalError(`${method} ${path} -> ${res.status} ${issue ?? ""}: ${detail}`, res.status, issue, res.headers.get("paypal-debug-id"), body);
  }
  return schema.parse(body);
}
