// Every string in the homepage's "For companies" tour (Companies.tsx, ConsoleTour.tsx, the phone story), in one place,
// in the product's own voice. Numbers are never typed here: the descriptions are written from the seed's own
// totals (components/insights/still.ts), so they can't drift from the frame.

export const TOUR = {
  title: "Run the whole recall from one console.",
  tablist: "A tour of the Remedy console",
  steps: [
    { name: "Claims queue", sentence: "Every claim lands in one queue already decided, as paid, held for a person, rejected or blocked." },
    { name: "Evidence", sentence: "A held claim opens to its photos and the model’s own words. Pay it there, and PayPal sends the refund." },
    { name: "Insights", sentence: "Insights shows where claims stop and why, and what PayPal paid out each day." },
    { name: "CPSC report", sentence: "The monthly CPSC progress report drafts itself from the same claims. Review it, then file." },
  ],
  /** The console window's app bar: its pages (New recall is drawn, never a step), and the recall it shows (the recall
   * switcher's place) with its auto-pay setting; the queue's toolbar and its live line, as the console draws them. */
  chrome: { pages: ["Claims", "Insights", "New recall", "Report"] as const },
  recall: { product: "X-VESOLJE nursing pillows", id: "CPSC 27-071", autoPay: "Auto-pay on" },
  toolbar: { export: "Export CSV", search: "Search claims, codes…", live: "Live · updated just now" },
  /** Step 03's sentence goes on to the analyst only when a recorded answer is there to show (AnalystRail.tsx). */
  analystSentence: " Then ask the recall analyst why.",
  cta: {
    body: "No separate sign-up. Your console opens on a working recall, ready the moment you import your own.",
    button: "Log in with PayPal",
    // What New recall really takes and does (ImportRecall.tsx), nothing more.
    recall: "New recall takes a cpsc.gov link or a recall number like 27-071, reads the product, units sold and remedy from CPSC, and drafts the checks for you to edit before you publish.",
  },
  /** Step 02's foot of the evidence (PayoutsNote.tsx): the console panel's own two buttons, drawn, never pressed. */
  payouts: { pay: (amount: string) => `Pay ${amount}…`, reject: "Reject…" },
  analyst: { title: "Recall analyst", limit: "Can’t approve or pay", recorded: "Recorded answer" },
} as const;

/** Step 02 on a phone, where nothing opens: the held claim, tinted in the queue above, shown open. */
export const storyEvidence = (id: string) => `The held claim, ${id}, opens to its photos and the model’s own words. Pay it there, and PayPal sends the refund.`;

/** The four steps' sentences: step 03 names the recall analyst only when its recorded answer is on screen. */
export const stepSentences = (analyst: boolean) => TOUR.steps.map((s, i) => s.sentence + (i === 2 && analyst ? TOUR.analystSentence : ""));

/** Step 02's line under the panel's buttons: where paying sends the money, and the payout's reference. */
export const payoutsLine = (id: string) => `Goes out through PayPal Payouts, reference ${id}.`;

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
    `The claims queue for the Kikea recall: ${t.claims} claims, ${t.paid} paid, ${t.held} held for a person, ${t.refused} rejected or blocked. Click a held claim to open its evidence, filter it by status, or sort it by claim, verdict or the photo check’s time.`,
    `Claim ${open.id}, held: photos 1 and 2, and the model’s answer that it couldn’t tell if both photos show the same item. A person pays or rejects it; paying sends ${open.amount} through PayPal Payouts.`,
    `Insights: of ${t.claims} claims, ${t.photos} sent photos, ${t.preChecked} passed the pre-checks, ${t.paid} passed the photo check and were paid; ${t.refused} were refused. Payouts by day beside it.` +
      (analyst ? ` Recall analyst, asked “${analyst.question}”: ${analyst.answer}` : ""),
    `The CPSC progress report draft for recall 27-071, built from the same ${t.claims} claims: units remedied, claims by outcome, refunds paid and why claims were refused.`,
  ];
}
