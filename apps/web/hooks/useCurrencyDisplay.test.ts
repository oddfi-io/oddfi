// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCurrencyDisplay } from "./useCurrencyDisplay";
import { useCurrencyStore } from "@/stores/currencyStore";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";

// Mock useOddPrice — 通过 mock 控制汇率状态
const mockUseOddPrice = vi.fn();
vi.mock("./useOddPrice", () => ({
  useOddPrice: () => mockUseOddPrice(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "TestWrapper";
  return Wrapper;
}

function render() {
  return renderHook(() => useCurrencyDisplay(), { wrapper: createWrapper() });
}

describe("useCurrencyDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 每个 test 前重置全局币种偏好为 ODD
    useCurrencyStore.setState({ currency: "ODD" });
  });

  // ─── 基本状态 ────────────────────────────────────────────
  describe("基本状态", () => {
    it("ODD 模式 + rate 已加载 → canConvert=false", () => {
      mockUseOddPrice.mockReturnValue({ data: "2" });
      const { result } = render();
      expect(result.current.isOdd).toBe(true);
      expect(result.current.isUsd).toBe(false);
      expect(result.current.canConvert).toBe(false);
      expect(result.current.rate).toBe("2");
    });

    it("USD 模式 + rate 已加载 → canConvert=true", () => {
      useCurrencyStore.setState({ currency: "USD" });
      mockUseOddPrice.mockReturnValue({ data: "2" });
      const { result } = render();
      expect(result.current.canConvert).toBe(true);
    });

    it("USD 模式 + rate=undefined → canConvert=false", () => {
      useCurrencyStore.setState({ currency: "USD" });
      mockUseOddPrice.mockReturnValue({ data: undefined });
      const { result } = render();
      expect(result.current.canConvert).toBe(false);
      expect(result.current.rate).toBe(null);
    });

    it("USD 模式 + rate=空字符串 → canConvert=false（不会 mul(x, 0) 清零）", () => {
      useCurrencyStore.setState({ currency: "USD" });
      mockUseOddPrice.mockReturnValue({ data: "" });
      const { result } = render();
      expect(result.current.canConvert).toBe(false);
    });

    it('USD 模式 + rate="0" → canConvert=false（防止后端异常导致全站归零）', () => {
      useCurrencyStore.setState({ currency: "USD" });
      mockUseOddPrice.mockReturnValue({ data: "0" });
      const { result } = render();
      expect(result.current.canConvert).toBe(false);
      expect(result.current.convert("50")).toBe("50");
      expect(result.current.format("50")).toBe(`50.00 ${PLATFORM_TOKEN_DISPLAY}`);
    });

    it("USD 模式 + rate=负数 → canConvert=false", () => {
      useCurrencyStore.setState({ currency: "USD" });
      mockUseOddPrice.mockReturnValue({ data: "-1" });
      const { result } = render();
      expect(result.current.canConvert).toBe(false);
    });
  });

  // ─── convert ───────────────────────────────────────────
  describe("convert", () => {
    it("canConvert=true → amount * rate", () => {
      useCurrencyStore.setState({ currency: "USD" });
      mockUseOddPrice.mockReturnValue({ data: "2" });
      const { result } = render();
      expect(result.current.convert("50")).toBe("100");
    });

    it("canConvert=false → 返回 ODD 原值（降级）", () => {
      useCurrencyStore.setState({ currency: "USD" });
      mockUseOddPrice.mockReturnValue({ data: undefined });
      const { result } = render();
      expect(result.current.convert("50")).toBe("50");
    });

    it("ODD 模式 → 始终返回原值", () => {
      mockUseOddPrice.mockReturnValue({ data: "2" });
      const { result } = render();
      expect(result.current.convert("50")).toBe("50");
    });
  });

  // ─── format ────────────────────────────────────────────
  describe("format", () => {
    it("canConvert=true → '$amount USD'", () => {
      useCurrencyStore.setState({ currency: "USD" });
      mockUseOddPrice.mockReturnValue({ data: "2" });
      const { result } = render();
      expect(result.current.format("50")).toBe("$100.00 USD");
    });

    it("canConvert=false → '{amount} ODD'（标签基于 canConvert 而非 isUsd）", () => {
      useCurrencyStore.setState({ currency: "USD" });
      mockUseOddPrice.mockReturnValue({ data: undefined });
      const { result } = render();
      // 🔑 关键：用户选 USD 但 rate 未加载，必须显示平台币不能显示 "$50 USD"
      expect(result.current.format("50")).toBe(`50.00 ${PLATFORM_TOKEN_DISPLAY}`);
    });

    it("ODD 模式 → '{amount} {PLATFORM_TOKEN_DISPLAY}'", () => {
      mockUseOddPrice.mockReturnValue({ data: "2" });
      const { result } = render();
      expect(result.current.format("1234.56")).toBe(`1,234.56 ${PLATFORM_TOKEN_DISPLAY}`);
    });

    it("千位分隔符正确", () => {
      useCurrencyStore.setState({ currency: "USD" });
      mockUseOddPrice.mockReturnValue({ data: "2" });
      const { result } = render();
      expect(result.current.format("5000")).toBe("$10,000.00 USD");
    });

    it("decimals 参数生效", () => {
      mockUseOddPrice.mockReturnValue({ data: "2" });
      const { result } = render();
      expect(result.current.format("50", 0)).toBe(`50 ${PLATFORM_TOKEN_DISPLAY}`);
      expect(result.current.format("50", 4)).toBe(`50.0000 ${PLATFORM_TOKEN_DISPLAY}`);
    });
  });

  // ─── formatDual ────────────────────────────────────────
  describe("formatDual", () => {
    it("ODD 模式 + rate 已加载 → primary=平台币, secondary=≈$USD", () => {
      mockUseOddPrice.mockReturnValue({ data: "2" });
      const { result } = render();
      const out = result.current.formatDual("50");
      expect(out.primary).toBe("50.00");
      expect(out.primaryUnit).toBe(PLATFORM_TOKEN_DISPLAY);
      expect(out.secondary).toBe("≈$100.00");
    });

    it("USD 模式 + rate 已加载 → primary=$USD, secondary=≈平台币", () => {
      useCurrencyStore.setState({ currency: "USD" });
      mockUseOddPrice.mockReturnValue({ data: "2" });
      const { result } = render();
      const out = result.current.formatDual("50");
      expect(out.primary).toBe("$100.00");
      expect(out.primaryUnit).toBe("USD");
      expect(out.secondary).toBe(`≈50.00 ${PLATFORM_TOKEN_DISPLAY}`);
    });

    it("ODD 模式 + rate 未加载 → primary=平台币, secondary=null（降级）", () => {
      mockUseOddPrice.mockReturnValue({ data: undefined });
      const { result } = render();
      const out = result.current.formatDual("50");
      expect(out.primary).toBe("50.00");
      expect(out.primaryUnit).toBe(PLATFORM_TOKEN_DISPLAY);
      expect(out.secondary).toBe(null);
    });

    it("USD 模式 + rate 未加载 → 主值降级为平台币，secondary=null", () => {
      useCurrencyStore.setState({ currency: "USD" });
      mockUseOddPrice.mockReturnValue({ data: undefined });
      const { result } = render();
      const out = result.current.formatDual("50");
      expect(out.primary).toBe("50.00");
      expect(out.primaryUnit).toBe(PLATFORM_TOKEN_DISPLAY);
      expect(out.secondary).toBe(null);
    });

    it("rate 为空字符串时也降级", () => {
      useCurrencyStore.setState({ currency: "USD" });
      mockUseOddPrice.mockReturnValue({ data: "" });
      const { result } = render();
      const out = result.current.formatDual("50");
      expect(out.primaryUnit).toBe(PLATFORM_TOKEN_DISPLAY);
      expect(out.secondary).toBe(null);
    });
  });

  // ─── toggle ────────────────────────────────────────────
  describe("toggle", () => {
    it("ODD → USD → ODD", () => {
      mockUseOddPrice.mockReturnValue({ data: "2" });
      const { result } = render();
      expect(result.current.currency).toBe("ODD");

      act(() => result.current.toggle());
      expect(useCurrencyStore.getState().currency).toBe("USD");

      act(() => {
        useCurrencyStore.getState().setCurrency("USD");
      });
      // 再次读取最新 hook
      const { result: r2 } = render();
      act(() => r2.current.toggle());
      expect(useCurrencyStore.getState().currency).toBe("ODD");
    });
  });

  // ─── 精度 ─────────────────────────────────────────────
  describe("精度", () => {
    it("小数汇率精度不丢失", () => {
      useCurrencyStore.setState({ currency: "USD" });
      mockUseOddPrice.mockReturnValue({ data: "0.1234" });
      const { result } = render();
      // 50 * 0.1234 = 6.17
      expect(result.current.convert("50")).toBe("6.17");
      expect(result.current.format("50")).toBe("$6.17 USD");
    });

    it("0 金额处理", () => {
      useCurrencyStore.setState({ currency: "USD" });
      mockUseOddPrice.mockReturnValue({ data: "2" });
      const { result } = render();
      expect(result.current.format("0")).toBe("$0.00 USD");
    });
  });
});
