"use client";

import { usePathname } from "next/navigation";
import { SkipLink } from "@/components/ui";

/** On the claims queue, after "Skip to content": straight into the claims list (ClaimsQueue's panel takes it on to a row). */
export function ConsoleSkipLink() {
  return usePathname() === "/console" ? <SkipLink href="#claims-panel">Skip to claims</SkipLink> : null;
}
