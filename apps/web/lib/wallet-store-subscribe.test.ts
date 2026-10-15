import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { subscribeUntil } from "./wallet-store-subscribe";
import type { Config } from "wagmi";

/** 通用 fake wagmi config（selector 任意 T，可触发 mutate 通知）。 */
function makeFakeConfig<T>(initial: T): {
  config: Config;
  set: (next: T) => void;
  subscriberCount: () => number;
} {
  let value = initial;
  type Listener = { selector: (s: { value: T }) => unknown; cb: (v: unknown) => void };
  const listeners = new Set<Listener>();

  const state = {
    get value() {
      return value;
    },
  };
  const subscribe = (selector: (s: { value: T }) => unknown, cb: (v: unknown) => void) => {
    const listener: Listener = { selector, cb };
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const config = { state, subscribe } as unknown as Config;

  return {
    config,
    set: (next) => {
      value = next;
      for (const l of listeners) l.cb(l.selector({ value }));
    },
    subscriberCount: () => listeners.size,
  };
}

describe("subscribeUntil", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true immediately when predicate already satisfied", async () => {
    const { config, subscriberCount } = makeFakeConfig(42);
    await expect(
      subscribeUntil(
        config,
        (s: unknown) => (s as { value: number }).value,
        (v) => v === 42,
        1000
      )
    ).resolves.toBe(true);
    // 立即满足时不应建立订阅
    expect(subscriberCount()).toBe(0);
  });

  it("returns true when value transitions to satisfy predicate within timeout", async () => {
    const { config, set } = makeFakeConfig<number>(0);
    const promise = subscribeUntil(
      config,
      (s: unknown) => (s as { value: number }).value,
      (v) => v >= 10,
      1000
    );
    setTimeout(() => set(15), 300);
    await vi.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toBe(true);
  });

  it("returns false when predicate never satisfied within timeout", async () => {
    const { config } = makeFakeConfig<number>(0);
    const promise = subscribeUntil(
      config,
      (s: unknown) => (s as { value: number }).value,
      (v) => v >= 10,
      500
    );
    await vi.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toBe(false);
  });

  it("unsubscribes on success (no listener leak)", async () => {
    const { config, set, subscriberCount } = makeFakeConfig<number>(0);
    const promise = subscribeUntil(
      config,
      (s: unknown) => (s as { value: number }).value,
      (v) => v === 1,
      1000
    );
    expect(subscriberCount()).toBe(1);
    set(1);
    await promise;
    expect(subscriberCount()).toBe(0);
  });

  it("unsubscribes on timeout (no listener leak)", async () => {
    const { config, subscriberCount } = makeFakeConfig<number>(0);
    const promise = subscribeUntil(
      config,
      (s: unknown) => (s as { value: number }).value,
      (v) => v === 1,
      500
    );
    expect(subscriberCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(500);
    await promise;
    expect(subscriberCount()).toBe(0);
  });

  it("ignores intermediate non-matching values and resolves only on first match", async () => {
    const { config, set } = makeFakeConfig<number>(0);
    const promise = subscribeUntil(
      config,
      (s: unknown) => (s as { value: number }).value,
      (v) => v === 99,
      1000
    );
    set(1);
    set(50);
    set(98);
    await vi.advanceTimersByTimeAsync(0);
    set(99);
    await expect(promise).resolves.toBe(true);
  });
});
