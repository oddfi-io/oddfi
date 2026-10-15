// 测试 PoolDepositModal / PoolMatchDepositModal 中的最低存款额校验逻辑
// 镜像 handleConfirm 中的条件：minDeposit > 0n && amountBigInt < minDeposit
import { parseUnits } from "viem";
import { describe, it, expect } from "vitest";

function shouldWarn(amount: string, minDeposit: bigint): boolean {
  if (!amount) return false;
  try {
    const amountBigInt = parseUnits(amount, 18);
    return minDeposit > 0n && amountBigInt < minDeposit;
  } catch {
    return false;
  }
}

describe("pool deposit min amount validation", () => {
  const MIN_1000 = parseUnits("1000", 18);

  it("warns when amount is below minimum", () => {
    expect(shouldWarn("10", MIN_1000)).toBe(true);
    expect(shouldWarn("999", MIN_1000)).toBe(true);
    expect(shouldWarn("0.01", MIN_1000)).toBe(true);
    expect(shouldWarn("999.99", MIN_1000)).toBe(true);
  });

  it("passes when amount equals minimum", () => {
    expect(shouldWarn("1000", MIN_1000)).toBe(false);
  });

  it("passes when amount exceeds minimum", () => {
    expect(shouldWarn("1000.01", MIN_1000)).toBe(false);
    expect(shouldWarn("5000", MIN_1000)).toBe(false);
  });

  it("skips validation when minDeposit is 0 (contract not yet loaded)", () => {
    expect(shouldWarn("10", 0n)).toBe(false);
    expect(shouldWarn("1", 0n)).toBe(false);
  });

  it("returns false for empty amount (guard before validation)", () => {
    expect(shouldWarn("", MIN_1000)).toBe(false);
  });
});
