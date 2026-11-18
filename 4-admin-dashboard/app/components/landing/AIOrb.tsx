"use client";

import React, { useEffect, useRef } from "react";

export default function AIOrb() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mousePos = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let angle1 = 0;
    let angle2 = Math.PI / 3;
    let angle3 = -Math.PI / 4;
    let pulse = 0;

    // Handle high DPI displays
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    // Particle stars
    interface Particle {
      x: number;
      y: number;
      size: number;
      speed: number;
      opacity: number;
      pulseSpeed: number;
    }

    const particles: Particle[] = Array.from({ length: 38 }, () => ({
      x: (Math.random() - 0.5) * 440,
      y: (Math.random() - 0.5) * 440,
      size: Math.random() * 2 + 0.6,
      speed: Math.random() * 0.005 + 0.002,
      opacity: Math.random() * 0.7 + 0.2,
      pulseSpeed: Math.random() * 0.02 + 0.01,
    }));

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
      mousePos.current.targetX = Math.max(-1, Math.min(1, x));
      mousePos.current.targetY = Math.max(-1, Math.min(1, y));
    };

    window.addEventListener("mousemove", handleMouseMove);

    const render = () => {
      // Smooth lerp mouse parallax
      mousePos.current.x += (mousePos.current.targetX - mousePos.current.x) * 0.05;
      mousePos.current.y += (mousePos.current.targetY - mousePos.current.y) * 0.05;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2 + mousePos.current.x * 16;
      const centerY = height / 2 + mousePos.current.y * 16;
      const radius = Math.min(width, height) * 0.32;

      ctx.clearRect(0, 0, width, height);

      pulse += 0.03;
      angle1 += 0.012;
      angle2 += 0.009;
      angle3 += 0.015;

      // 1. Draw background ambient particles
      particles.forEach((p, idx) => {
        p.opacity += Math.sin(pulse * p.pulseSpeed * 20 + idx) * 0.01;
        const currentOpacity = Math.max(0.1, Math.min(0.9, p.opacity));
        const px = centerX + p.x + Math.sin(pulse * 0.5 + idx) * 8;
        const py = centerY + p.y + Math.cos(pulse * 0.5 + idx) * 8;

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(192, 132, 252, ${currentOpacity * 0.6})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#A855F7";
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // 2. Draw Outermost Volumetric Core Glow
      const glowGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.2,
        centerX,
        centerY,
        radius * 1.8
      );
      glowGrad.addColorStop(0, "rgba(168, 85, 247, 0.45)");
      glowGrad.addColorStop(0.4, "rgba(147, 51, 234, 0.22)");
      glowGrad.addColorStop(0.7, "rgba(79, 70, 229, 0.08)");
      glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      // 3. Helper to draw elliptical orbital rings
      const drawOrbitalRing = (
        tiltAngle: number,
        currentRotation: number,
        rx: number,
        ry: number,
        color: string,
        blur: number
      ) => {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(tiltAngle);

        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, currentRotation, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = "#C084FC";
        ctx.shadowBlur = blur;
        ctx.stroke();

        // Draw a tiny traveling photon on the ring
        const photonAngle = currentRotation * 2;
        const px = rx * Math.cos(photonAngle);
        const py = ry * Math.sin(photonAngle);
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowColor = "#FFFFFF";
        ctx.shadowBlur = 12;
        ctx.fill();

        ctx.restore();
      };

      // Back half of orbital rings (behind the central sphere)
      drawOrbitalRing(-0.45, angle1, radius * 1.45, radius * 0.45, "rgba(192, 132, 252, 0.55)", 18);
      drawOrbitalRing(0.55, -angle2, radius * 1.6, radius * 0.5, "rgba(147, 51, 234, 0.4)", 14);

      // 4. Central Spherical Glass Body (Dark Transparent Sphere)
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.clip();

      // Sphere base gradient
      const sphereGrad = ctx.createRadialGradient(
        centerX - radius * 0.35,
        centerY - radius * 0.35,
        radius * 0.1,
        centerX,
        centerY,
        radius
      );
      sphereGrad.addColorStop(0, "rgba(230, 200, 255, 0.25)");
      sphereGrad.addColorStop(0.25, "rgba(147, 51, 234, 0.45)");
      sphereGrad.addColorStop(0.65, "rgba(20, 10, 45, 0.85)");
      sphereGrad.addColorStop(1, "rgba(6, 4, 18, 0.98)");

      ctx.fillStyle = sphereGrad;
      ctx.fill();

      // Inner pulsating energy core
      const corePulse = Math.sin(pulse) * 0.15 + 0.85;
      const coreGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius * 0.55 * corePulse
      );
      coreGrad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
      coreGrad.addColorStop(0.2, "rgba(216, 180, 254, 0.7)");
      coreGrad.addColorStop(0.6, "rgba(147, 51, 234, 0.4)");
      coreGrad.addColorStop(1, "rgba(147, 51, 234, 0)");

      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Glass specular reflection highlight (curved top rim)
      ctx.beginPath();
      ctx.ellipse(
        centerX - radius * 0.25,
        centerY - radius * 0.45,
        radius * 0.45,
        radius * 0.2,
        -Math.PI / 5,
        0,
        Math.PI * 2
      );
      const specGrad = ctx.createLinearGradient(
        centerX - radius * 0.5,
        centerY - radius * 0.6,
        centerX,
        centerY - radius * 0.2
      );
      specGrad.addColorStop(0, "rgba(255, 255, 255, 0.65)");
      specGrad.addColorStop(0.5, "rgba(216, 180, 254, 0.15)");
      specGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = specGrad;
      ctx.fill();

      ctx.restore();

      // Sphere border glass rim
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(192, 132, 252, 0.45)";
      ctx.lineWidth = 1.8;
      ctx.shadowColor = "#A855F7";
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Front half orbital rings (crossing in front of the sphere)
      drawOrbitalRing(-0.15, angle3, radius * 1.35, radius * 0.38, "rgba(216, 180, 254, 0.75)", 22);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="position-relative d-flex align-items-center justify-content-center"
      style={{
        width: "100%",
        maxWidth: "520px",
        aspectRatio: "1 / 1",
        margin: "0 auto",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          position: "relative",
          zIndex: 2,
        }}
      />

      {/* Floating Center Badge at the base of the Orb (As in visual reference: Selloi 'S' badge) */}
      <div
        className="position-absolute"
        style={{
          bottom: "16%",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 4,
          pointerEvents: "none",
        }}
      >
        <div
          className="d-flex align-items-center justify-content-center"
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, #A855F7 0%, #6B21A8 100%)",
            boxShadow: "0 0 30px rgba(168, 85, 247, 0.7), inset 0 0 12px rgba(255, 255, 255, 0.4)",
            border: "1.5px solid rgba(255, 255, 255, 0.35)",
          }}
        >
          <span
            style={{
              fontSize: "26px",
              fontWeight: 800,
              color: "#FFFFFF",
              letterSpacing: "-0.5px",
              textShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            S
          </span>
        </div>
      </div>
    </div>
  );
}
