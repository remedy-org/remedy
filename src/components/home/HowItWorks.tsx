import { Section } from "./Section";

// The owner's claim flow from docs/PRODUCT.md, in four steps.
const STEPS = [
  {
    title: "Log in with PayPal",
    text: "The owner opens the recall's claim link and logs in with PayPal. No Remedy account, no form: PayPal tells us the account is verified.",
    mark: "Verified payer ID",
  },
  {
    title: "Get a one-time code",
    text: "Three characters, letter-digit-letter, with no look-alikes such as O and 0. The owner writes it on a tag. The camera session lasts 10 minutes.",
    mark: "M4T",
  },
  {
    title: "Cut it on camera",
    text: "A live camera with no upload button, on a laptop or a phone. Up to three photos: the label, the cut, the code, or one photo with all three.",
    mark: "Live capture only",
  },
  {
    title: "Paid through PayPal",
    text: "Once the checks pass, PayPal Payouts sends the refund from the company's business account to the owner's PayPal account. Remedy never holds the money.",
    mark: "$29.99 · 41 s",
  },
];

export function HowItWorks() {
  return (
    <Section
      id="how"
      exhibit="B · How it works"
      title="Four steps, about a minute."
      muted="Nothing to mail back."
      lead="The owner never makes an account with us, and the company never sees a bank detail. Everything rides on the owner's PayPal account."
    >
      <ol className="grid gap-y-10 sm:grid-cols-2 sm:gap-x-12 lg:grid-cols-4 lg:gap-x-8">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-col border-t border-line pt-6">
            <span className="micro text-faint">Step {String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-4 text-body font-semibold">{s.title}</h3>
            <p className="mt-2 text-ui text-muted">{s.text}</p>
            <span className="mt-6 inline-flex self-start rounded-control border border-line bg-surface px-2.5 py-1 font-mono text-micro text-text">{s.mark}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}
