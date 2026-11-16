"use client";

import React, { useState } from "react";
import { IconInfoCircle } from "@tabler/icons-react";

export interface TooltipProps {
  content: React.ReactNode;
  children?: React.ReactNode;
  title?: string;
  className?: string;
}

export function Tooltip({ content, children, title, className = "" }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className={`position-relative d-inline-flex align-items-center ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      <button
        type="button"
        aria-label={title || "Ma'lumot"}
        className="btn btn-link p-0 d-inline-flex align-items-center text-secondary border-0 transition-fast"
        style={{
          color: isVisible ? "var(--accent)" : "var(--text-tertiary)",
          cursor: "help",
          lineHeight: 1,
        }}
        onClick={(e) => {
          e.preventDefault();
          setIsVisible(!isVisible);
        }}
      >
        {children || <IconInfoCircle size={15} />}
      </button>

      {isVisible && (
        <div
          role="tooltip"
          className="position-absolute rounded-2 p-2 border shadow-lg"
          style={{
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            minWidth: "220px",
            maxWidth: "300px",
            backgroundColor: "var(--bg-surface-elevated)",
            borderColor: "var(--border-strong)",
            color: "var(--text-primary)",
            fontSize: "0.76rem",
            lineHeight: 1.4,
            zIndex: 1050,
            pointerEvents: "none",
          }}
        >
          {title && <div className="fw-bold mb-1 text-primary">{title}</div>}
          <div className="text-secondary">{content}</div>
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              marginLeft: "-5px",
              borderWidth: "5px",
              borderStyle: "solid",
              borderColor: "var(--bg-surface-elevated) transparent transparent transparent",
            }}
          />
        </div>
      )}
    </div>
  );
}
