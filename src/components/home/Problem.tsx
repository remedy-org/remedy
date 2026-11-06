import { Section } from "./Section";

// Facts from IDEA.md §2.2 (each marked VERIFIED there): the PIRG report, the CPSC recalls API pull for 1 Oct-5 Nov
// 2026, the Kikea notice itself, and the CPSC's request for information.
const STATS = [
  {
    figure: "6–10%",
    text: "of recalled products are ever returned or destroyed. The rest stay in homes.",
    source: "PIRG, Too Much to Recall, January 2024",
    href: "https://publicinterestnetwork.org/wp-content/uploads/2024/01/TOO-MUCH-TO-RECALL-FINAL-1-11-1.pdf",
  },
  {
    figure: "20 of 27",
    text: "refund recalls that asked for a photo from 1 October to 5 November 2026 had owners email it to an inbox.",
    source: "CPSC recalls API, our count",
    href: "https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2026-10-01&RecallDateEnd=2026-11-05",
  },
];

const QUOTES = [
  {
    who: "The inbox",
    quote: (
      <>
        &ldquo;&hellip;cut the pillow in half after confirming the recalled pillow with the firm and send a photo of the destroyed pillow to{" "}
        <span className="font-mono text-accent-text">z•••••929@gmail.com</span>.&rdquo;
      </>
    ),
    source: "Kikea Store, CPSC recall 27-071: 19,596 nursing pillows.",
    href: "https://www.cpsc.gov/Recalls/2027/Kikea-Store-Recalls-X-VESOLJE-Nursing-Pillows-Due-to-Risk-of-Serious-Injury-or-Death-from-Suffocation-Violate-Mandatory-Standards-for-Nursing-Pillows",
  },
  {
    who: "The regulator",
    quote: (
      <>
        &ldquo;&hellip;altered, fabricated, or artificially generated images&hellip; purporting to demonstrate product destruction.&rdquo;
      </>
    ),
    source: "CPSC request for information CPSC-2026-0067, 15 April 2026.",
    href: "https://public-inspection.federalregister.gov/2026-07328.pdf",
  },
];

export function Problem() {
  return (
    <Section
      id="problem"
      exhibit="A · The problem"
      title="Recall refunds run on an inbox."
      muted="AI broke the inbox."
      lead="To get a refund, owners destroy the product and email a photo. Someone at the company checks each one by hand, and an image model can now draw that photo."
    >
      <dl className="grid gap-y-10 md:grid-cols-2 md:gap-x-12">
        {STATS.map((s) => (
          <div key={s.figure} className="border-t border-line pt-6">
            <dt className="text-h2 font-semibold tabular-nums sm:text-h1">{s.figure}</dt>
            <dd className="mt-3 max-w-[44ch]">
              <p className="text-body text-pretty text-muted">{s.text}</p>
              <a href={s.href} className="mt-2 inline-flex min-h-11 items-center text-ui text-faint underline-offset-4 transition-colors duration-160 hover:text-text hover:underline">
                {s.source}
              </a>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:mt-16">
        {QUOTES.map((q) => (
          <figure key={q.who} className="m-0 flex flex-col rounded-card border border-line bg-surface">
            <span className="micro px-6 pt-6 text-faint sm:px-8 sm:pt-8">{q.who}</span>
            <blockquote className="flex-1 px-6 pt-4 pb-8 sm:px-8">
              <p className="text-body text-text sm:text-lead">{q.quote}</p>
            </blockquote>
            <figcaption className="border-t border-line px-6 py-3 sm:px-8">
              <a href={q.href} className="inline-flex min-h-11 items-center text-ui text-muted underline-offset-4 transition-colors duration-160 hover:text-text hover:underline">
                {q.source}
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-8 max-w-read text-body text-muted">
        The same request warns that fraud controls can &ldquo;reduce recall participation&rdquo;. Remedy keeps the refund easy for a real owner and expensive for a fake.
      </p>
    </Section>
  );
}
