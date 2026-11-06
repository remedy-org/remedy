import type { Recall } from "../types";
import { DEMO_RECALL_ID } from "./kikea";

// The judges' demo (/r/<slug>/try and sample claims) runs only on the Kikea demo recall, and only while payouts go to
// PayPal's sandbox: a sample photo must never be paid with real money, or on a company's own recall. Reads
// PAYPAL_API_BASE with env.ts's default, without requiring the rest of the env.
export function isDemoAllowed(recall: Pick<Recall, "id">): boolean {
  if (recall.id !== DEMO_RECALL_ID) return false;
  try {
    return new URL(process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com").hostname.split(".").includes("sandbox");
  } catch {
    return false;
  }
}
