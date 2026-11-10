import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Compile the same font choice into static and dynamic routes. Public assets are served by the CDN, so a
// serverless page must not try to discover their presence from its runtime filesystem.
const diatype = ["regular.woff2", "bold.woff2"].every((file) => existsSync(join(process.cwd(), "public/fonts/diatype", file)));

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_DIATYPE_ENABLED: diatype ? "1" : "0" },
  // Reviewers open the dev server at 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  // No "N" badge in dev screenshots (Devpost stills and the /dev previews).
  devIndicators: false,
  // The demo claims' photos (lib/demo/dataset.ts), which the console's photo route reads from public/demo.
  outputFileTracingIncludes: {
    "/api/console/claims/\\[id\\]/photos/\\[n\\]": ["./public/demo/*.jpg"],
    // A demo claim's photos are the samples' own files (lib/demo samplePhotoKey): the check and the result read them here.
    "/api/claims/\\[id\\]/photos": ["./public/demo/*.jpg"],
    "/api/claims/\\[id\\]/photos/\\[n\\]": ["./public/demo/*.jpg"],
  },
};

export default nextConfig;
