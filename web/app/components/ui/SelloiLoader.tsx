"use client";

import React from "react";
import styles from "./SelloiLoader.module.css";

interface SelloiLoaderProps {
  text?: string;
  className?: string;
  scale?: number;
}

export function SelloiLoader({
  text = "Yuklanmoqda…",
  className = "",
  scale = 1,
}: SelloiLoaderProps) {
  return (
    <div
      className={`${styles.pl} ${className}`}
      style={scale !== 1 ? { fontSize: `${scale}rem` } : undefined}
      role="status"
      aria-label={text}
    >
      <div className={styles.plDot} />
      <div className={styles.plDot} />
      <div className={styles.plDot} />
      <div className={styles.plDot} />
      <div className={styles.plDot} />
      <div className={styles.plDot} />
      <div className={styles.plDot} />
      <div className={styles.plDot} />
      <div className={styles.plDot} />
      <div className={styles.plDot} />
      <div className={styles.plDot} />
      <div className={styles.plDot} />
      <div className={styles.plText}>{text}</div>
    </div>
  );
}

export default SelloiLoader;
