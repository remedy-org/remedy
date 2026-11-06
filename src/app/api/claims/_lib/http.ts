import "server-only";
import { NextResponse } from "next/server";
import { loginPath } from "@/lib/session";
import { ClaimError } from "./pipeline";

export const json = (status: number, error: string) => NextResponse.json({ error }, { status });

// 303 so a form POST lands on a GET. A relative Location keeps the browser on the host it used: the dev server
// reports localhost in request.url even when the page (and its cookies) are on 127.0.0.1.
export const seeOther = (path: string) => new Response(null, { status: 303, headers: { Location: path } });

export const toLogin = (next: string) => seeOther(loginPath("owner", next));

export function fail(e: unknown) {
  if (e instanceof ClaimError) return json(e.status, e.message);
  console.error("Claim request failed:", e instanceof Error ? e.message : e);
  return json(500, "Something went wrong on our side. Your claim is saved; reload the page.");
}
