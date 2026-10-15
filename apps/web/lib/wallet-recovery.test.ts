import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { waitForConnectorRecovery } from "./wallet-recovery";
import type { Config } from "wagmi";

/**
 * Fake wagmi `Config` 仅暴露本函数依赖的 `state.current` + `subscribe` 形态。
 * `subscribe(selector, listener)` 在每次 mutate 时挑出 selector 结果并触发 listener。
 */
function makeFakeConfig(initialCurrent: string | undefined): {
  config: Config;
  setCurrent: (next: string | undefined) => void;
  subscriberCount: () => number;
} {
  let current = initialCurrent;
  type Listener = {
    selector: (s: { current: string | undefined }) => unknown;
    cb: (v: unknown) => void;
  };
  const listeners = new Set<Listener>();

  const state = {
    get current() {
      return current;
    },
  };
  const subscribe = (
    selector: (s: { current: string | undefined }) => unknown,
    cb: (v: unknown) => void
  ) => {
    const listener: Listener = { selector, cb };
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const config = { state, subscribe } as unknown as Config;

  return {
    config,
    setCurrent: (next) => {
      current = next;
      for (const l of listeners) l.cb(l.selector({ current }));
    },
    subscriberCount: () => listeners.size,
  };
}

describe("waitForConnectorRecovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true immediately when state.current already non-empty", async () => {
    const { config } = makeFakeConfig("connector-uid-1");
    await expect(waitForConnectorRecovery(config, 1500)).resolves.toBe(true);
  });

  it("returns true when state.current becomes non-empty within timeout", async () => {
    const { config, setCurrent } = makeFakeConfig(undefined);
    const promise = waitForConnectorRecovery(config, 1500);

    // 1s 后钱包重新 emit connect，wagmi 写回 state.current
    setTimeout(() => setCurrent("connector-uid-2"), 1000);
    await vi.advanceTimersByTimeAsync(1200);

    await expect(promise).resolves.toBe(true);
  });

  it("returns false when state.current stays empty past timeout", async () => {
    const { config } = makeFakeConfig(undefined);
    const promise = waitForConnectorRecovery(config, 1500);
    await vi.advanceTimersByTimeAsync(1500);
    await expect(promise).resolves.toBe(false);
  });

  it("unsubscribes on resolve (no listener leak after success)", async () => {
    const { config, setCurrent, subscriberCount } = makeFakeConfig(undefined);
    const promise = waitForConnectorRecovery(config, 1500);
    expect(subscriberCount()).toBe(1);

    setTimeout(() => setCurrent("connector-uid-3"), 500);
    await vi.advanceTimersByTimeAsync(800);
    await promise;

    expect(subscriberCount()).toBe(0);
  });

  it("unsubscribes on timeout (no listener leak after failure)", async () => {
    const { config, subscriberCount } = makeFakeConfig(undefined);
    const promise = waitForConnectorRecovery(config, 1500);
    expect(subscriberCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(1500);
    await promise;

    expect(subscriberCount()).toBe(0);
  });
});
