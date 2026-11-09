import "server-only";
import { isSandboxBuild } from "./allowed";

/** A PayPal sandbox login the judges use, shown on the page that needs it. */
export interface JudgeLogin {
  email: string;
  password: string;
}

const VARS = {
  personal: ["SANDBOX_PERSONAL_EMAIL", "SANDBOX_PERSONAL_PASSWORD"],
  business: ["SANDBOX_BUSINESS_EMAIL", "SANDBOX_BUSINESS_PASSWORD"],
} as const;

/**
 * The judges' PayPal sandbox login for the owner's side (personal) or the company's (business), read from the server's
 * env. Only in a sandbox build, and null unless both values are set: the page then keeps its "in the submission notes"
 * line. Server only: the values reach the browser as the panel's rendered text and nowhere else.
 */
export function judgeLogin(account: keyof typeof VARS): JudgeLogin | null {
  if (!isSandboxBuild()) return null;
  const [email, password] = VARS[account].map((name) => unquote(process.env[name]));
  return email && password ? { email, password } : null;
}

/** A value trimmed, and unwrapped from one pair of matching quotes: an env saved as 'sb-…@personal.example.com' showed
 * its quotes on /try, and Copy carried them into PayPal's login. */
function unquote(value: string | undefined) {
  const v = value?.trim();
  const q = v?.[0];
  return v && v.length > 1 && (q === "'" || q === '"') && v.endsWith(q) ? v.slice(1, -1).trim() : v;
}
