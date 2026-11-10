import type { SVGProps } from "react";

function Glyph({ children, ...props }: SVGProps<SVGSVGElement>) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{children}</svg>;
}

export function ClaimGlyph() {
  return <Glyph><rect x="5" y="3.5" width="14" height="17" rx="3" /><path d="M8.5 8h7M8.5 12h3M8.5 16h3m2-1 1.5 1.5L18 14" /></Glyph>;
}

export function EvidenceGlyph() {
  return <Glyph><path d="M13 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7M7 13l3-3 4 4M14.5 8.5h.01" /><circle cx="17" cy="17" r="3.5" /><path d="m19.5 19.5 2 2" /></Glyph>;
}

export function QueueGlyph() {
  return <Glyph><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M3.5 9h17M9 9v10.5M13 13h4M13 16h4" /></Glyph>;
}

export function InsightsGlyph() {
  return <Glyph><path d="M4 19.5h16M6.5 15v-4M12 15V4.5M17.5 15V8" /><circle cx="6.5" cy="8" r="1" /><circle cx="17.5" cy="5" r="1" /></Glyph>;
}
