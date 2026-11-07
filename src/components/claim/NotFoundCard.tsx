import { Button, EmptyState } from "@/components/ui";

/** An unknown recall link, or a claim that belongs to another PayPal account (never said which). */
export function NotFoundCard({
  description = "The recall link may be mistyped, or this claim belongs to a different PayPal account. Use the link or QR code on the company's recall notice.",
}: {
  description?: string;
}) {
  return (
    <EmptyState
      eyebrow="Not found"
      title="Nothing at this link"
      description={description}
      action={
        <Button href="/" variant="secondary">
          Go to Remedy
        </Button>
      }
      className="bg-surface"
    />
  );
}
