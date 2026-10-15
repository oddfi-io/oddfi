"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseCopyToClipboardOptions {
  /** Reset duration in ms; defaults to 2000 */
  resetMs?: number;
}

interface UseCopyToClipboardResult {
  copied: boolean;
  copy: (value: string) => Promise<boolean>;
}

export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {}
): UseCopyToClipboardResult {
  const { resetMs = 2000 } = options;
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback(
    async (value: string): Promise<boolean> => {
      if (!value) return false;
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), resetMs);
        return true;
      } catch {
        return false;
      }
    },
    [resetMs]
  );

  return { copied, copy };
}
