// The Claim Check mark's master drawing on its 24 x 16 grid, shared by RemedyMark (ui/Wordmark.tsx), the link card
// (app/opengraph-image.tsx) and scripts/apple-icon.ts, so the three never drift. Wordmark.tsx explains the geometry.

/** The cream tag: 45deg chamfers at the point, six even 90deg teeth peaking on x 13, and the punched hole (evenodd). */
export const MARK_TAG =
  "M0 3.5L3.5 0H13L11.667 1.333L13 2.667L11.667 4L13 5.333L11.667 6.667L13 8L11.667 9.333L13 10.667L11.667 12L13 13.333L11.667 14.667L13 16H3.5L0 12.5ZM5.25 8A1.25 1.25 0 1 0 2.75 8A1.25 1.25 0 1 0 5.25 8Z";

/** The amber stub: the tag's torn edge moved 2 right; its outer sides skewed -8deg about x 15, so it lifts as rigid paper. */
export const MARK_STUB =
  "M15 0L23 -1.124V14.876L15 16L13.667 14.667L15 13.333L13.667 12L15 10.667L13.667 9.333L15 8L13.667 6.667L15 5.333L13.667 4L15 2.667L13.667 1.333Z";
