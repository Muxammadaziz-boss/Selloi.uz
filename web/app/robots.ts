import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/platform/", "/admin/", "/settings/", "/t/", "/invite"],
      },
    ],
    sitemap: "https://selloi.uz/sitemap.xml",
  };
}
