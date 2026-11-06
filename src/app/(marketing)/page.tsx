import { Button, ExhibitLabel, Wordmark } from "@/components/ui";

// Placeholder until the homepage lands: the brand, the claim and the two ways in.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col px-4 sm:px-8">
      <header className="flex h-16 items-center">
        <Wordmark size="md" href="/" />
      </header>
      <section className="flex flex-1 flex-col justify-center gap-6 py-24">
        <ExhibitLabel>CPSC 27-071 · Kikea X-VESOLJE</ExhibitLabel>
        <h1 className="max-w-[18ch] text-display font-semibold">
          Recall refunds in a minute. <span className="text-muted">Never for a faked photo.</span>
        </h1>
        <p className="max-w-read text-lead text-muted">
          Owners cut the product, write a one-time code on it and photograph it live. Remedy checks the photo and pays them through PayPal, straight from
          the company&apos;s account.
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button href="/signin" size="lg">
            Start a recall
          </Button>
          <Button href="/r/kikea-x-vesolje/try" variant="tertiary" size="lg">
            See a claim in 60 seconds
          </Button>
        </div>
      </section>
    </main>
  );
}
