import Image from "next/image";
import { Button, Meter, StatusPill, type Status } from "@/components/ui";
import { Section } from "./Section";

const GETS = [
  {
    title: "A claims grid with the evidence",
    text: "Every claim with its photos, the model's quoted evidence and the rule's decision. Approve or reject the held ones.",
  },
  {
    title: "Your CPSC progress report",
    text: "Drafted from the claims: units remedied against units sold, refunds paid, claims refused and why.",
  },
  {
    title: "PayPal Payouts, no onboarding for owners",
    text: "Refunds go through PayPal Payouts to the owner's verified PayPal account. In this build they're sent from Remedy's PayPal business account; at launch, from yours.",
  },
  {
    title: "Any recall, imported from the CPSC",
    text: "Paste a CPSC recall link. The model drafts the checks from the notice; you edit them and publish.",
  },
];

// A still of the console on the demo recall: the header matches the seeded workspace (26 paid of 19,596 units, 3 held,
// 9 refused) and the rows are four claims with the reasons as the console words them (src/lib/rule.ts). The codes come
// from the issued alphabet (src/lib/codes.ts: no Q, no 8); K7Q is what the wrong-code photo has written on it. The
// seeded claims themselves keep their eval photos' K7Q and R8D (src/lib/demo/seed.ts).
const ROWS: { photo: string; code: string; status: Status; reason: string }[] = [
  { photo: "/demo/c02-1.jpg", code: "M4T", status: "paid", reason: "Every check passed" },
  { photo: "/demo/c11-1.jpg", code: "K7P", status: "rejected", reason: "Written code reads K7Q; this claim's code is K7P" },
  { photo: "/demo/c08-1.jpg", code: "K7X", status: "blocked", reason: "This photo wasn't taken in this claim's camera session" },
  { photo: "/demo/c03-1.jpg", code: "R9D", status: "held", reason: "Couldn't tell if both photos show the same item" },
];

const HEADER = [
  { label: "Paid out", value: "$779.74" },
  { label: "Waiting", value: "3" },
  { label: "Refused", value: "9" },
];

function ConsoleStill() {
  return (
    <figure className="m-0 overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <span className="min-w-0 text-ui font-medium text-pretty sm:truncate">
          Kikea <span className="whitespace-nowrap">X-VESOLJE</span> nursing pillows
        </span>
        <span className="micro shrink-0 text-faint">CPSC 27-071</span>
      </div>
      <div className="grid grid-cols-3 border-b border-line">
        {HEADER.map((h) => (
          <div key={h.label} className="border-r border-line px-5 py-4 last:border-r-0">
            <div className="text-ui text-muted">{h.label}</div>
            <div className="mt-1 font-mono text-body tabular-nums">{h.value}</div>
          </div>
        ))}
      </div>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-baseline justify-between gap-4 text-ui">
          <span className="text-muted">Remedied</span>
          <span className="font-mono text-micro text-faint tabular-nums">26 of 19,596 units</span>
        </div>
        <Meter value={26} max={19596} label="Units remedied of units sold" className="mt-2" />
      </div>
      <ul>
        {ROWS.map((r) => (
          <li key={r.code} className="flex items-start gap-3 border-b border-line px-5 py-3 last:border-b-0 sm:items-center">
            <Image src={r.photo} alt="" width={40} height={40} loading="eager" className="size-10 shrink-0 rounded-control border border-line object-cover" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-mono text-ui">{r.code}</span>
              <span className="text-ui text-pretty text-muted sm:truncate">{r.reason}</span>
            </span>
            <StatusPill status={r.status} />
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">The Remedy console on the demo recall: refunds paid, claims waiting for a person, and claims refused.</figcaption>
    </figure>
  );
}

export function Companies() {
  return (
    <Section
      id="companies"
      exhibit="E · For companies"
      title="For the company running the recall."
      muted="Log in with PayPal."
      lead="There is no separate sign-up. Your workspace starts with the Kikea demo recall, so you can see claims arrive before you import your own."
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-16">
        <div>
          <ul className="grid gap-y-8 sm:grid-cols-2 sm:gap-x-10">
            {GETS.map((g) => (
              <li key={g.title} className="border-t border-line pt-6">
                <h3 className="text-body font-semibold">{g.title}</h3>
                <p className="mt-2 text-ui text-muted">{g.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3">
            <Button href="/signin" size="lg">
              Log in with PayPal
            </Button>
            <span className="text-ui text-faint">Refunds run in PayPal&rsquo;s sandbox until launch.</span>
          </div>
        </div>
        <ConsoleStill />
      </div>
    </Section>
  );
}
