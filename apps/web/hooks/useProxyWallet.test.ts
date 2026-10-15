// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useProxyWalletStore } from "@/stores/proxyWalletStore";
import { useProxyWallet } from "./useProxyWallet";

const REAL_PROXY = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`;
const REAL_WALLET = { address: REAL_PROXY, network: "BNB Smart Chain", chainId: 56 };

function resetStore() {
  useProxyWalletStore.setState({ proxyWallet: null, isAssigning: false, assignError: null });
}

describe("useProxyWallet", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null wallet when store is empty", () => {
    const { result } = renderHook(() => useProxyWallet());
    expect(result.current.wallet).toBeNull();
    expect(result.current.isAssigned).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns wallet from store when assigned by useAuth", () => {
    useProxyWalletStore.getState().setProxyWallet(REAL_WALLET);

    const { result } = renderHook(() => useProxyWallet());
    expect(result.current.wallet).toEqual(REAL_WALLET);
    expect(result.current.isAssigned).toBe(true);
  });

  it("returns empty balances (real balance API not yet integrated)", () => {
    const { result } = renderHook(() => useProxyWallet());
    expect(result.current.balances).toEqual([]);
  });

  // ENH-014: proxy 生命周期与 session 绑定，不再响应 wagmi disconnect。
  // wagmi 连接抖动（切链、刷新、钱包临时断开）不应清空 proxy，
  // 只有 performLogout 会调用 clearProxy()。
  it("preserves proxy wallet across wagmi disconnect (ENH-014)", () => {
    useProxyWalletStore.getState().setProxyWallet(REAL_WALLET);
    const { result, rerender } = renderHook(() => useProxyWallet());
    expect(result.current.isAssigned).toBe(true);

    rerender();
    expect(result.current.wallet).toEqual(REAL_WALLET);
    expect(result.current.isAssigned).toBe(true);
  });

  it("reflects isLoading from store", () => {
    useProxyWalletStore.getState().setAssigning(true);
    const { result } = renderHook(() => useProxyWallet());
    expect(result.current.isLoading).toBe(true);
  });

  it("reflects assignError from store", () => {
    useProxyWalletStore.getState().setAssignError("assign failed");
    const { result } = renderHook(() => useProxyWallet());
    expect(result.current.error).toBe("assign failed");
  });
});
