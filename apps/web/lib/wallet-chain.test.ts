import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Config } from "wagmi";
import { CORE_CHAIN } from "@/lib/chains";
import { ensureCoreChain } from "./wallet-chain";

// Fake Config — 直接构造而非 mock 模块，避免顶层 wagmi.config 触发 createConfig 副作用
//
// REV-fix-bug-008-v1 critic A2 修复：fake subscribe 必须真正 apply selector，
// 不能直接把原始值塞给 cb。否则 selector 改坏（如改成读错字段）测试不会失败，
// 给 selector 正确性提供假信号。
type Listener = { selector: (s: FakeState) => unknown; cb: (val: unknown) => void };
type Connection = { chainId: number };
type FakeState = { current: string | null; connections: Map<string, Connection> };

function createFakeConfig() {
  const listeners: Listener[] = [];
  const state: FakeState = {
    current: "mock-connection-id",
    connections: new Map([["mock-connection-id", { chainId: 1 }]]),
  };

  const config = {
    get state() {
      return state;
    },
    subscribe: (selector: (s: FakeState) => unknown, cb: (val: unknown) => void) => {
      listeners.push({ selector, cb });
      return () => {
        const i = listeners.findIndex((l) => l.cb === cb);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  };

  const triggerStoreChange = (newChainId: number) => {
    state.connections.set("mock-connection-id", { chainId: newChainId });
    // 按 zustand subscribeWithSelector 语义：将 selector(state) 的返回值喂给 cb
    for (const l of listeners) l.cb(l.selector(state));
  };

  const setStored = (chainId: number | undefined) => {
    if (chainId === undefined) {
      state.connections.delete("mock-connection-id");
    } else {
      state.connections.set("mock-connection-id", { chainId });
    }
  };

  return { config: config as unknown as Config, triggerStoreChange, setStored };
}

describe("ensureCoreChain", () => {
  const target = CORE_CHAIN.id;
  let switchChainAsync: ReturnType<typeof vi.fn>;
  let connector: { getChainId: ReturnType<typeof vi.fn> };
  let fake: ReturnType<typeof createFakeConfig>;

  beforeEach(() => {
    vi.useFakeTimers();
    switchChainAsync = vi.fn().mockResolvedValue(undefined);
    connector = { getChainId: vi.fn() };
    fake = createFakeConfig();
    fake.setStored(target);
    connector.getChainId.mockResolvedValue(target);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("已在目标链（no-op）：store + live 均为 target，不调用 switchChainAsync", async () => {
    fake.setStored(target);
    connector.getChainId.mockResolvedValue(target);

    await ensureCoreChain(connector as never, switchChainAsync as never, fake.config);

    expect(switchChainAsync).not.toHaveBeenCalled();
  });

  it("happy path：store=1, live=1 → switch 成功，store 同步，live polling 变 target", async () => {
    fake.setStored(1);
    connector.getChainId
      .mockResolvedValueOnce(1) // liveBefore 检查
      .mockResolvedValue(target); // live polling 返回 target

    switchChainAsync.mockImplementation(async () => {
      fake.triggerStoreChange(target);
    });

    const promise = ensureCoreChain(connector as never, switchChainAsync as never, fake.config);
    await vi.runAllTimersAsync();
    await promise;

    expect(switchChainAsync).toHaveBeenCalledWith({ chainId: target });
  });

  it("store 收敛 + live 超时：抛 'did not reflect' 错误", async () => {
    fake.setStored(1);
    connector.getChainId
      .mockResolvedValueOnce(1) // liveBefore
      .mockResolvedValue(1); // live polling 永远返回 1（超时）

    switchChainAsync.mockImplementation(async () => {
      fake.triggerStoreChange(target);
    });

    let caught: Error | undefined;
    const promise = ensureCoreChain(
      connector as never,
      switchChainAsync as never,
      fake.config
    ).catch((e: Error) => {
      caught = e;
    });
    await vi.runAllTimersAsync();
    await promise;

    expect(caught?.message).toMatch(/did not reflect/);
  });

  it("switchChainAsync 抛 user-rejected：抛 friendly 'Please switch your wallet' 错误", async () => {
    fake.setStored(1);
    connector.getChainId.mockResolvedValue(1);
    switchChainAsync.mockRejectedValue(new Error("User rejected the request"));

    let caught: Error | undefined;
    const promise = ensureCoreChain(
      connector as never,
      switchChainAsync as never,
      fake.config
    ).catch((e: Error) => {
      caught = e;
    });
    await vi.runAllTimersAsync();
    await promise;

    expect(caught?.message).toMatch(/Please switch your wallet/);
  });

  it("switchChainAsync 抛非 user-rejected 错误：抛 'Failed to switch' 错误", async () => {
    fake.setStored(1);
    connector.getChainId.mockResolvedValue(1);
    switchChainAsync.mockRejectedValue(new Error("RPC error"));

    let caught: Error | undefined;
    const promise = ensureCoreChain(
      connector as never,
      switchChainAsync as never,
      fake.config
    ).catch((e: Error) => {
      caught = e;
    });
    await vi.runAllTimersAsync();
    await promise;

    expect(caught?.message).toMatch(/Failed to switch/);
  });
});
