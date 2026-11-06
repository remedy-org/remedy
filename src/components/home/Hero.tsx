import { Button, ExhibitLabel } from "@/components/ui";
import { SANDBOX_ACCOUNTS_URL } from "@/components/claim/model";
import { HeroDevice } from "./HeroDevice";

export function Hero() {
  return (
    <div className="overflow-clip">
    <section aria-labelledby="hero-title" className="mx-auto max-w-content px-4 pt-12 pb-18 sm:px-8 lg:pt-16 lg:pb-24">
      <div className="grid items-center gap-y-12 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:gap-x-0 xl:grid-cols-[minmax(0,36rem)_minmax(0,1fr)]">
        <div className="relative z-10">
          <ExhibitLabel leader="none">Recall refunds, verified</ExhibitLabel>
          <h1 id="hero-title" className="mt-6 text-display font-semibold">
            Proof it&rsquo;s destroyed.
            <br />
            <span className="text-muted">Paid in a minute.</span>
          </h1>
          <p className="mt-6 max-w-[34ch] text-body text-muted sm:text-lead">
            Owners cut the recalled product on a live camera, with a one-time code on it. Remedy checks the photo and pays the refund through PayPal.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
            <Button href="/signin" size="lg">
              Start a recall
            </Button>
            <Button href="/r/kikea-x-vesolje/try" variant="tertiary" size="lg">
              Try a claim with sample photos
            </Button>
          </div>
          <p className="mt-4 text-ui text-faint">
            The demo needs a PayPal sandbox personal account.{" "}
            <a href={SANDBOX_ACCOUNTS_URL} className="underline underline-offset-4 transition-colors duration-160 hover:text-text">
              How to make one
            </a>
          </p>
        </div>
        <div className="mx-auto w-full max-w-[52rem] lg:w-auto lg:-ml-10 lg:mr-[calc(-2rem_-_max(0px,(100vw_-_75rem)/2))] lg:max-w-none xl:-ml-16">
          <HeroDevice />
        </div>
      </div>
    </section>
    </div>
  );
}
