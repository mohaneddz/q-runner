import type { MetadataRoute } from "next";
import { SITE_URL } from "@/app/siteConfig";
import { BUILTIN_LEVELS } from "@/game/level/builtinLevels";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified, priority: 1, changeFrequency: "monthly" },
    { url: `${SITE_URL}/levels`, lastModified, priority: 0.9, changeFrequency: "monthly" },
    { url: `${SITE_URL}/endless`, lastModified, priority: 0.7, changeFrequency: "monthly" },
    { url: `${SITE_URL}/editor`, lastModified, priority: 0.6, changeFrequency: "monthly" },
    { url: `${SITE_URL}/training`, lastModified, priority: 0.6, changeFrequency: "monthly" },
  ];

  // Every shipped level is a real, linkable page, so enumerate them rather
  // than stopping at the top-level routes.
  const levelRoutes: MetadataRoute.Sitemap = BUILTIN_LEVELS.map((level) => ({
    url: `${SITE_URL}/play?level=${level.id}`,
    lastModified,
    priority: 0.8,
    changeFrequency: "yearly" as const,
  }));

  return [...staticRoutes, ...levelRoutes];
}
