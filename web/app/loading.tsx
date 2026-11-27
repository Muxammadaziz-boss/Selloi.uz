import React from "react";
import SelloiLoader from "@/app/components/ui/SelloiLoader";

export default function Loading() {
  return (
    <div
      className="position-fixed top-0 start-0 w-100 vh-100 d-flex flex-column align-items-center justify-content-center"
      style={{
        backgroundColor: "#0B0C10",
        zIndex: 9999,
        background: "radial-gradient(circle at center, rgba(124, 58, 237, 0.12) 0%, #0B0C10 70%)",
      }}
    >
      <SelloiLoader text="Selloi…" scale={1.05} />
    </div>
  );
}
