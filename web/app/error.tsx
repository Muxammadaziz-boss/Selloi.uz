"use client";

import React, { useEffect } from "react";
import { IconAlertTriangle, IconRefresh, IconHome } from "@tabler/icons-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Selloi client boundary error:", error);
  }, [error]);

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center p-4"
      style={{
        backgroundColor: "var(--bg-canvas, #0d0d10)",
        color: "var(--text-primary, #f4f4f6)",
      }}
    >
      <div
        className="p-4 p-md-5 text-center border rounded-4 shadow-lg"
        style={{
          maxWidth: 460,
          width: "100%",
          backgroundColor: "var(--bg-surface, #151519)",
          borderColor: "var(--border-default, #2d2d35)",
        }}
      >
        <div
          className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
          style={{
            width: 56,
            height: 56,
            backgroundColor: "rgba(255, 76, 99, 0.14)",
            color: "#FF4C63",
          }}
        >
          <IconAlertTriangle size={28} />
        </div>
        <h2 className="fw-bold mb-2" style={{ fontSize: "1.35rem" }}>
          Kutilmagan xatolik yuz berdi
        </h2>
        <p className="text-secondary small mb-4" style={{ lineHeight: 1.55 }}>
          Sahifani yuklashda texnik nosozlik kuzatildi. Qayta urinib ko&apos;ring yoki bosh sahifaga qayting.
        </p>
        <div className="d-flex flex-wrap align-items-center justify-content-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="btn btn-primary d-inline-flex align-items-center gap-1.5 px-3.5 py-2 fw-semibold"
          >
            <IconRefresh size={16} />
            <span>Qayta yuklash</span>
          </button>
          <a
            href="/"
            className="btn btn-outline-secondary d-inline-flex align-items-center gap-1.5 px-3.5 py-2"
          >
            <IconHome size={16} />
            <span>Bosh sahifa</span>
          </a>
        </div>
      </div>
    </div>
  );
}
