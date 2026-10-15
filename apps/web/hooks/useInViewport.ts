"use client";

/**
 * DD-118 Batch 5b — IntersectionObserver hook for viewport-gated WS subscriptions.
 *
 * Returns `[ref, isVisible]`. `isVisible` flips true when ref enters viewport
 * (with optional pre-warm `rootMargin`), false on exit. Pre-warm naturally
 * provides hysteresis against fast scrolling — caller doesn't need extra debounce.
 *
 * SSR-safe: `isVisible` defaults to false on server; client-side first effect
 * registers the observer.
 */

import { useEffect, useRef, useState } from "react";

export interface UseInViewportOpts {
  /** rootMargin (CSS shorthand) — pre-warm distance. Default '200px 0px'. */
  rootMargin?: string;
  /** Intersection threshold. Default 0 (any overlap). */
  threshold?: number | number[];
  /** Disable observer (no subscription). Default false. */
  disabled?: boolean;
}

export function useInViewport<T extends HTMLElement = HTMLElement>(
  opts: UseInViewportOpts = {}
): [React.RefObject<T | null>, boolean] {
  const { rootMargin = "200px 0px", threshold = 0, disabled = false } = opts;
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    if (disabled) {
      setIsVisible(false);
      return;
    }
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // SSR / very old browsers — fallback: assume visible so subscriptions still work
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === el) {
            setIsVisible(entry.isIntersecting);
          }
        }
      },
      { rootMargin, threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, disabled]);

  return [ref, isVisible];
}
