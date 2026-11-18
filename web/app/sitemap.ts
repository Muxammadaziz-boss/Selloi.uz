import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://selloi.uz/",
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
