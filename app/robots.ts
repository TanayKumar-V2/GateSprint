import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Crawlers get the landing page only. Workspace, accounts, admin, and
 * API routes stay out of the index (most redirect when signed out
 * anyway — this makes the intent explicit).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/practice",
          "/mentor",
          "/progress",
          "/bookmarks",
          "/u/",
          "/admin",
          "/api/",
          "/sign-in",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
