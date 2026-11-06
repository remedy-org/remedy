import "server-only";
import { env } from "@/lib/env";

// The owner-facing claim page for a recall, on the public app URL.
export const claimUrl = (slug: string) => new URL(`/r/${slug}`, env().APP_URL).toString();
