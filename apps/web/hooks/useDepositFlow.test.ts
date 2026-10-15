// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDepositFlow } from "./useDepositFlow";
import type { TokenMeta } from "@/lib/token-registry";

const MOCK_ASSET: TokenMeta = {
  symbol: "BNB",
  name: "BNB",
  address: "0x0000000000000000000000000000000000000000",
  decimals: 18,
  isNative: true,
  iconUrl: "/images/chains/bsc.svg",
  tier: 1,
  chainId: 56,
};

describe("useDepositFlow", () => {
  it("initializes with closed state", () => {
    const { result } = renderHook(() => useDepositFlow());
    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.step).toBe("method");
    expect(result.current.state.selectedAsset).toBeNull();
    expect(result.current.state.usdAmount).toBe("");
  });

  it("open() sets isOpen to true and resets to method step", () => {
    const { result } = renderHook(() => useDepositFlow());

    act(() => result.current.open());
    expect(result.current.state.isOpen).toBe(true);
    expect(result.current.state.step).toBe("method");
  });

  it("close() resets all state", () => {
    const { result } = renderHook(() => useDepositFlow());

    // Open and advance
    act(() => result.current.open());
    act(() => result.current.goNext());
    act(() => result.current.selectAsset(MOCK_ASSET));

    // Close
    act(() => result.current.close());
    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.step).toBe("method");
    expect(result.current.state.selectedAsset).toBeNull();
    expect(result.current.state.usdAmount).toBe("");
  });

  it("goNext() advances through wallet path steps in order", () => {
    const { result } = renderHook(() => useDepositFlow());

    act(() => result.current.open());
    expect(result.current.state.step).toBe("method");

    act(() => result.current.goNext());
    expect(result.current.state.step).toBe("select");

    act(() => result.current.goNext());
    expect(result.current.state.step).toBe("amount");

    act(() => result.current.goNext());
    expect(result.current.state.step).toBe("confirm");
  });

  it("goNext() does not advance past last step", () => {
    const { result } = renderHook(() => useDepositFlow());

    act(() => result.current.open());
    // Navigate to last step
    act(() => result.current.goNext()); // → select
    act(() => result.current.goNext()); // → amount
    act(() => result.current.goNext()); // → confirm
    act(() => result.current.goNext()); // → result

    // Try to go past last step
    act(() => result.current.goNext());
    expect(result.current.state.step).toBe("result");
  });

  it("goBack() from amount goes to select", () => {
    const { result } = renderHook(() => useDepositFlow());

    act(() => result.current.open());
    act(() => result.current.goNext()); // → select
    act(() => result.current.goNext()); // → amount

    act(() => result.current.goBack());
    expect(result.current.state.step).toBe("select");
  });

  it("goBack() from select goes to method", () => {
    const { result } = renderHook(() => useDepositFlow());

    act(() => result.current.open());
    act(() => result.current.goNext()); // → select

    act(() => result.current.goBack());
    expect(result.current.state.step).toBe("method");
  });

  it("goBack() from receive goes to method", () => {
    const { result } = renderHook(() => useDepositFlow());

    act(() => result.current.open());
    act(() => result.current.setStep("receive")); // transfer path

    act(() => result.current.goBack());
    expect(result.current.state.step).toBe("method");
  });

  it("goNext() from receive is no-op (transfer path terminal)", () => {
    const { result } = renderHook(() => useDepositFlow());

    act(() => result.current.open());
    act(() => result.current.setStep("receive"));

    act(() => result.current.goNext());
    expect(result.current.state.step).toBe("receive");
  });

  it("goBack() does not go before method step", () => {
    const { result } = renderHook(() => useDepositFlow());

    act(() => result.current.open());

    act(() => result.current.goBack());
    expect(result.current.state.step).toBe("method");
  });

  it("setStep() jumps to any step directly", () => {
    const { result } = renderHook(() => useDepositFlow());

    act(() => result.current.open());
    act(() => result.current.setStep("receive"));
    expect(result.current.state.step).toBe("receive");

    act(() => result.current.setStep("confirm"));
    expect(result.current.state.step).toBe("confirm");

    act(() => result.current.setStep("method"));
    expect(result.current.state.step).toBe("method");
  });

  it("selectAsset() stores the selected asset", () => {
    const { result } = renderHook(() => useDepositFlow());

    act(() => result.current.open());
    act(() => result.current.selectAsset(MOCK_ASSET));

    expect(result.current.state.selectedAsset).toEqual(MOCK_ASSET);
  });

  it("setUsdAmount() updates the amount", () => {
    const { result } = renderHook(() => useDepositFlow());

    act(() => result.current.open());
    act(() => result.current.setUsdAmount("42.50"));

    expect(result.current.state.usdAmount).toBe("42.50");
  });

  it("open() resets previous flow state", () => {
    const { result } = renderHook(() => useDepositFlow());

    // Complete a flow
    act(() => result.current.open());
    act(() => result.current.goNext());
    act(() => result.current.selectAsset(MOCK_ASSET));
    act(() => result.current.setUsdAmount("10"));

    // Close and reopen
    act(() => result.current.close());
    act(() => result.current.open());

    expect(result.current.state.step).toBe("method");
    expect(result.current.state.selectedAsset).toBeNull();
    expect(result.current.state.usdAmount).toBe("");
  });
});
