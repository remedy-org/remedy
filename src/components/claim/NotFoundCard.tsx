import type { ReactNode } from "react";
import { Button } from "@/components/ui";

/** A link that leads nowhere (or a page that failed): what's missing, where the right link is, and one way on. */
export function NotFoundCard({
  title = "We can't find this recall",
  description = "Use the link or QR code on your recall notice.",
  action,
  alert,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Something failed rather than went missing: announced as it renders. */
  alert?: boolean;
}) {
  return (
    // On the claim flow's own 960px column, so its left edge is every step's.
    <section aria-labelledby="not-found-title" role={alert ? "alert" : undefined} className="mx-auto flex w-full max-w-[60rem] flex-col items-start gap-4 pt-8 sm:pt-16 [&>*]:max-w-claim">
      <h1 id="not-found-title" className="text-title font-medium text-balance text-text">
        {title}
      </h1>
      <p className="text-body text-pretty text-muted">{description}</p>
      <div className="pt-4">
        {action ?? (
          <Button href="/" size="lg">
            Go to Remedy
          </Button>
        )}
      </div>
    </section>
  );
}
