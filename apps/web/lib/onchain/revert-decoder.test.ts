import { describe, it, expect } from "vitest";
import { encodeAbiParameters, toHex, concat } from "viem";
import { parseRevertData, extractRevertData, type RevertKind } from "./revert-decoder";

/**
 * 把 inner error 包装成 AccountManager 的 `CallFailed(uint256,bytes)` 外壳。
 * 模拟链上实际抛出的 reverted data 结构。
 */
function wrapCallFailed(innerData: `0x${string}`, callIndex = 0n): `0x${string}` {
  const inner = innerData.slice(2);
  const innerBytes = ("0x" + inner) as `0x${string}`;
  const encoded = encodeAbiParameters(
    [
      { name: "callIndex", type: "uint256" },
      { name: "reason", type: "bytes" },
    ],
    [callIndex, innerBytes]
  );
  return concat(["0x5c0dee5d", encoded]);
}

/** 构造 `Error(selector, uint256[, uint256])` 这类 hex data */
function buildErrorHex(selector: `0x${string}`, args: bigint[]): `0x${string}` {
  if (args.length === 0) return selector;
  const types = args.map(() => ({ name: "v", type: "uint256" as const }));
  const encoded = encodeAbiParameters(types, args);
  return concat([selector, encoded]);
}

describe("parseRevertData — 基本边界", () => {
  it("返回 null：空 / 短数据 / 非 0x", () => {
    expect(parseRevertData(null)).toBeNull();
    expect(parseRevertData(undefined)).toBeNull();
    expect(parseRevertData("0x" as `0x${string}`)).toBeNull();
    expect(parseRevertData("0x1234" as `0x${string}`)).toBeNull();
  });

  it("未知 selector 返回 kind=unknown 且保留 rawData", () => {
    const data = "0xdeadbeef00000000" as `0x${string}`;
    const r = parseRevertData(data);
    expect(r).not.toBeNull();
    expect(r!.kind).toBe<RevertKind>("unknown");
    expect(r!.args).toEqual([]);
    expect(r!.rawData).toBe(data);
    expect(r!.unwrapped).toBe(false);
  });
});

describe("parseRevertData — BetAmountBelowMinimum（DD-105 实际 bug 复现）", () => {
  // BSC Testnet tx 0xc4fcb51...d149 的真实 revert data
  const REAL_REVERT_DATA =
    "0x5c0dee5d00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000004427ab623f000000000000000000000000000000000000000000000002b5e3af16b18800000000000000000000000000000000000000000000000000056bc75e2d6310000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

  it("从真实 reverted tx 数据解出 amount=50e18, minimum=100e18", () => {
    const r = parseRevertData(REAL_REVERT_DATA);
    expect(r).not.toBeNull();
    expect(r!.kind).toBe<RevertKind>("bet-amount-below-min");
    expect(r!.unwrapped).toBe(true);
    expect(r!.args.length).toBe(2);
    expect(r!.args[0]).toBe(50n * 10n ** 18n); // amount = 50 ODD
    expect(r!.args[1]).toBe(100n * 10n ** 18n); // minimum = 100 ODD
  });
});

describe("parseRevertData — CallFailed 自动解包", () => {
  it("PoolLiquidityInsufficient 被 CallFailed 包裹时正确解开", () => {
    const inner = buildErrorHex("0xbcf56fa9", [123n * 10n ** 18n, 50n * 10n ** 18n]);
    const outer = wrapCallFailed(inner, 0n);
    const r = parseRevertData(outer);
    expect(r).not.toBeNull();
    expect(r!.kind).toBe<RevertKind>("pool-liquidity-insufficient");
    expect(r!.unwrapped).toBe(true);
    expect(r!.args[0]).toBe(123n * 10n ** 18n);
    expect(r!.args[1]).toBe(50n * 10n ** 18n);
  });

  it("内层 selector 未知时 → kind=unknown 但保留 unwrapped=true", () => {
    const inner = "0xdeadbeef" as `0x${string}`;
    const outer = wrapCallFailed(inner, 1n);
    const r = parseRevertData(outer);
    expect(r!.kind).toBe("unknown");
    expect(r!.unwrapped).toBe(true);
  });

  it("内层 Panic(0x32) 数组越界被 CallFailed 包裹时解为 contract-panic（BUG-018）", () => {
    // Solidity Panic 选择器 0x4e487b71 + uint256 code
    const inner = buildErrorHex("0x4e487b71", [0x32n]);
    const outer = wrapCallFailed(inner, 0n);
    const r = parseRevertData(outer);
    expect(r!.kind).toBe<RevertKind>("contract-panic");
    expect(r!.unwrapped).toBe(true);
    expect(r!.args[0]).toBe(0x32n); // panic code 50 = 数组越界
  });

  it("从真实 reverted tx（BUG-018 OU 下注）解出 contract-panic", () => {
    // BSC Testnet tx 0xaf493609...e555 的真实 revert data：CallFailed(0, Panic(0x32))
    const REAL =
      "0x5c0dee5d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000244e487b71000000000000000000000000000000000000000000000000000000000000003200000000000000000000000000000000000000000000000000000000" as `0x${string}`;
    const r = parseRevertData(REAL);
    expect(r!.kind).toBe<RevertKind>("contract-panic");
    expect(r!.unwrapped).toBe(true);
    expect(r!.args[0]).toBe(0x32n);
  });
});

describe("parseRevertData — 无包裹的直接 revert（ERC20 等）", () => {
  it("ERC20InsufficientAllowance 直接抛出（未被 CallFailed 包裹）", () => {
    const SPENDER = "0x0000000000000000000000000000000000001234";
    const data = concat([
      "0xfb8f41b2",
      encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
        [SPENDER, 10n, 100n]
      ),
    ]);
    const r = parseRevertData(data);
    expect(r!.kind).toBe<RevertKind>("erc20-insufficient-allowance");
    expect(r!.unwrapped).toBe(false);
    expect((r!.args[0] as string).toLowerCase()).toBe(SPENDER);
    expect(r!.args[1]).toBe(10n);
    expect(r!.args[2]).toBe(100n);
  });

  it("InvalidQuoteGuard（无参数）", () => {
    const r = parseRevertData("0xda803aa3" as `0x${string}`);
    expect(r!.kind).toBe<RevertKind>("invalid-quote-guard");
    expect(r!.args).toEqual([]);
    expect(r!.unwrapped).toBe(false);
  });

  it("MarketLocked(bytes32)", () => {
    const marketId = toHex(new Uint8Array(32).fill(0xaa), { size: 32 });
    const data = concat(["0x72752842", marketId]);
    const r = parseRevertData(data);
    expect(r!.kind).toBe<RevertKind>("market-locked");
    expect(r!.args[0]).toBe(marketId);
  });
});

describe("extractRevertData — 沿 cause 链找 data", () => {
  it("从 viem-like nested error 提取 data", () => {
    const data = "0xdeadbeef" as `0x${string}`;
    const err = { cause: { cause: { data } } };
    expect(extractRevertData(err)).toBe(data);
  });

  it("无 data 返回 null", () => {
    expect(extractRevertData(new Error("no data"))).toBeNull();
    expect(extractRevertData(null)).toBeNull();
    expect(extractRevertData(undefined)).toBeNull();
  });

  it("循环引用不卡死", () => {
    const a: Record<string, unknown> = {};
    a.cause = a;
    expect(extractRevertData(a)).toBeNull();
  });
});
