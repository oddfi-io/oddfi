// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useRequireWallet,
  WalletConnectCancelError,
  WalletRequiredError,
} from "./useRequireWallet";

// ─── Mock wagmi ───────────────────────────────────────────────────────────────

let mockAccountState: {
  address: string | undefined;
  status: string;
} = {
  address: undefined,
  status: "disconnected",
};

vi.mock("wagmi", () => ({
  useAccount: () => mockAccountState,
}));

// ─── Mock RainbowKit ──────────────────────────────────────────────────────────

let mockOpenConnectModal: (() => void) | undefined = vi.fn();
let mockConnectModalOpen = false;

vi.mock("@rainbow-me/rainbowkit", () => ({
  useConnectModal: () => ({
    openConnectModal: mockOpenConnectModal,
    connectModalOpen: mockConnectModalOpen,
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setConnected(address: string) {
  mockAccountState = { address, status: "connected" };
}

function setDisconnected() {
  mockAccountState = { address: undefined, status: "disconnected" };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useRequireWallet", () => {
  beforeEach(() => {
    setDisconnected();
    mockOpenConnectModal = vi.fn();
    mockConnectModalOpen = false;
    vi.useFakeTimers();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("already connected: resolves immediately with current address", async () => {
    setConnected("0xAbCd1234AbCd1234AbCd1234AbCd1234AbCd1234");

    const { result } = renderHook(() => useRequireWallet());

    let resolved: string | undefined;
    await act(async () => {
      resolved = await result.current.requireWallet();
    });

    expect(resolved).toBe("0xAbCd1234AbCd1234AbCd1234AbCd1234AbCd1234");
    expect(mockOpenConnectModal).not.toHaveBeenCalled();
  });

  it("not connected: calls openConnectModal", async () => {
    setDisconnected();
    // modal starts open so the "closed" effect branch is not triggered immediately
    mockConnectModalOpen = true;

    const { result, rerender } = renderHook(() => useRequireWallet());

    let rejectedError: Error | undefined;
    act(() => {
      result.current.requireWallet().catch((e: Error) => {
        rejectedError = e;
      });
    });

    // openConnectModal must have been called
    expect(mockOpenConnectModal).toHaveBeenCalledTimes(1);

    // Now simulate modal close → reject
    act(() => {
      mockConnectModalOpen = false;
    });
    rerender();

    await act(async () => {
      await Promise.resolve();
    });

    expect(rejectedError).toBeInstanceOf(WalletConnectCancelError);
  });

  it("modal closes without connecting: rejects with WalletConnectCancelError", async () => {
    setDisconnected();
    mockConnectModalOpen = true;

    const { result, rerender } = renderHook(() => useRequireWallet());

    let rejectedError: Error | undefined;
    act(() => {
      result.current.requireWallet().catch((e: Error) => {
        rejectedError = e;
      });
    });

    // Simulate modal closing without connecting
    act(() => {
      mockConnectModalOpen = false;
      mockAccountState = { address: undefined, status: "disconnected" };
    });
    rerender();

    // Allow microtasks to flush
    await act(async () => {
      await Promise.resolve();
    });

    expect(rejectedError).toBeInstanceOf(WalletConnectCancelError);
    expect(rejectedError?.name).toBe("WalletConnectCancelError");
  });

  it("wallet connects successfully: resolves with new address", async () => {
    setDisconnected();
    mockConnectModalOpen = true;

    const { result, rerender } = renderHook(() => useRequireWallet());

    let resolvedAddr: `0x${string}` | undefined;
    act(() => {
      result.current.requireWallet().then((addr) => {
        resolvedAddr = addr;
      });
    });

    // Simulate successful connection
    const newAddr = "0xDeAdBeEfDeAdBeEfDeAdBeEfDeAdBeEfDeAdBeEf";
    act(() => {
      setConnected(newAddr);
    });
    rerender();

    await act(async () => {
      await Promise.resolve();
    });

    expect(resolvedAddr).toBe(newAddr);
  });

  it("times out after 60s: rejects with WalletConnectCancelError", async () => {
    setDisconnected();
    mockConnectModalOpen = true;

    const { result } = renderHook(() => useRequireWallet());

    let rejectedError: Error | undefined;
    act(() => {
      result.current.requireWallet().catch((e: Error) => {
        rejectedError = e;
      });
    });

    // Fast-forward 60 seconds
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(rejectedError).toBeInstanceOf(WalletConnectCancelError);
  });

  it("openConnectModal unavailable: rejects with WalletRequiredError", async () => {
    setDisconnected();
    mockOpenConnectModal = undefined;

    const { result } = renderHook(() => useRequireWallet());

    await expect(result.current.requireWallet()).rejects.toBeInstanceOf(WalletRequiredError);
  });

  it("concurrent calls reuse the inflight promise (DD-072 bug_017)", async () => {
    setDisconnected();
    mockConnectModalOpen = true;

    const { result, rerender } = renderHook(() => useRequireWallet());

    // 两次调用应拿到同一个 Promise（并发双击场景）
    let p1!: Promise<`0x${string}`>;
    let p2!: Promise<`0x${string}`>;
    act(() => {
      p1 = result.current.requireWallet();
      p2 = result.current.requireWallet();
    });

    // 连接弹窗只打开一次，底层不会写入重复的 storage
    expect(mockOpenConnectModal).toHaveBeenCalledTimes(1);
    // Promise 身份必须一致（复用而非新建）
    expect(p1).toBe(p2);

    // 单次连接成功 → 两个 awaiter 同时 resolve
    const newAddr = "0xDeAdBeEfDeAdBeEfDeAdBeEfDeAdBeEfDeAdBeEf";
    act(() => {
      setConnected(newAddr);
    });
    rerender();

    await act(async () => {
      await Promise.resolve();
    });

    await expect(p1).resolves.toBe(newAddr);
    await expect(p2).resolves.toBe(newAddr);
  });

  it("after in-flight promise settles, next call creates a fresh one (no stale reuse)", async () => {
    setDisconnected();
    mockConnectModalOpen = true;

    const { result, rerender } = renderHook(() => useRequireWallet());

    // 第一次调用 → 超时 reject
    let firstError: Error | undefined;
    act(() => {
      result.current.requireWallet().catch((e: Error) => {
        firstError = e;
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(firstError).toBeInstanceOf(WalletConnectCancelError);

    // 第二次调用必须走 new Promise 路径（openConnectModal 再次触发），而非复用已 settle 的 Promise
    const modalCallsBefore = (mockOpenConnectModal as ReturnType<typeof vi.fn>).mock.calls.length;
    let secondResolved: `0x${string}` | undefined;
    act(() => {
      result.current.requireWallet().then((a) => {
        secondResolved = a;
      });
    });
    expect((mockOpenConnectModal as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      modalCallsBefore + 1
    );

    const secondAddr = "0xFeEdFaCeFeEdFaCeFeEdFaCeFeEdFaCeFeEdFaCe";
    act(() => {
      setConnected(secondAddr);
    });
    rerender();
    await act(async () => {
      await Promise.resolve();
    });
    expect(secondResolved).toBe(secondAddr);
  });
});
