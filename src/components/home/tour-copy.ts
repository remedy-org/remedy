// Every string in the homepage's "For companies" tour (Companies.tsx, ConsoleTour.tsx, the phone story), in one place,
// in the product's own voice. Numbers are never typed here: the descriptions are written from the seed's own
// totals (components/insights/still.ts), so they can't drift from the frame.

export const TOUR = {
  title: "Run the whole recall from one console.",
  muted: "Every claim, its evidence and its PayPal refund.",
  tablist: "A tour of the Remedy console",
  steps: [
    { name: "Claims queue", sentence: "Every claim lands decided in one AG Grid queue: paid, held for a person, or refused." },
    { name: "Evidence", sentence: "See a held claim’s photos and the model’s words. Approve, and PayPal Payouts refunds it." },
    { name: "Insights", sentence: "AG Studio shows where claims stop, why each was refused, and what PayPal paid each day." },
    { name: "CPSC report", sentence: "The monthly CPSC progress report drafts itself from the claims. Review it, then file." },
  ],
  chrome: { app: "Remedy", pages: ["Claims", "Insights", "Report"] as const, company: "Kikea Store" },
  recall: { product: "Kikea X-VESOLJE nursing pillows", id: "CPSC 27-071" },
  /** The frame's quiet credit, per step: the SDK that step is built on (none on the report, which is Remedy's own). */
  credit: ["Built on AG Grid", "Built on AG Grid", "Built on AG Studio", null] as const,
  /** Step 03's sentence goes on to the analyst only when a recorded answer is there to show (AnalystRail.tsx). */
  analystSentence: " Then ask the recall analyst why.",
  cta: {
    body: "No separate sign-up. Your console opens on a working recall, ready the moment you import your own.",
    button: "Log in with PayPal",
  },
  /** Step 02's payout path under the evidence (PayoutsNote.tsx); the sentence below says it in full for screen readers. */
  payouts: { approve: "Approve", via: "PayPal Payouts", reference: "Payout reference" },
  analyst: { title: "Recall analyst", limit: "Can’t approve or pay", recorded: "Recorded answer" },
} as const;

/** Step 02 on a phone, where nothing opens: the held claim, tinted in the queue above, shown open. */
export const storyEvidence = (id: string) => `The held claim, ${id}, opens to its photos and the model’s own words. Approve, and PayPal Payouts sends the refund.`;

/** The four steps' sentences: step 03 names the recall analyst only when its recorded answer is on screen. */
export const stepSentences = (analyst: boolean) => TOUR.steps.map((s, i) => s.sentence + (i === 2 && analyst ? TOUR.analystSentence : ""));

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
    `The claims queue for the Kikea recall, in AG Grid: ${t.claims} claims, ${t.paid} paid, ${t.held} held, ${t.refused} refused. Click a held claim to open its evidence, filter it by status, or sort it by claim, verdict or timeline.`,
    `Claim ${open.id}, held: photos 1 and 2, and the model’s answer that it couldn’t tell if both photos show the same item. A person approves or rejects it; approving pays ${open.amount} through PayPal Payouts.`,
    `Insights, in AG Studio: of ${t.claims} claims, ${t.photos} sent photos, ${t.preChecked} passed the pre-checks, ${t.paid} passed the photo check and were paid; ${t.refused} were refused. Payouts by day beside it.` +
      (analyst ? ` Recall analyst, asked “${analyst.question}”: ${analyst.answer}` : ""),
    `The CPSC progress report draft for recall 27-071, built from the same ${t.claims} claims: units remedied, claims by outcome, refunds paid and why claims were refused.`,
  ];
}
