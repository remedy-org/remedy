import { Button, ErrorState } from "@/components/ui";

/** The card itself, shared with the dev preview: what happened, that the claim is safe, and two ways on. */
export function ClaimErrorCard({ recall, id, onRetry }: { recall?: string; id?: string; onRetry?: () => void }) {
  return (
    <ErrorState
      title="This page didn't load"
      description={
        <>
          Something on our side didn&apos;t answer, so nothing changed and nothing was paid.{" "}
          {id ? (
            <>
              Claim <span className="font-mono whitespace-nowrap">{id}</span> is saved
            </>
          ) : (
            "Any claim you started is saved"
          )}
          , and photos already sent are still being checked. Try again in a moment.
        </>
      }
      action={
        // Full width, so it's in reach of a thumb; the recall's page is the way out if trying again doesn't help.
        <div className="flex w-full flex-col gap-2">
          <Button size="lg" block onClick={onRetry}>
            Try again
          </Button>
          {recall && (
            <Button href={`/r/${recall}`} variant="tertiary" size="sm" prefetch={false} className="self-start">
              Back to the recall
            </Button>
          )}
        </div>
      }
      className="bg-surface"
    />
  );
}
