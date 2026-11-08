"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui";
import { NotFoundCard } from "./NotFoundCard";

/** An unknown claim, or another PayPal account's (never said which): the claim's number, and a way to start one. */
export function ClaimNotFound({ demo }: { demo?: boolean }) {
  const { recall, id } = useParams<{ recall: string; id: string }>();
  return (
    <NotFoundCard
      title={
        <>
          We can&apos;t find claim <span className="font-mono">{id}</span>
        </>
      }
      description="Check the link, or log in with the PayPal account that started it."
      action={
        <Button href={demo ? `/r/${recall}/try` : `/r/${recall}`} variant="secondary" prefetch={false}>
          Start your claim
        </Button>
      }
    />
  );
}
