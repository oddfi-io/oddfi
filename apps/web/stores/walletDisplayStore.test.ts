import { describe, it, expect, beforeEach } from "vitest";
import { useWalletDisplayStore } from "./walletDisplayStore";

describe("walletDisplayStore", () => {
  beforeEach(() => {
    useWalletDisplayStore.setState({ activeSymbol: null });
  });

  it("initializes with null activeSymbol", () => {
    expect(useWalletDisplayStore.getState().activeSymbol).toBeNull();
  });

  it("setActiveSymbol updates the symbol", () => {
    useWalletDisplayStore.getState().setActiveSymbol("BNB");
    expect(useWalletDisplayStore.getState().activeSymbol).toBe("BNB");
  });

  it("resetActiveSymbol clears the symbol", () => {
    useWalletDisplayStore.getState().setActiveSymbol("CAKE");
    useWalletDisplayStore.getState().resetActiveSymbol();
    expect(useWalletDisplayStore.getState().activeSymbol).toBeNull();
  });

  it("supports switching between tokens", () => {
    const { setActiveSymbol } = useWalletDisplayStore.getState();
    setActiveSymbol("USDT");
    expect(useWalletDisplayStore.getState().activeSymbol).toBe("USDT");
    setActiveSymbol("BNB");
    expect(useWalletDisplayStore.getState().activeSymbol).toBe("BNB");
  });
});
