import type { ReactNode } from "react";
import { Button } from "@/components/ui";

/** A link that leads nowhere: what's missing, where the right link is, and one way on. */
export function NotFoundCard({
  title = "We can't find this recall",
  description = "Use the link or QR code on your recall notice.",
  action,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    // On the claim flow's own 960px column, so its left edge is every step's.
    <section aria-labelledby="not-found-title" className="mx-auto flex w-full max-w-[60rem] flex-col items-start gap-4 pt-8 sm:pt-16 [&>*]:max-w-claim">
      <h1 id="not-found-title" className="text-title font-semibold text-balance text-text">
        {title}
      </h1>
      <p className="text-body text-muted">{description}</p>
      <div className="pt-2">
        {action ?? (
          <Button href="/" variant="secondary">
            Go to Remedy
          </Button>
        )}
      </div>
    </section>
  );
}
