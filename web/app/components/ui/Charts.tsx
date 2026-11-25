"use client";

import React, { useState } from "react";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  centerValue: string | number;
  centerLabel?: string;
  size?: number;
  strokeWidth?: number;
}

/**
 * Lightweight Selloi SVG Donut Chart with hover segment highlighting and legend.
 */
export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  size = 152,
  strokeWidth = 16,
}: DonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const total = segments.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeFraction = 0;

  return (
    <div className="d-flex flex-column flex-sm-row align-items-center gap-4">
      <div className="position-relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel || "Chart"}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            segments.map((seg, idx) => {
              const val = Math.max(0, seg.value);
              if (val === 0) return null;
              const fraction = val / total;
              const dashLength = Math.max(2, fraction * circumference - (segments.filter((s) => s.value > 0).length > 1 ? 3 : 0));
              const rotation = cumulativeFraction * 360 - 90;
              cumulativeFraction += fraction;
              const isHovered = hoveredIdx === idx;
              return (
                <circle
                  key={seg.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={`${dashLength} ${circumference}`}
                  transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
                  style={{
                    transition: "stroke-width 180ms ease, opacity 180ms ease",
                    opacity: hoveredIdx !== null && !isHovered ? 0.45 : 1,
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
        </svg>
        <div
          className="position-absolute top-50 start-50 translate-middle text-center"
          style={{ pointerEvents: "none" }}
        >
          <div className="fw-bold font-monospace text-primary" style={{ fontSize: "1.35rem", lineHeight: 1.1 }}>
            {hoveredIdx !== null ? segments[hoveredIdx]?.value ?? centerValue : centerValue}
          </div>
          {(hoveredIdx !== null ? segments[hoveredIdx]?.label : centerLabel) && (
            <div className="text-secondary mt-1" style={{ fontSize: "0.68rem", maxWidth: 82 }}>
              {hoveredIdx !== null ? segments[hoveredIdx]?.label : centerLabel}
            </div>
          )}
        </div>
      </div>

      <div className="d-flex flex-column gap-2 w-100">
        {segments.map((seg, idx) => {
          const pct = total > 0 ? Math.round((Math.max(0, seg.value) / total) * 100) : 0;
          return (
            <div
              key={seg.label}
              className="d-flex align-items-center justify-content-between px-2.5 py-1.5 rounded-2 transition-all"
              style={{
                backgroundColor: hoveredIdx === idx ? "var(--bg-surface-hover)" : "transparent",
                cursor: "pointer",
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="d-flex align-items-center gap-2 text-truncate me-2">
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "9999px",
                    backgroundColor: seg.color,
                    flexShrink: 0,
                  }}
                />
                <span className="small text-secondary text-truncate">{seg.label}</span>
              </div>
              <span className="small fw-semibold font-monospace text-primary flex-shrink-0">
                {seg.value} <span className="text-secondary fw-normal">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface ActivityDayPoint {
  label: string;
  primary: number;
  secondary?: number;
}

export interface ActivityBarsChartProps {
  data: ActivityDayPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  height?: number;
}

/**
 * Pure SVG 7-day stacked/paired vertical bar chart with interactive day tooltips.
 */
export function ActivityBarsChart({
  data,
  primaryLabel,
  secondaryLabel,
  primaryColor = "var(--accent, #FF4C63)",
  secondaryColor = "var(--success, #A0CA92)",
  height = 170,
}: ActivityBarsChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxVal = Math.max(
    1,
    ...data.map((d) => Math.max(d.primary, d.secondary || 0))
  );

  const svgWidth = 520;
  const chartHeight = height - 28;
  const groupWidth = data.length > 0 ? svgWidth / data.length : svgWidth;

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div className="d-flex align-items-center gap-3 small">
          <span className="d-inline-flex align-items-center gap-1.5 text-secondary">
            <span style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: primaryColor, display: "inline-block" }} />
            {primaryLabel}
          </span>
          {secondaryLabel && (
            <span className="d-inline-flex align-items-center gap-1.5 text-secondary">
              <span style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: secondaryColor, display: "inline-block" }} />
              {secondaryLabel}
            </span>
          )}
        </div>
        {hoveredIdx !== null && data[hoveredIdx] && (
          <span className="badge font-monospace" style={{ backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}>
            {data[hoveredIdx].label}: {data[hoveredIdx].primary} {primaryLabel.toLowerCase()}
            {secondaryLabel ? ` / ${data[hoveredIdx].secondary || 0} ${secondaryLabel.toLowerCase()}` : ""}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        className="w-100"
        style={{ height, overflow: "visible" }}
        role="img"
        aria-label={primaryLabel}
      >
        {/* Horizontal dashed reference guides */}
        {[0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = chartHeight - ratio * (chartHeight - 10);
          return (
            <line
              key={ratio}
              x1={0}
              y1={y}
              x2={svgWidth}
              y2={y}
              stroke="var(--border-subtle)"
              strokeDasharray="3 4"
              strokeWidth={1}
            />
          );
        })}

        {data.map((point, idx) => {
          const xCenter = idx * groupWidth + groupWidth / 2;
          const barW = secondaryLabel ? 14 : 22;
          const h1 = point.primary > 0 ? Math.max(6, (point.primary / maxVal) * (chartHeight - 16)) : 3;
          const h2 = secondaryLabel && (point.secondary || 0) > 0
            ? Math.max(6, ((point.secondary || 0) / maxVal) * (chartHeight - 16))
            : 3;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={point.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: "pointer" }}
            >
              {isHovered && (
                <rect
                  x={idx * groupWidth + 4}
                  y={4}
                  width={groupWidth - 8}
                  height={chartHeight - 4}
                  rx={8}
                  fill="var(--bg-surface-hover)"
                  opacity={0.5}
                />
              )}
              <rect
                x={secondaryLabel ? xCenter - barW - 2 : xCenter - barW / 2}
                y={chartHeight - h1}
                width={barW}
                height={h1}
                rx={4}
                fill={primaryColor}
                opacity={point.primary === 0 ? 0.2 : isHovered ? 1 : 0.85}
                style={{ transition: "height 220ms ease, opacity 160ms ease" }}
              />
              {secondaryLabel && (
                <rect
                  x={xCenter + 2}
                  y={chartHeight - h2}
                  width={barW}
                  height={h2}
                  rx={4}
                  fill={secondaryColor}
                  opacity={(point.secondary || 0) === 0 ? 0.2 : isHovered ? 1 : 0.85}
                  style={{ transition: "height 220ms ease, opacity 160ms ease" }}
                />
              )}
              <text
                x={xCenter}
                y={height - 6}
                textAnchor="middle"
                fill={isHovered ? "var(--text-primary)" : "var(--text-tertiary)"}
                fontSize={11}
                fontFamily="var(--font-mono)"
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
