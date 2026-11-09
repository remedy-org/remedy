import type { MetadataRoute } from "next";

// The same origin as the layout's metadataBase: APP_URL, else Vercel's production domain, else the local dev server.
const origin = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://127.0.0.1:3000");

/** The public pages: the homepage, the live recall, its try page, sign-in and the legal pages. */
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/r/kikea-x-vesolje", "/r/kikea-x-vesolje/try", "/signin", "/terms", "/privacy"].map((path) => ({ url: new URL(path, origin).href }));
}
