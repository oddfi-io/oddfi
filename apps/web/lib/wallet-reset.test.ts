import { describe, it, expect, vi } from "vitest";
import type { Config } from "wagmi";
import { forceWagmiReset } from "./wallet-reset";

function createFakeConfig() {
  const state = {
    current: "stale-uid",
    connections: new Map([["stale-uid", { chainId: 137 }]]),
    status: "connected",
  };
  const setState = vi.fn((fn: (s: unknown) => unknown) => {
    const next = fn(state) as typeof state;
    state.current = next.current;
    state.connections = next.connections;
    state.status = next.status;
  });
  return { config: { setState } as unknown as Config, state, setState };
}

describe("forceWagmiReset", () => {
  it("calls config.setState clearing current/connections/status", () => {
    const fake = createFakeConfig();
    forceWagmiReset(fake.config);

    expect(fake.setState).toHaveBeenCalledTimes(1);
    expect(fake.state.current).toBeNull();
    expect(fake.state.connections.size).toBe(0);
    expect(fake.state.status).toBe("disconnected");
  });

  it("warns and returns silently when config.setState missing (wagmi API drift)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const brokenConfig = {} as unknown as Config;

    forceWagmiReset(brokenConfig);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("config.setState unavailable"));
    warnSpy.mockRestore();
  });

  it("warns and returns silently when setState throws", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorConfig = {
      setState: () => {
        throw new Error("zustand internal error");
      },
    } as unknown as Config;

    forceWagmiReset(errorConfig);

    expect(warnSpy).toHaveBeenCalledWith(
      "[wallet-reset] forceWagmiReset failed",
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });
});
