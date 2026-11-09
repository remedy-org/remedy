/**
 * The link card's image (app/opengraph-image.tsx). Metadata merges shallowly, so a page that sets its own openGraph or
 * twitter replaces the root layout's whole object and drops the file-based image: such pages name it again.
 */
export const SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Remedy: recall refunds, paid in a minute through PayPal, once a live camera proves the product destroyed.",
};
