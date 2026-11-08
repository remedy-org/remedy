// Every string in the homepage's "For companies" tour (Companies.tsx, ConsoleTour.tsx, the phone story), in one place,
// ready for the site's copy policy. Numbers are never typed here: the descriptions are written from the seed's own
// totals (components/insights/still.ts), so they can't drift from the frame.

export const TOUR = {
  eyebrow: "D · For companies",
  title: "Run the whole recall from one console.",
  muted: "Every claim with its evidence, every refund through PayPal.",
  tablist: "A tour of the Remedy console",
  steps: [
    { n: "01", name: "Claims queue", sentence: "Claims arrive already decided: paid, held for a person, or refused, with the check that decided it." },
    { n: "02", name: "Evidence", sentence: "Open a held claim to see its photos and the model’s own words. Approve it, and PayPal Payouts sends the refund." },
    { n: "03", name: "Insights", sentence: "See where claims stop and what was refused before any money moved. Then ask the recall analyst why." },
    { n: "04", name: "CPSC report", sentence: "The monthly progress report drafts itself from your claim records. Check it, then file it." },
  ],
  chrome: { app: "Remedy", pages: ["Claims", "Insights", "Report"] as const, company: "Kikea Store" },
  recall: { product: "Kikea X-VESOLJE nursing pillows", id: "CPSC 27-071", badge: "Sample data" },
  /** The test-money fact, said once per screen: the frame's foot on 01 to 03, under the phone story. */
  money: "40 sample claims, never paid · RM-0442 above was paid in PayPal sandbox",
  cta: {
    body: "Log in with PayPal; there’s no separate sign-up. Your workspace opens with a demo recall and 40 sample claims, so you can see claims arrive before you import your own.",
    button: "Log in with PayPal",
  },
  /** Under the refusal reasons in step 03: what a refusal means for the money. */
  refusalNote: "A refused claim moves no money. The owner is told the exact reason and how to claim again.",
  analyst: { title: "Recall analyst", limit: "Can’t approve or pay", recorded: "Recorded answer" },
} as const;

/** Step 02's line under the evidence: what a person does here, and what approving sends through PayPal Payouts. */
export const payoutsLine = (amount: string, id: string) =>
  `A person approves or rejects it here. Approving sends ${amount} through PayPal Payouts, with ${id} as the payout’s reference.`;

export interface TourTotals {
  claims: number;
  photos: number;
  preChecked: number;
  paid: number;
  held: number;
  refused: number;
}

/** What each step's panel says to a screen reader: the frame is a picture, so this carries its content. */
export function describe(t: TourTotals, open: { id: string; amount: string }, analyst?: { question: string; answer: string } | null) {
  return [
    `The claims queue for the Kikea demo recall: ${t.claims} sample claims, ${t.paid} paid, ${t.held} held, ${t.refused} refused, newest first.`,
    `Claim ${open.id}, held: photos 1 and 2, and the model’s answer that it couldn’t tell if both photos show the same item. A person approves or rejects it; approving pays ${open.amount} through PayPal Payouts.`,
    `Insights: of ${t.claims} claims, ${t.photos} sent photos, ${t.preChecked} passed the pre-checks, ${t.paid} passed the photo check and were paid; ${t.refused} were refused before any money moved.` +
      (analyst ? ` Recall analyst, asked “${analyst.question}”: ${analyst.answer}` : ""),
    `The CPSC progress report draft for recall 27-071, built from the same ${t.claims} sample claims.`,
  ];
}
