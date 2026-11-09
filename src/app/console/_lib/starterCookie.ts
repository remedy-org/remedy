import "server-only";
import { cookies } from "next/headers";
import { cookieOptions, type Session } from "@/lib/session";
import type { Claim } from "@/lib/types";
import { encodeDecisions, STARTER_COOKIE, STARTER_MAX_AGE, type StarterDecision, type StarterDecisions } from "./starter";

/** A starter claim this company already decided: the 409's message, as a stored claim decided elsewhere says it. */
export const starterDecided = (claim: Pick<Claim, "id" | "seeded">, decided: StarterDecisions): string | null => {
  const d = claim.seeded ? decided[claim.id] : undefined;
  return d ? `This claim is already ${d.k === "approve" ? "paid" : "rejected"}.` : null;
};

/** Keeps a starter claim's decision for this company in its browser (route handlers only: they can set cookies). */
export async function keepDecision(session: Pick<Session, "payerId"> & { decided: StarterDecisions }, id: string, d: StarterDecision) {
  (await cookies()).set(STARTER_COOKIE, encodeDecisions(session.payerId, { ...session.decided, [id]: d }), cookieOptions(STARTER_MAX_AGE));
}
