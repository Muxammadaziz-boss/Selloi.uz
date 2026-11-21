import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/platform",
          "/platform/",
          "/api",
          "/api/",
          "/t",
          "/t/",
        ],
      },
    ],
    sitemap: "https://selloi.uz/sitemap.xml",
    host: "https://selloi.uz",
  };
}
