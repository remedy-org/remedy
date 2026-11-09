import type { MetadataRoute } from "next";

// The same origin as the layout's metadataBase: APP_URL, else Vercel's production domain, else the local dev server.
const origin = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://127.0.0.1:3000");

/** Crawl everything but the dev pages and the API. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dev", "/api"] },
    sitemap: new URL("/sitemap.xml", origin).href,
  };
}
