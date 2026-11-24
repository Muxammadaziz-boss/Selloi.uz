"use client";

import React, { useState, useEffect, useRef } from "react";

interface CountUpNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export default function CountUpNumber({
  value,
  duration = 1200,
  prefix = "",
  suffix = "",
  className = "",
}: CountUpNumberProps) {
  const [currentValue, setCurrentValue] = useState<number>(0);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const elementRef = useRef<HTMLSpanElement>(null);
  const prevValueRef = useRef<number>(0);

  // Trigger animation once element enters viewport
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0] && entries[0].isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Animate number when visible or when target value changes
  useEffect(() => {
    if (!isVisible) return;

    const startValue = prevValueRef.current;
    const endValue = value;
    if (startValue === endValue && currentValue === endValue) return;

    let startTimestamp: number | null = null;
    let animFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);

      // easeOutExpo for smooth deceleration
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const nextVal = Math.round(startValue + (endValue - startValue) * easeProgress);

      setCurrentValue(nextVal);

      if (progress < 1) {
        animFrameId = window.requestAnimationFrame(step);
      } else {
        setCurrentValue(endValue);
        prevValueRef.current = endValue;
      }
    };

    animFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animFrameId);
  }, [isVisible, value, duration]);

  // Format with space for thousand separators (e.g. 244 000)
  const formatted = currentValue.toLocaleString("ru-RU").replace(/,/g, " ");

  return (
    <span ref={elementRef} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
