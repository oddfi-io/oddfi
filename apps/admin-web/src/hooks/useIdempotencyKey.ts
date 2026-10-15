/**
 * useIdempotencyKey — manages a per-form-session idempotency key.
 *
 * `key` is a UUID v4 string that uniquely identifies the current form submission attempt.
 * It is generated **once** on the first render via a lazy useState initializer and remains
 * stable across re-renders until `rotate()` is called.
 *
 * `rotate()` replaces `key` with a freshly generated UUID and returns the new value.
 * It is a side-effectful setState call — the new key becomes available on the next render.
 *
 * The hook does **not** decide when to rotate. That decision belongs to the consumer.
 *
 * @see ConfirmMutationModal for the canonical idempotency lifecycle (when to rotate vs. keep).
 */
import { useState, useCallback } from "react";
import { generateUuidV4 } from "@/lib/api";

export interface IdempotencyKeyController {
  /** Current idempotency key for this form session. */
  key: string;
  /**
   * Generate and set a new key, returning the new value.
   * Call after a 4xx failure when the user will modify the request body before retrying.
   */
  rotate: () => string;
}

/**
 * @param initial - Optional fixed key (useful for tests to pin a known value).
 *                  When omitted, a UUID v4 is generated once via lazy initializer.
 */
export function useIdempotencyKey(initial?: string): IdempotencyKeyController {
  // Lazy initializer: the function is called only on the first render.
  // This avoids generating a new UUID on every re-render.
  const [key, setKey] = useState<string>(() => initial ?? generateUuidV4());

  const rotate = useCallback((): string => {
    const next = generateUuidV4();
    setKey(next);
    return next;
  }, []);

  return { key, rotate };
}
