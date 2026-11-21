import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://selloi.uz";
  // Stable verified last modification timestamp for deployed releases
  const lastReleaseDate = new Date("2026-11-21T15:00:00.000Z");

  return [
    {
      url: `${baseUrl}/`,
      lastModified: lastReleaseDate,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: lastReleaseDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: lastReleaseDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
