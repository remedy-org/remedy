import { Button } from "@/components/ui";
import { NotFoundCard } from "./NotFoundCard";

/**
 * A claim page that failed to render (shared with the dev preview), on the flow's own column like a missing link: what
 * happened, that the claim and its money are safe, and two ways on.
 */
export function ClaimErrorCard({ recall, id, onRetry }: { recall?: string; id?: string; onRetry?: () => void }) {
  return (
    <NotFoundCard
      alert
      title="This page didn’t load"
      description={
        <>
          Something on our side didn&rsquo;t answer, so nothing changed and nothing was paid.{" "}
          {id ? (
            <>
              Claim <span className="font-mono whitespace-nowrap">{id}</span> is saved
            </>
          ) : (
            "Any claim you started is saved"
          )}
          , and photos already sent are still being checked.
        </>
      }
      action={
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button size="lg" onClick={onRetry}>
            Try again
          </Button>
          {recall && (
            <Button href={`/r/${recall}`} variant="tertiary" size="sm" prefetch={false}>
              Back to the recall
            </Button>
          )}
        </div>
      }
    />
  );
}
