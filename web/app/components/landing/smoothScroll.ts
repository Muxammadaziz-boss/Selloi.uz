"use client";

let activeRafId: number | null = null;
let cleanupInterruptListeners: (() => void) | null = null;
let restoreScrollBehavior: (() => void) | null = null;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function revealSectionsUpTo(targetEl: HTMLElement | null) {
  const revealItems = Array.from(document.querySelectorAll<HTMLElement>(".selloi-reveal-item"));
  if (!targetEl) return;
  const targetTopApprox = targetEl.getBoundingClientRect().top + window.scrollY;
  for (const item of revealItems) {
    const itemTop = item.getBoundingClientRect().top + window.scrollY;
    if (item === targetEl || itemTop <= targetTopApprox + 50) {
      item.classList.add("selloi-in-view");
    }
  }
}

function triggerArrivalAnimation(el: HTMLElement) {
  el.classList.add("selloi-in-view");
  el.classList.remove("selloi-nav-arriving");
  void el.offsetWidth;
  el.classList.add("selloi-nav-arriving");
  window.setTimeout(() => {
    el.classList.remove("selloi-nav-arriving");
  }, 680);
}

/**
 * Smoothly scrolls to a landing section by ID with eased cubic animation,
 * bypassing Tabler/Bootstrap CSS scroll-behavior conflicts via behavior:'instant'
 * per frame, compensating for fixed navbar height, and eliminating reveal-shift jumps.
 */
export function smoothScrollToSection(
  targetId: string,
  options?: {
    onStart?: () => void;
    onComplete?: () => void;
  }
): void {
  if (typeof window === "undefined") return;

  if (activeRafId !== null) {
    window.cancelAnimationFrame(activeRafId);
    activeRafId = null;
  }
  if (cleanupInterruptListeners) {
    cleanupInterruptListeners();
    cleanupInterruptListeners = null;
  }
  if (restoreScrollBehavior) {
    restoreScrollBehavior();
    restoreScrollBehavior = null;
  }

  const targetEl = targetId === "top" ? document.getElementById("top") : document.getElementById(targetId);
  if (targetId !== "top" && !targetEl) {
    options?.onComplete?.();
    return;
  }

  // Reveal all sections up to the target before measuring coordinates so translateY(28px) doesn't offset targetY
  if (targetEl) {
    revealSectionsUpTo(targetEl);
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
    window.scrollTo({ top: targetY, behavior: "instant" as ScrollBehavior });
    if (targetEl) triggerArrivalAnimation(targetEl);
    options?.onComplete?.();
    return;
  }

  // Override Tabler's `:root { scroll-behavior: smooth }` so every RAF frame renders cleanly without CSS interpolation fighting
  const htmlEl = document.documentElement;
  const prevBehavior = htmlEl.style.scrollBehavior;
  htmlEl.style.scrollBehavior = "auto";
  restoreScrollBehavior = () => {
    htmlEl.style.scrollBehavior = prevBehavior;
    restoreScrollBehavior = null;
  };

  options?.onStart?.();

  let arrivalTriggered = false;
  const distance = Math.abs(targetY - startY);
  const duration = Math.min(950, Math.max(580, 500 + distance * 0.14));
  const startTime = performance.now();

  const finish = (completed: boolean) => {
    if (activeRafId !== null) {
      window.cancelAnimationFrame(activeRafId);
      activeRafId = null;
    }
    if (cleanupInterruptListeners) {
      cleanupInterruptListeners();
      cleanupInterruptListeners = null;
    }
    if (restoreScrollBehavior) {
      restoreScrollBehavior();
    }
    if (completed && !arrivalTriggered && targetEl) {
      triggerArrivalAnimation(targetEl);
    }
    options?.onComplete?.();
  };

  const onManualInput = () => finish(false);
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

    window.scrollTo({ top: currentY, behavior: "instant" as ScrollBehavior });

    if (!arrivalTriggered && progress >= 0.78 && targetEl) {
      arrivalTriggered = true;
      triggerArrivalAnimation(targetEl);
    }

    if (progress < 1) {
      activeRafId = window.requestAnimationFrame(step);
    } else {
      window.scrollTo({ top: targetY, behavior: "instant" as ScrollBehavior });
      finish(true);
    }
  };

  activeRafId = window.requestAnimationFrame(step);
}
