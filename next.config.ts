import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No "N" badge in dev screenshots (Devpost stills and the /dev previews).
  devIndicators: false,
};

export default nextConfig;
