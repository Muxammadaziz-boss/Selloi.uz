import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Selloi.uz — Telegram uchun 24/7 AI sotuvchi",
    short_name: "Selloi.uz",
    description:
      "Selloi.uz — Telegram do‘koningiz uchun sun’iy intellekt sotuvchi platformasi.",
    start_url: "/",
    display: "standalone",
    background_color: "#0D0D0D",
    theme_color: "#0D0D0D",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
