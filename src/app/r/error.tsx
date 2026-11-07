"use client";

import { useParams } from "next/navigation";
import { ClaimErrorCard } from "@/components/claim/ClaimErrorCard";
import { FlowShell } from "@/components/claim/FlowShell";

// Anything that throws while a claim page renders: the store or PayPal down. The claim itself is saved.
export default function ClaimError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { recall, id } = useParams<{ recall?: string; id?: string }>();
  return (
    <FlowShell>
      <ClaimErrorCard recall={recall} id={id} onRetry={() => retry()} />
    </FlowShell>
  );
}
