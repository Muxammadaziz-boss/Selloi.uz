"use client";

let activeRafId: number | null = null;
let cleanupInterruptListeners: (() => void) | null = null;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function triggerArrivalAnimation(el: HTMLElement) {
  if (el.classList.contains("selloi-reveal-item") && !el.classList.contains("selloi-in-view")) {
    el.classList.add("selloi-in-view");
  }
  el.classList.remove("selloi-nav-arriving");
  // Force reflow so rapid consecutive clicks replay cleanly
  void el.offsetWidth;
  el.classList.add("selloi-nav-arriving");
  window.setTimeout(() => {
    el.classList.remove("selloi-nav-arriving");
  }, 850);
}

/**
 * Smoothly scrolls to a landing section by ID with eased cubic animation,
 * navbar height compensation, manual-scroll interruption support, and
 * a gentle arrival animation on the target section.
 */
export function smoothScrollToSection(
  targetId: string,
  options?: {
    onStart?: () => void;
    onComplete?: () => void;
  }
): void {
  if (typeof window === "undefined") return;

  // Cancel any existing programmatic scroll
  if (activeRafId !== null) {
    window.cancelAnimationFrame(activeRafId);
    activeRafId = null;
  }
  if (cleanupInterruptListeners) {
    cleanupInterruptListeners();
    cleanupInterruptListeners = null;
  }

  const targetEl = targetId === "top" ? document.getElementById("top") : document.getElementById(targetId);
  if (targetId !== "top" && !targetEl) {
    options?.onComplete?.();
    return;
  }

  const navOffset = targetId === "top" ? 0 : window.innerWidth <= 768 ? 72 : 84;
  const startY = window.scrollY;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const rawTargetY =
    targetId === "top"
      ? 0
      : Math.max(0, (targetEl?.getBoundingClientRect().top ?? 0) + startY - navOffset);
  const targetY = Math.min(rawTargetY, maxScroll);

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReducedMotion || Math.abs(targetY - startY) < 4) {
    window.scrollTo({ top: targetY, behavior: "auto" });
    if (targetEl) triggerArrivalAnimation(targetEl);
    options?.onComplete?.();
    return;
  }

  options?.onStart?.();

  // Trigger subtle arrival visual just before/as scrolling lands
  let arrivalTriggered = false;
  const distance = Math.abs(targetY - startY);
  const duration = Math.min(920, Math.max(540, 480 + distance * 0.14));
  const startTime = performance.now();

  const cancel = () => {
    if (activeRafId !== null) {
      window.cancelAnimationFrame(activeRafId);
      activeRafId = null;
    }
    if (cleanupInterruptListeners) {
      cleanupInterruptListeners();
      cleanupInterruptListeners = null;
    }
    options?.onComplete?.();
  };

  const onManualInput = () => cancel();
  window.addEventListener("wheel", onManualInput, { passive: true, once: true });
  window.addEventListener("touchstart", onManualInput, { passive: true, once: true });
  cleanupInterruptListeners = () => {
    window.removeEventListener("wheel", onManualInput);
    window.removeEventListener("touchstart", onManualInput);
  };

  const step = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = easeInOutCubic(progress);
    const currentY = startY + (targetY - startY) * eased;

    window.scrollTo({ top: currentY, behavior: "auto" });

    if (!arrivalTriggered && progress >= 0.72 && targetEl) {
      arrivalTriggered = true;
      triggerArrivalAnimation(targetEl);
    }

    if (progress < 1) {
      activeRafId = window.requestAnimationFrame(step);
    } else {
      activeRafId = null;
      if (cleanupInterruptListeners) {
        cleanupInterruptListeners();
        cleanupInterruptListeners = null;
      }
      if (!arrivalTriggered && targetEl) {
        triggerArrivalAnimation(targetEl);
      }
      options?.onComplete?.();
    }
  };

  activeRafId = window.requestAnimationFrame(step);
}
