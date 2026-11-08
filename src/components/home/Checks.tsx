import { Button } from "@/components/ui";
import { Pipeline, PipelineList } from "./Pipeline";
import { Section } from "./Section";

export function Checks() {
  return (
    <Section
      id="checks"
      exhibit="Fraud checks"
      title="A fake has to beat five checks."
      muted="The first three run before any AI."
      lead="Image models can now fake a destroyed product, so Remedy never bets on spotting one. A fake has to get past the live camera, the photo fingerprint and a verified PayPal account before any model sees it."
    >
      <Pipeline />
      <PipelineList />
      <div className="mt-10 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-8 lg:mt-6">
        <Button href="/r/kikea-x-vesolje/try" variant="tertiary" size="lg">
          Try to fool it
        </Button>
      </div>
    </Section>
  );
}
