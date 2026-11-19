"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface ThreeAICoreProps {
  className?: string;
  intensity?: number;
}

export default function ThreeAICore({ className = "", intensity = 1 }: ThreeAICoreProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check for reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const width = container.clientWidth || 500;
    const height = container.clientHeight || 500;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 8.5);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setHasWebGL(false);
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Group for all core elements
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // 1. Central Core Sphere (Nested layers for volumetric glowing depth)
    // Inner vibrant core
    const innerGeo = new THREE.SphereGeometry(1.2, 32, 32);
    const innerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#B44AFF"),
      transparent: true,
      opacity: 0.85,
    });
    const innerSphere = new THREE.Mesh(innerGeo, innerMat);
    coreGroup.add(innerSphere);

    // Core Wireframe shell
    const wireGeo = new THREE.IcosahedronGeometry(1.65, 2);
    const wireMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#9303C5"),
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const wireSphere = new THREE.Mesh(wireGeo, wireMat);
    coreGroup.add(wireSphere);

    // Glowing outer aura shell (Additive blending)
    const auraGeo = new THREE.SphereGeometry(2.0, 32, 32);
    const auraMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#4169FF"),
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const auraSphere = new THREE.Mesh(auraGeo, auraMat);
    coreGroup.add(auraSphere);

    // 2. Holographic Orbital Rings
    const createRing = (radius: number, tube: number, colorHex: string, rotX: number, rotY: number) => {
      const ringGeo = new THREE.TorusGeometry(radius, tube, 16, 100);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex),
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = rotX;
      ringMesh.rotation.y = rotY;
      return ringMesh;
    };

    const ring1 = createRing(2.6, 0.025, "#B44AFF", Math.PI / 3, 0.2);
    const ring2 = createRing(3.1, 0.02, "#4169FF", -Math.PI / 4, 0.4);
    const ring3 = createRing(3.6, 0.018, "#C084FC", Math.PI / 6, -0.3);
    coreGroup.add(ring1);
    coreGroup.add(ring2);
    coreGroup.add(ring3);

    // 3. Orbiting Data Photons / Nodes
    const createPhoton = (colorHex: string, size = 0.08) => {
      const geo = new THREE.SphereGeometry(size, 16, 16);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex),
        blending: THREE.AdditiveBlending,
      });
      return new THREE.Mesh(geo, mat);
    };

    const photon1 = createPhoton("#FFFFFF", 0.09);
    const photon2 = createPhoton("#38BDF8", 0.07);
    const photon3 = createPhoton("#F472B6", 0.08);
    coreGroup.add(photon1);
    coreGroup.add(photon2);
    coreGroup.add(photon3);

    // 4. Data Particle Cloud
    const particleCount = 280;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const purpleColor = new THREE.Color("#B44AFF");
    const blueColor = new THREE.Color("#4169FF");
    const cyanColor = new THREE.Color("#38BDF8");

    for (let i = 0; i < particleCount; i++) {
      const r = 2.4 + Math.random() * 3.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const mixed = Math.random() > 0.5 ? purpleColor : (Math.random() > 0.5 ? blueColor : cyanColor);
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    coreGroup.add(particles);

    // 5. Ambient & Point Lighting
    const ambientLight = new THREE.AmbientLight(0x110f1d, 2);
    scene.add(ambientLight);

    const pointLightPurple = new THREE.PointLight(0x9303c5, 5 * intensity, 15);
    pointLightPurple.position.set(2, 2, 3);
    scene.add(pointLightPurple);

    const pointLightBlue = new THREE.PointLight(0x4169ff, 4 * intensity, 15);
    pointLightBlue.position.set(-2, -2, 2);
    scene.add(pointLightBlue);

    // Mouse Tracking for Smooth Parallax
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouse.targetX = Math.max(-1, Math.min(1, x));
      mouse.targetY = Math.max(-1, Math.min(1, y));
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Resize Observer
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      if (!prefersReducedMotion) {
        // Camera tilt based on mouse
        camera.position.x = mouse.x * 0.9;
        camera.position.y = mouse.y * 0.7;
        camera.lookAt(0, 0, 0);

        // Core pulsating
        const pulse = Math.sin(elapsedTime * 2) * 0.08 + 1;
        innerSphere.scale.set(pulse, pulse, pulse);
        wireSphere.rotation.y = elapsedTime * 0.15;
        wireSphere.rotation.x = elapsedTime * 0.1;

        // Rings rotation
        ring1.rotation.z = elapsedTime * 0.25;
        ring2.rotation.z = -elapsedTime * 0.2;
        ring3.rotation.z = elapsedTime * 0.15;

        // Photons orbiting
        const p1Angle = elapsedTime * 0.8;
        photon1.position.set(Math.cos(p1Angle) * 2.6, Math.sin(p1Angle) * 0.6, Math.sin(p1Angle) * 1.5);

        const p2Angle = -elapsedTime * 0.6 + 2;
        photon2.position.set(Math.cos(p2Angle) * 3.1, Math.sin(p2Angle) * 1.8, Math.sin(p2Angle) * 0.8);

        const p3Angle = elapsedTime * 0.5 + 4;
        photon3.position.set(Math.cos(p3Angle) * 2.2, Math.sin(p3Angle) * 2.2, Math.cos(p3Angle) * 1.2);

        // Particles rotation
        particles.rotation.y = elapsedTime * 0.04;
        particles.rotation.x = Math.sin(elapsedTime * 0.02) * 0.1;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);

      // Clean up Three.js resources
      innerGeo.dispose();
      innerMat.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      auraGeo.dispose();
      auraMat.dispose();
      ring1.geometry.dispose();
      (ring1.material as THREE.Material).dispose();
      ring2.geometry.dispose();
      (ring2.material as THREE.Material).dispose();
      ring3.geometry.dispose();
      (ring3.material as THREE.Material).dispose();
      particleGeo.dispose();
      particleMat.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [intensity]);

  if (!hasWebGL) {
    return (
      <div className={`d-flex align-items-center justify-content-center ${className}`}>
        <div
          style={{
            width: "280px",
            height: "280px",
            borderRadius: "50%",
            background: "radial-gradient(circle, #B44AFF 0%, #9303C5 50%, transparent 70%)",
            filter: "blur(20px)",
            opacity: 0.6,
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className={`position-relative ${className}`}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "440px",
        overflow: "visible",
      }}
    />
  );
}
