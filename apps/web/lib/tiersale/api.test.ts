import { describe, it, expect, vi, beforeEach } from "vitest";

// mock lib/api 的底层 helper —— 验证 tiersale API 层正确转发 path / 入参，不真发网络。
const authPost = vi.fn();
const onchainApprove = vi.fn();
vi.mock("@/lib/api", () => ({
  authPost: (...args: unknown[]) => authPost(...args),
  onchainApprove: (...args: unknown[]) => onchainApprove(...args),
}));

import { approveTierSale, estimateTierSale, buyTierSale } from "./api";

beforeEach(() => {
  authPost.mockReset();
  onchainApprove.mockReset();
});

describe("tiersale/api", () => {
  it("approveTierSale 固定 target='tiersale' 并透传 amount_wei", async () => {
    onchainApprove.mockResolvedValue({ tx_hash: "0xabc", order_id: 1 });
    const res = await approveTierSale("1000000000000000000");
    expect(onchainApprove).toHaveBeenCalledWith({
      target: "tiersale",
      amount_wei: "1000000000000000000",
    });
    expect(res.tx_hash).toBe("0xabc");
  });

  it("estimateTierSale 打 tiersale/estimate 并透传 usdt_amount", async () => {
    const fixture = {
      odd_amount: "100",
      odd_amount_wei: "100000000000000000000",
      usdt_cost: "1",
      budget_left: "0",
      start_tier: 1,
      end_tier: 1,
      crosses_tier: false,
      capped_by_sale: false,
    };
    authPost.mockResolvedValue(fixture);
    const res = await estimateTierSale({ usdt_amount: "1" });
    expect(authPost).toHaveBeenCalledWith("account/onchain/tiersale/estimate", {
      usdt_amount: "1",
    });
    expect(res).toEqual(fixture);
  });

  it("buyTierSale 打 tiersale/buy 并透传 odd_amount_wei + nonce", async () => {
    authPost.mockResolvedValue({ tx_hash: "0xdef", order_id: 2 });
    const res = await buyTierSale({ odd_amount_wei: "100000000000000000000", nonce: "uuid-1" });
    expect(authPost).toHaveBeenCalledWith("account/onchain/tiersale/buy", {
      odd_amount_wei: "100000000000000000000",
      nonce: "uuid-1",
    });
    expect(res.tx_hash).toBe("0xdef");
  });

  it("estimate '0' odd_amount（售罄/预算太小）原样透传，不抛错", async () => {
    authPost.mockResolvedValue({
      odd_amount: "0",
      odd_amount_wei: "0",
      usdt_cost: "0",
      budget_left: "1",
      start_tier: 10,
      end_tier: 10,
      crosses_tier: false,
      capped_by_sale: true,
    });
    const res = await estimateTierSale({ usdt_amount: "1" });
    expect(res.odd_amount).toBe("0");
    expect(res.capped_by_sale).toBe(true);
  });
});
