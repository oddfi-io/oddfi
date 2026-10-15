import { describe, it, expect, beforeEach } from "vitest";
import { useProxyWalletStore } from "./proxyWalletStore";

const MOCK_WALLET = {
  address: "0xe8bda20bfa4c5b4da9eb1e327e16ecd69638d054" as `0x${string}`,
  network: "BNB Smart Chain",
  chainId: 56,
};

describe("proxyWalletStore", () => {
  beforeEach(() => {
    useProxyWalletStore.setState({
      proxyWallet: null,
      isAssigning: false,
      assignError: null,
    });
  });

  it("initializes with null proxy wallet", () => {
    const state = useProxyWalletStore.getState();
    expect(state.proxyWallet).toBeNull();
    expect(state.isAssigning).toBe(false);
    expect(state.assignError).toBeNull();
  });

  it("setProxyWallet stores wallet, clears error and isAssigning", () => {
    useProxyWalletStore.getState().setAssigning(true);
    useProxyWalletStore.getState().setAssignError("some error");
    useProxyWalletStore.getState().setProxyWallet(MOCK_WALLET);

    const state = useProxyWalletStore.getState();
    expect(state.proxyWallet).toEqual(MOCK_WALLET);
    expect(state.assignError).toBeNull();
    expect(state.isAssigning).toBe(false);
  });

  it("setAssigning updates flag", () => {
    useProxyWalletStore.getState().setAssigning(true);
    expect(useProxyWalletStore.getState().isAssigning).toBe(true);

    useProxyWalletStore.getState().setAssigning(false);
    expect(useProxyWalletStore.getState().isAssigning).toBe(false);
  });

  it("setAssignError sets error and clears isAssigning", () => {
    useProxyWalletStore.getState().setAssigning(true);
    useProxyWalletStore.getState().setAssignError("Network error");

    const state = useProxyWalletStore.getState();
    expect(state.assignError).toBe("Network error");
    expect(state.isAssigning).toBe(false);
  });

  it("clearProxy resets all state", () => {
    useProxyWalletStore.getState().setProxyWallet(MOCK_WALLET);
    useProxyWalletStore.getState().setAssigning(true);
    useProxyWalletStore.getState().clearProxy();

    const state = useProxyWalletStore.getState();
    expect(state.proxyWallet).toBeNull();
    expect(state.isAssigning).toBe(false);
    expect(state.assignError).toBeNull();
  });
});
