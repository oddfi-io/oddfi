import { describe, it, expect } from "vitest";
import { parseUnits } from "viem";
import { clampAmountToBalance, shouldTriggerSwitchAndQuote } from "@/lib/swap/amount-clamp";

// ETH / BNB 用 18 decimals；USDT on BSC 用 18；USDT on ARB/ETH 用 6
const ETH_DEC = 18;
const USDT_ARB_DEC = 6;

describe("clampAmountToBalance", () => {
  it("空串 → 原样", () => {
    expect(clampAmountToBalance("", parseUnits("1", ETH_DEC), ETH_DEC)).toBe("");
  });

  it("中间态 '0.' → 原样（非正数，不抹平）", () => {
    expect(clampAmountToBalance("0.", parseUnits("1", ETH_DEC), ETH_DEC)).toBe("0.");
  });

  it("中间态 '.' → 原样", () => {
    expect(clampAmountToBalance(".", parseUnits("1", ETH_DEC), ETH_DEC)).toBe(".");
  });

  it("中间态 '0.0' → 原样", () => {
    expect(clampAmountToBalance("0.0", parseUnits("1", ETH_DEC), ETH_DEC)).toBe("0.0");
  });

  it("'0' → 原样（非正数）", () => {
    expect(clampAmountToBalance("0", parseUnits("1", ETH_DEC), ETH_DEC)).toBe("0");
  });

  it("余额 = 0n → 原样（交由 insufficientBalance UI 兜底）", () => {
    expect(clampAmountToBalance("1", 0n, ETH_DEC)).toBe("1");
  });

  it("正数 < 余额 → 原样", () => {
    expect(clampAmountToBalance("0.001", parseUnits("0.01363", ETH_DEC), ETH_DEC)).toBe("0.001");
  });

  it("正数 = 余额 → 原样", () => {
    expect(clampAmountToBalance("0.01363", parseUnits("0.01363", ETH_DEC), ETH_DEC)).toBe(
      "0.01363"
    );
  });

  it("正数 > 余额 → 抹到 max（formatBalance 6 位精度）", () => {
    expect(clampAmountToBalance("1", parseUnits("0.01363", ETH_DEC), ETH_DEC)).toBe("0.01363");
  });

  it("USDT 6 decimals，超额 → 抹到 max", () => {
    // 余额 12.345678 USDT，用户输入 100 → 返回 "12.345678"
    expect(clampAmountToBalance("100", parseUnits("12.345678", USDT_ARB_DEC), USDT_ARB_DEC)).toBe(
      "12.345678"
    );
  });

  it("余额有 >6 位精度尾部 → formatBalance 截断到 6 位", () => {
    // 1.1234567890123 ETH，max 应为 "1.123456"（6 位截断/保留）
    const balance = parseUnits("1.1234567890123", ETH_DEC);
    expect(clampAmountToBalance("99", balance, ETH_DEC)).toBe("1.123456");
  });

  it("非法输入 'abc' → 原样（isValidAmount 失败）", () => {
    expect(clampAmountToBalance("abc", parseUnits("1", ETH_DEC), ETH_DEC)).toBe("abc");
  });

  it("超量小数位触发 parseUnits 失败 → 原样", () => {
    // 20 位小数，超过 18 decimals，parseUnits 会抛，clamp 走 catch
    const tooManyDecimals = "0.123456789012345678901";
    const balance = parseUnits("0.01", ETH_DEC);
    // 仍能通过 isGt 比较返回抹平值（decimal.js 支持任意精度）→ 不会到 parseUnits
    // 此 case 验证超余额场景：输入远大于余额 → 返回 "0.01"
    expect(clampAmountToBalance(tooManyDecimals, balance, ETH_DEC)).toBe("0.01");
  });
});

describe("shouldTriggerSwitchAndQuote", () => {
  const balance = parseUnits("0.01363", ETH_DEC);

  it("空串 → false", () => {
    expect(shouldTriggerSwitchAndQuote("", balance, ETH_DEC)).toBe(false);
  });

  it("'0' → false（非正数）", () => {
    expect(shouldTriggerSwitchAndQuote("0", balance, ETH_DEC)).toBe(false);
  });

  it("中间态 '0.' → false", () => {
    expect(shouldTriggerSwitchAndQuote("0.", balance, ETH_DEC)).toBe(false);
  });

  it("正数 < 余额 → true", () => {
    expect(shouldTriggerSwitchAndQuote("0.001", balance, ETH_DEC)).toBe(true);
  });

  it("正数 = 余额 → true", () => {
    expect(shouldTriggerSwitchAndQuote("0.01363", balance, ETH_DEC)).toBe(true);
  });

  it("正数 > 余额 → false（gating 最后一道防线）", () => {
    expect(shouldTriggerSwitchAndQuote("1", balance, ETH_DEC)).toBe(false);
  });

  it("余额 = 0n → false", () => {
    expect(shouldTriggerSwitchAndQuote("0.001", 0n, ETH_DEC)).toBe(false);
  });

  it("非法输入 'abc' → false", () => {
    expect(shouldTriggerSwitchAndQuote("abc", balance, ETH_DEC)).toBe(false);
  });

  it("parseUnits 超量小数位 → false（catch 分支）", () => {
    // 19 位小数，超过 18 decimals 精度，parseUnits 抛错
    expect(shouldTriggerSwitchAndQuote("0.1234567890123456789", balance, ETH_DEC)).toBe(false);
  });

  it("USDT 6 decimals，正常金额 → true", () => {
    const usdtBalance = parseUnits("12.345678", USDT_ARB_DEC);
    expect(shouldTriggerSwitchAndQuote("10", usdtBalance, USDT_ARB_DEC)).toBe(true);
  });
});
