import { describe, it, expect } from "vitest";
import { revertKindToI18nKey, formatRevertArgs } from "./onchain-error-i18n";
import type { DecodedRevert, RevertKind } from "@/lib/onchain/revert-decoder";

const ALL_KINDS: RevertKind[] = [
  "bet-amount-below-min",
  "pool-liquidity-insufficient",
  "market-locked",
  "market-not-open",
  "market-closed",
  "invalid-quote-guard",
  "daily-limit-exceeded",
  "open-position-exceeded",
  "match-payout-exceeded",
  "erc20-insufficient-allowance",
  "erc20-insufficient-balance",
  "contract-panic",
  "unknown",
];

function mk(kind: RevertKind, args: readonly unknown[]): DecodedRevert {
  return { kind, args, rawData: "0xdeadbeef", unwrapped: false };
}

describe("revertKindToI18nKey", () => {
  it("所有 13 个 kind 都返回非空字符串（无遗漏）", () => {
    for (const k of ALL_KINDS) {
      const key = revertKindToI18nKey(k);
      expect(typeof key).toBe("string");
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it("返回的 key 不重复（每个 kind 唯一）", () => {
    const keys = ALL_KINDS.map(revertKindToI18nKey);
    const set = new Set(keys);
    expect(set.size).toBe(ALL_KINDS.length);
  });
});

describe("formatRevertArgs — wei → ODD 展示", () => {
  it("bet-amount-below-min：50e18 / 100e18 → '50' / '100'", () => {
    const args = formatRevertArgs(
      mk("bet-amount-below-min", [50n * 10n ** 18n, 100n * 10n ** 18n])
    );
    expect(args).toEqual({ amount: "50", minimum: "100" });
  });

  it("pool-liquidity-insufficient：保留小数位", () => {
    const args = formatRevertArgs(
      mk("pool-liquidity-insufficient", [123456n * 10n ** 14n, 500n * 10n ** 18n])
    );
    // 123456e14 = 12.3456e18 → "12.3456"
    expect(args).toEqual({ requested: "12.3456", available: "500" });
  });

  it("erc20-insufficient-allowance：3-arg error（跳过第 0 个 address）", () => {
    const args = formatRevertArgs(
      mk("erc20-insufficient-allowance", ["0xdead", 10n * 10n ** 18n, 100n * 10n ** 18n])
    );
    expect(args).toEqual({ allowance: "10", needed: "100" });
  });

  it("market-locked：marketId 原样输出 hex", () => {
    const id = "0xabc";
    const args = formatRevertArgs(mk("market-locked", [id]));
    expect(args).toEqual({ marketId: id });
  });

  it("invalid-quote-guard / contract-panic / unknown：空对象", () => {
    expect(formatRevertArgs(mk("invalid-quote-guard", []))).toEqual({});
    expect(formatRevertArgs(mk("contract-panic", [0x32n]))).toEqual({});
    expect(formatRevertArgs(mk("unknown", []))).toEqual({});
  });

  it("contract-panic → contractPanic i18n key", () => {
    expect(revertKindToI18nKey("contract-panic")).toBe("contractPanic");
  });

  it("args 缺失时不 throw（防御性）", () => {
    expect(() => formatRevertArgs(mk("bet-amount-below-min", []))).not.toThrow();
    expect(() => formatRevertArgs(mk("daily-limit-exceeded", ["addr"]))).not.toThrow();
  });
});
