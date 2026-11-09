"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui";
import { NotFoundCard } from "./NotFoundCard";

/**
 * An unknown claim, or another PayPal account's (never said which): the claim's number when the link carries one, and
 * the way to start a claim on this recall, as the one action.
 */
export function ClaimNotFound({ demo }: { demo?: boolean }) {
  const { recall, id } = useParams<{ recall: string; id: string }>();
  // Only a claim number's shape is echoed back: anything else in the address isn't repeated as a headline.
  const shaped = /^RM-\d{4,}$/.test(id ?? "");
  return (
    <NotFoundCard
      title={
        shaped ? (
          <>
            We can&rsquo;t find claim <span className="font-mono">{id}</span>
          </>
        ) : (
          "We can’t find this claim"
        )
      }
      description="Check the link, or log in with the PayPal account that started it."
      action={
        <Button href={demo ? `/r/${recall}/try` : `/r/${recall}`} prefetch={false}>
          {demo ? "Try a claim" : "Start your claim"}
        </Button>
      }
    />
  );
}
