// A demo round: one browser's run through the four samples, kept in an httpOnly cookie. Demo claims are checked only
// against claims of their own round, so judges sharing one sandbox login each see the same four outcomes, and a judge
// can start a new round to see them again. Pure, no Next imports: the proxy and scripts use it too.

export const DEMO_ROUND_COOKIE = "remedy_demo_round";

const ROUND = /^dr_[0-9a-f]{32}$/;

export const newDemoRound = () => `dr_${crypto.randomUUID().replaceAll("-", "")}`;

/** The cookie's round, or null when it's missing or isn't one. */
export const parseDemoRound = (value: string | null | undefined) => (value && ROUND.test(value) ? value : null);

export const demoRoundCookie = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 7 * 24 * 60 * 60,
});
