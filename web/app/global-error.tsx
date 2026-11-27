"use client";

import React from "react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uz">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0d0d10",
          color: "#f4f4f6",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 440,
            width: "100%",
            padding: "32px",
            borderRadius: "16px",
            backgroundColor: "#151519",
            border: "1px solid #2d2d35",
            textAlign: "center",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "10px", fontSize: "20px" }}>
            Tizimda vaqtinchalik xatolik
          </h2>
          <p style={{ color: "#9ca3af", fontSize: "14px", lineHeight: 1.5, marginBottom: "24px" }}>
            Sahifani tiklash uchun quyidagi tugmani bosing.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              backgroundColor: "#FF4C63",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Qayta urinib ko&apos;rish
          </button>
        </div>
      </body>
    </html>
  );
}
