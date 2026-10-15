// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const estimateTierSale = vi.fn();
const submitTierSaleBuy = vi.fn();

vi.mock("@/lib/tiersale/api", () => ({
  estimateTierSale: (...a: unknown[]) => estimateTierSale(...a),
  // submit-tiersale-buy.ts 在 defaultDeps 里引用这两个；本测试 mock 了 submitTierSaleBuy，
  // 它们不会被真正调用，给个 noop 满足模块加载即可。
  approveTierSale: vi.fn(),
  buyTierSale: vi.fn(),
}));
vi.mock("@/lib/tiersale/submit-tiersale-buy", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, submitTierSaleBuy: (...a: unknown[]) => submitTierSaleBuy(...a) };
});
vi.mock("@/lib/toast", () => ({ toastError: vi.fn() }));

import { useTierSaleBuy } from "./useTierSaleBuy";
import { ReceiptTimeoutError } from "@/lib/onchain/receipt-poller";

const EST = {
  odd_amount: "100",
  odd_amount_wei: "100000000000000000000",
  usdt_cost: "1",
  budget_left: "0",
  start_tier: 1,
  end_tier: 1,
  crosses_tier: false,
  capped_by_sale: false,
};

beforeEach(() => {
  estimateTierSale.mockReset();
  submitTierSaleBuy.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useTierSaleBuy", () => {
  it("setUsdtAmount debounce 后触发一次 estimate（seq 守卫）", async () => {
    vi.useFakeTimers();
    estimateTierSale.mockResolvedValue(EST);
    const { result } = renderHook(() => useTierSaleBuy());

    act(() => result.current.setUsdtAmount("1"));
    expect(estimateTierSale).not.toHaveBeenCalled(); // 还在 debounce 窗口
    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });
    expect(estimateTierSale).toHaveBeenCalledTimes(1);
    expect(result.current.estimate?.odd_amount).toBe("100");
  });

  it("空金额清空 estimate，不打接口", () => {
    const { result } = renderHook(() => useTierSaleBuy());
    act(() => result.current.setUsdtAmount("   "));
    expect(estimateTierSale).not.toHaveBeenCalled();
    expect(result.current.estimate).toBeNull();
  });

  it("buy 成功：re-estimate → submit → phase=success + txHash", async () => {
    estimateTierSale.mockResolvedValue(EST);
    submitTierSaleBuy.mockResolvedValue({ approveTxHash: "0xa", buyTxHash: "0xbuy", orderId: 9 });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useTierSaleBuy(onSuccess));

    act(() => result.current.setUsdtAmount("1"));
    act(() => result.current.buy());

    await waitFor(() => expect(result.current.phase).toBe("success"));
    expect(submitTierSaleBuy).toHaveBeenCalledTimes(1);
    expect(result.current.buyTxHash).toBe("0xbuy");
    expect(onSuccess).toHaveBeenCalled();
  });

  it("滑点超阈值：debounce estimate 后 buy re-estimate 花费跳变 → 中止不下单", async () => {
    vi.useFakeTimers();
    // ① debounce estimate cost=1（用户看到的）② buy re-estimate cost=2（+100% > 1%）
    estimateTierSale.mockResolvedValueOnce(EST).mockResolvedValueOnce({ ...EST, usdt_cost: "2" });
    const { result } = renderHook(() => useTierSaleBuy());

    act(() => result.current.setUsdtAmount("1"));
    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });
    expect(result.current.estimate?.usdt_cost).toBe("1"); // prevEstimate 已落地

    await act(async () => {
      result.current.buy();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(submitTierSaleBuy).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("failed");
    expect(result.current.canRetry).toBe(true);
  });

  it("buy poll 超时 → phase=reconciling, canRetry=false（禁止盲重发）", async () => {
    estimateTierSale.mockResolvedValue(EST);
    submitTierSaleBuy.mockRejectedValue(new ReceiptTimeoutError("0xbuy", 180000));
    const { result } = renderHook(() => useTierSaleBuy());

    act(() => result.current.setUsdtAmount("1"));
    act(() => result.current.buy());

    await waitFor(() => expect(result.current.phase).toBe("reconciling"));
    expect(result.current.canRetry).toBe(false);
  });
});
