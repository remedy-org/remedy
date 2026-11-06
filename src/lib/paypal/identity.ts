import { z } from "zod";
import { env } from "../env";
import { paypal, PayPalError } from "./client";

// The payer ID and verified flag come from the paypalattributes scope; turn on both attributes in the app's
// "Log in with PayPal" advanced settings (docs/EVAL.md, spike 1).
const SCOPES = "openid profile email https://uri.paypal.com/services/paypalattributes";

export interface PayPalUser {
  payerId: string;
  verified: boolean;
  email: string | null;
  name: string | null;
}

// api-m.sandbox.paypal.com -> www.sandbox.paypal.com; api-m.paypal.com -> www.paypal.com.
function webBase() {
  const url = new URL(env().PAYPAL_API_BASE);
  url.hostname = url.hostname.replace(/^api-m\./, "www.");
  return url.origin;
}

// redirectUri must match the Return URL saved in the dashboard exactly. `state` is echoed back for CSRF checks.
export function loginUrl({ redirectUri, state }: { redirectUri: string; state: string }): string {
  const url = new URL(`${webBase()}/signin/authorize`);
  url.search = new URLSearchParams({
    flowEntry: "static",
    client_id: env().PAYPAL_CLIENT_ID,
    response_type: "code",
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  }).toString();
  return url.toString();
}

const UserToken = z.object({ access_token: z.string() });

export async function exchangeCode(code: string): Promise<string> {
  const t = await paypal("POST", "/v1/oauth2/token", UserToken, { auth: "basic", form: { grant_type: "authorization_code", code } });
  return t.access_token;
}

// PayPal sends verified_account as the string "true" (seen in spike 1); accept a boolean too.
const Flag = z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]);
const UserInfo = z.object({
  payer_id: z.string().optional(),
  verified_account: Flag.optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  emails: z.array(z.object({ value: z.string(), primary: z.boolean().optional() })).optional(),
});

export async function userInfo(accessToken: string): Promise<PayPalUser> {
  const auth = { bearer: accessToken };
  let info: z.infer<typeof UserInfo>;
  try {
    info = await paypal("GET", "/v1/identity/oauth2/userinfo?schema=paypalv1.1", UserInfo, { auth });
  } catch (e) {
    if (!(e instanceof PayPalError)) throw e;
    info = await paypal("GET", "/v1/identity/openidconnect/userinfo?schema=openid", UserInfo, { auth });
  }
  if (!info.payer_id) throw new Error("PayPal returned no payer ID: enable the PayPal account ID attribute on the app");
  const email = info.emails?.find((e) => e.primary)?.value ?? info.emails?.[0]?.value ?? info.email ?? null;
  return { payerId: info.payer_id, verified: info.verified_account ?? false, email, name: info.name ?? null };
}

// The callback's one call: authorization code in, PayPal identity out.
export async function identify(code: string): Promise<PayPalUser> {
  return userInfo(await exchangeCode(code));
}
