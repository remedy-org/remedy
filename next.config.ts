import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reviewers open the dev server at 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  // No "N" badge in dev screenshots (Devpost stills and the /dev previews).
  devIndicators: false,
  // The demo claims' photos (lib/demo/dataset.ts), which the console's photo route reads from public/demo.
  outputFileTracingIncludes: { "/api/console/claims/\\[id\\]/photos/\\[n\\]": ["./public/demo/*.jpg"] },
};

export default nextConfig;
