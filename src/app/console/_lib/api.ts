import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getSession, type Session } from "@/lib/session";

// Shared by the /api/console route handlers: the company session, zod-checked bodies and one error shape.

export interface ApiError {
  error: string;
  // Field paths to messages, for the forms.
  fields?: Record<string, string>;
  reference?: string;
  // A recall that already exists: its id, when this workspace can open it.
  existing?: string;
  // An approve the checks stopped: what they found, in the history's words.
  reasons?: string[];
}

export const fail = (status: number, error: string, extra: Omit<ApiError, "error"> = {}) => NextResponse.json<ApiError>({ error, ...extra }, { status });

export async function company(): Promise<Session | NextResponse<ApiError>> {
  const session = await getSession("company");
  return session ?? fail(401, "Your session ended. Log in with PayPal again.");
}

export async function body<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S> | NextResponse<ApiError>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, "The request body isn't JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
  return fail(400, "Some fields need a fix.", { fields });
}

export const isResponse = (v: unknown): v is NextResponse => v instanceof NextResponse;

// The name shown in a claim's history for a person's decision.
export const reviewer = (s: Session) => s.name ?? s.email ?? `PayPal ${s.payerId}`;
