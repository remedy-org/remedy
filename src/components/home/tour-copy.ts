// Every string in the homepage's "For companies" tour (Companies.tsx, ConsoleTour.tsx, the phone story), in one place,
// in the product's own voice. Numbers are never typed here: the descriptions are written from the seed's own
// totals (components/insights/still.ts), so they can't drift from the frame.

export const TOUR = {
  title: "Run the whole recall from one console.",
  tablist: "A tour of the Remedy console",
  steps: [
    { name: "Claims", sentence: "Every claim lands in one queue and is decided the moment its photos are in: paid, held for a person, rejected or blocked." },
    { name: "Evidence", sentence: "Any claim opens to its photos and the model’s own words. Approve or reject a held one there." },
    { name: "Insights", sentence: "Insights shows where claims stop and why, and what PayPal paid out each day." },
    { name: "Report", sentence: "The monthly CPSC progress report drafts itself from the same claims. Review it, then file." },
  ],
  /** The console window's app bar: the recall it shows (the recall switcher's place: its product as CPSC titles it, then
   * "CPSC" and its number, the number alone in mono, as ConsoleNav sets it) with its auto-pay setting, and no page links
   * (the steps above the window are the tour's one set); the queue's toolbar and its foot line, as the console draws
   * them. */
  recall: { product: "X-VESOLJE Nursing Pillows", id: "27-071", autoPay: "Auto-pay on" },
  toolbar: { export: "Export CSV", search: "Search claims, codes…", live: "Updated just now", none: "No claims match this search." },
  /** Step 03's sentence goes on to the analyst only when a recorded answer is there to show (AnalystRail.tsx). */
  analystSentence: " Then ask the recall analyst why.",
  cta: {
    body: "No separate sign-up. Your console opens on a working recall. Import yours whenever you’re ready.",
    button: "Log in with PayPal",
    // Which account: the company's business account (docs/PRODUCT.md, Company sign-in), never an owner's own.
    account: "With your company’s PayPal Business account.",
    // What a buyer asks next: whose money pays the refunds and who holds it (docs/PRODUCT.md, the launch model, said in
    // the present tense as the vision is), and what a check costs (the benchmark's 1.1¢ a claim, Proof.tsx).
    facts: "Refunds go from your PayPal Business account straight to each owner’s PayPal account through PayPal Payouts, and Remedy never holds the money. Checking a claim costs 1.1¢.",
  },
  /** Step 02's foot of the evidence (PayoutsNote.tsx): the console panel's own buttons and what they lead to. The
   * recall's claims are the console's own, where approving one sends nothing (ReviewActions.tsx), so the tour says
   * Approve, as the console does, and Paid only of the claim PayPal paid. */
  payouts: {
    pay: (amount: string) => `Approve ${amount}…`,
    confirm: "Approve",
    reject: "Reject…",
    paying: "Approving…",
    rejectClaim: "Reject claim",
    rejecting: "Rejecting…",
    reason: (text: string) => `The owner reads: “${text.replace(/'/g, "’")}”`,
    sent: (amount: string, id: string) => `Sent ${amount} through PayPal Payouts, reference ${id}.`,
    approved: (amount: string) => `Approved ${amount}. Nothing was sent through PayPal.`,
    rejected: "Rejected on review. Nothing was sent, and the owner reads why.",
    refused: "Refused by the checks, so nothing was sent.",
  },
  analyst: { title: "Recall analyst", limit: "Can’t approve or pay", recorded: "Recorded answer" },
} as const;

/** Step 02 on a phone, where nothing opens: the held claim, tinted in the queue above, shown open. */
export const storyEvidence = (id: string) => `The held claim, ${id}, opens to its photos and the model’s own words. Approve or reject it there.`;

/** The four steps' sentences: step 03 names the recall analyst only when its recorded answer is on screen. */
export const stepSentences = (analyst: boolean) => TOUR.steps.map((s, i) => s.sentence + (i === 2 && analyst ? TOUR.analystSentence : ""));

/** Step 02's line under the panel's buttons: what approving does here, as the console's confirm says it. */
export const payoutsLine = (id: string) => `Approving ${id} records the decision; nothing is sent through PayPal.`;

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
    `The claims queue for the Kikea recall: ${t.claims} claims, ${t.paid} paid, ${t.held} held for a person, ${t.refused} rejected or blocked. Click a claim to open its evidence, search the queue, filter it by status, or sort it by claim, verdict or the photo check’s time.`,
    `Claim ${open.id}, held: photos 1 and 2, and the model’s answer that it couldn’t tell if both photos show the same item. A person approves or rejects it; approving records the ${open.amount} refund and sends nothing through PayPal.`,
    `Insights: of ${t.claims} claims, ${t.photos} sent photos, ${t.preChecked} passed the pre-checks, ${t.paid} passed the photo check and were paid; ${t.refused} were refused. Payouts by day beside it.` +
      (analyst ? ` Recall analyst, asked “${analyst.question}”: ${analyst.answer}` : ""),
    `The CPSC progress report draft for recall 27-071, built from the same ${t.claims} claims: units remedied, claims by outcome, refunds paid and why claims were refused.`,
  ];
}
