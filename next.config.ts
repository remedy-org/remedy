import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reviewers open the dev server at 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  // No "N" badge in dev screenshots (Devpost stills and the /dev previews).
  devIndicators: false,
};

export default nextConfig;
