import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Public crawlable surfaces: the landing page plus the static
 * dossier/protocol pages. Every workspace route redirects signed-out
 * visitors (including crawlers) to sign-in.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/", "/about", "/contact", "/privacy", "/cookies", "/terms"];
  return pages.map((path, index) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: index === 0 ? 1 : 0.5,
  }));
}
