import { describe, it, expect } from "vitest";
import { truncateAddress, buildTxSummary } from "./utils";

describe("truncateAddress", () => {
  it("truncates a standard 42-char address", () => {
    expect(truncateAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18")).toBe("0x742d...bD18");
  });

  it("uses custom head and tail lengths", () => {
    expect(truncateAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18", 6, 6)).toBe(
      "0x742d35...f2bD18"
    );
  });

  it("returns original if address is shorter than head + tail + 2", () => {
    expect(truncateAddress("0x1234", 4, 4)).toBe("0x1234");
  });

  it("returns original for empty-ish strings", () => {
    expect(truncateAddress("0x12")).toBe("0x12");
  });

  it("handles head=0 tail=0 edge case", () => {
    const addr = "0xabcdef1234567890";
    // slice(-0) === slice(0), so tail returns entire string
    expect(truncateAddress(addr, 0, 0)).toBe("0x..." + addr);
  });
});

describe("buildTxSummary", () => {
  const baseParams = {
    usdAmount: "2.00",
    sendAmount: "0.00525",
    sendSymbol: "BNB",
    receiveAmount: "2.00000",
    receiveSymbol: "ODD",
    sourceAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    destAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
  };

  it("prepends $ to usdAmount", () => {
    const summary = buildTxSummary(baseParams);
    expect(summary.usdAmount).toBe("$2.00");
  });

  it("passes through send/receive amounts and symbols", () => {
    const summary = buildTxSummary(baseParams);
    expect(summary.sendAmount).toBe("0.00525");
    expect(summary.sendSymbol).toBe("BNB");
    expect(summary.receiveAmount).toBe("2.00000");
    expect(summary.receiveSymbol).toBe("ODD");
  });

  it("builds sourceLabel with default 'Wallet' and truncated address", () => {
    const summary = buildTxSummary(baseParams);
    expect(summary.sourceLabel).toBe("Wallet (0x742d...bD18)");
  });

  it("builds destLabel with custom label and truncated address", () => {
    const summary = buildTxSummary({
      ...baseParams,
      destLabel: "ODD Wallet",
    });
    expect(summary.destLabel).toBe("ODD Wallet (0xABCD...EF12)");
  });

  it("uses custom sourceLabel", () => {
    const summary = buildTxSummary({
      ...baseParams,
      sourceLabel: "My Wallet",
    });
    expect(summary.sourceLabel).toBe("My Wallet (0x742d...bD18)");
  });

  it("defaults estimatedTime to '< 1 min'", () => {
    const summary = buildTxSummary(baseParams);
    expect(summary.estimatedTime).toBe("< 1 min");
  });

  it("uses provided estimatedTime", () => {
    const summary = buildTxSummary({
      ...baseParams,
      estimatedTime: "~30 sec",
    });
    expect(summary.estimatedTime).toBe("~30 sec");
  });

  it("passes through optional fee fields", () => {
    const summary = buildTxSummary({
      ...baseParams,
      networkCost: "$0.03",
      priceImpact: "0.48%",
      maxSlippage: "Auto · 0.78%",
    });
    expect(summary.networkCost).toBe("$0.03");
    expect(summary.priceImpact).toBe("0.48%");
    expect(summary.maxSlippage).toBe("Auto · 0.78%");
  });

  it("leaves optional fee fields undefined when not provided", () => {
    const summary = buildTxSummary(baseParams);
    expect(summary.networkCost).toBeUndefined();
    expect(summary.priceImpact).toBeUndefined();
    expect(summary.maxSlippage).toBeUndefined();
  });

  it("passes through optional icon URLs", () => {
    const summary = buildTxSummary({
      ...baseParams,
      sendIconUrl: "/images/chains/bsc.svg",
      receiveIconUrl: "/images/tokens/odd.svg",
    });
    expect(summary.sendIconUrl).toBe("/images/chains/bsc.svg");
    expect(summary.receiveIconUrl).toBe("/images/tokens/odd.svg");
  });
});
