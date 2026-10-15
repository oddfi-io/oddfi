// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseUnits } from "viem";

// ── Mock wagmi/actions ────────────────────────────────────────────
const mockReadContract = vi.fn();
const mockWriteContract = vi.fn();

vi.mock("wagmi/actions", () => ({
  readContract: (...args: unknown[]) => mockReadContract(...args),
  writeContract: (...args: unknown[]) => mockWriteContract(...args),
}));

// ── Mock wagmi.config ─────────────────────────────────────────────
vi.mock("@/lib/wagmi.config", () => ({
  wagmiConfig: {},
}));

// ── Mock token-registry ────────────────────────────────────────────
vi.mock("@/lib/token-registry", () => ({
  WBNB_ADDRESS: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  TOKEN_BY_SYMBOL: {
    USDT: {
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18,
      symbol: "USDT",
      name: "USDT",
      iconUrl: "",
      tier: 0,
      chainId: 56,
    },
    // DD-142：proxy 退役，PLATFORM_TOKEN 模块加载时读此条（mainnet 真 ODD）
    ODD: {
      address: "0x3e130563e069c414F0a18863966c211aA5D518F9",
      decimals: 18,
      symbol: "ODD",
      name: "ODD",
      iconUrl: "",
      tier: 0,
      chainId: 56,
    },
  },
}));

// ── Mock decimal ───────────────────────────────────────────────────
vi.mock("@/lib/decimal", () => ({
  isGt: (a: string, b: string) => parseFloat(a) > parseFloat(b),
}));

// ── Import after mocks ─────────────────────────────────────────────
import { buildPath, computePancakeQuote, createPancakeSwap } from "./pancake-adapter";
import type { PancakeSwapParams } from "./pancake-adapter";
import type { TokenMeta } from "@/lib/token-registry";

// ── Token fixtures ────────────────────────────────────────────────

const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const USDT_ADDR = "0x55d398326f99059fF775485246999027B3197955";
const ODD_ADDR = "0x3e130563e069c414F0a18863966c211aA5D518F9";
const USDC_ADDR = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

const BNB: TokenMeta = {
  symbol: "BNB",
  name: "BNB",
  address: "0x0000000000000000000000000000000000000000",
  decimals: 18,
  iconUrl: "",
  tier: 9,
  isNative: true,
  chainId: 56,
};
const USDT: TokenMeta = {
  symbol: "USDT",
  name: "USDT",
  address: USDT_ADDR,
  decimals: 18,
  iconUrl: "",
  tier: 0,
  chainId: 56,
};
const ODD: TokenMeta = {
  symbol: "ODD",
  name: "ODD",
  address: ODD_ADDR,
  decimals: 18,
  iconUrl: "",
  tier: 0,
  chainId: 56,
};
const USDC: TokenMeta = {
  symbol: "USDC",
  name: "USDC",
  address: USDC_ADDR,
  decimals: 6,
  iconUrl: "",
  tier: 0,
  chainId: 56,
};

const USER = "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`;
const RECIPIENT = "0xabcdef1234567890abcdef1234567890abcdef12" as `0x${string}`;

// ── buildPath tests ───────────────────────────────────────────────

describe("buildPath", () => {
  it("BNB → USDT: direct [WBNB, USDT]", () => {
    const path = buildPath(BNB, USDT);
    expect(path).toEqual([WBNB, USDT_ADDR]);
  });

  it("USDT → BNB: direct [USDT, WBNB]", () => {
    const path = buildPath(USDT, BNB);
    expect(path).toEqual([USDT_ADDR, WBNB]);
  });

  it("BNB → ODD: routes via USDT [WBNB, USDT, ODD]", () => {
    const path = buildPath(BNB, ODD);
    expect(path).toEqual([WBNB, USDT_ADDR, ODD_ADDR]);
  });

  it("ODD → BNB: routes via USDT [ODD, USDT, WBNB]", () => {
    const path = buildPath(ODD, BNB);
    expect(path).toEqual([ODD_ADDR, USDT_ADDR, WBNB]);
  });

  it("USDT → ODD: direct [USDT, ODD]", () => {
    const path = buildPath(USDT, ODD);
    expect(path).toEqual([USDT_ADDR, ODD_ADDR]);
  });

  it("ODD → USDT: direct [ODD, USDT]", () => {
    const path = buildPath(ODD, USDT);
    expect(path).toEqual([ODD_ADDR, USDT_ADDR]);
  });

  it("generic ERC20 → ERC20 (no USDT involved): routes via WBNB [USDC, WBNB, USDT]", () => {
    // USDC → USDT: neither is ODD so standard routing, both non-native non-WBNB
    const path = buildPath(USDC, USDT);
    expect(path).toEqual([USDC_ADDR, WBNB, USDT_ADDR]);
  });
});

// ── computePancakeQuote tests ─────────────────────────────────────

describe("computePancakeQuote", () => {
  beforeEach(() => {
    mockReadContract.mockReset();
  });

  const makeParams = (
    from: TokenMeta,
    to: TokenMeta,
    amount = "1",
    slippageBps = 50
  ): PancakeSwapParams => ({
    fromToken: from,
    toToken: to,
    amount,
    slippageBps,
    recipient: RECIPIENT,
    owner: USER,
  });

  it("returns null when amount is 0", async () => {
    const result = await computePancakeQuote(makeParams(BNB, USDT, "0"));
    expect(result).toBeNull();
  });

  it("18→18: BNB→USDT quote calculation", async () => {
    // Mock: 1 BNB → 650 USDT (both 18 decimals)
    const amountIn = parseUnits("1", 18);
    const amountOut = parseUnits("650", 18);
    mockReadContract.mockResolvedValue([amountIn, amountOut]);

    const result = await computePancakeQuote(makeParams(BNB, USDT, "1", 50));

    expect(result).not.toBeNull();
    expect(result!.amountOut).toBe(amountOut);
    expect(result!.amountIn).toBe(amountIn);
    expect(result!.amountOutFormatted).toBe("650");
    // rate: 650/1 * 10^(18-18) = 650
    expect(parseFloat(result!.rate)).toBeCloseTo(650, 1);
    // minReceived: 650e18 * (10000-50) / 10000 = 650e18 * 9950/10000
    const expectedMin = (amountOut * 9950n) / 10000n;
    expect(result!.minReceived).toBe(expectedMin);
    // path: BNB→USDT = 2 hops=1, priceImpact = 0.25*1 + sizeImpact
    expect(parseFloat(result!.priceImpact)).toBeGreaterThan(0);
  });

  it("18→6: USDT(18)→USDC(6) quote with decimal difference", async () => {
    // 1 USDT (18 dec) → 1 USDC (6 dec): amountOut = 1e6
    const amountIn = parseUnits("1", 18);
    const amountOut = parseUnits("1", 6);
    mockReadContract.mockResolvedValue([amountIn, amountOut]);

    const usdtWith18 = { ...USDT, decimals: 18 };
    const usdcWith6 = { ...USDC, decimals: 6 };
    const result = await computePancakeQuote(makeParams(usdtWith18, usdcWith6, "1", 50));

    expect(result).not.toBeNull();
    expect(result!.amountOutFormatted).toBe("1");
    // rate = (1e6 / 1e18) * 10^(18-6) = 1e6/1e18 * 1e12 = 1.0
    expect(parseFloat(result!.rate)).toBeCloseTo(1.0, 4);
  });

  it("6→18: USDC(6)→USDT(18) rate calculation", async () => {
    // 1 USDC (6 dec) → 1 USDT (18 dec)
    const amountIn = parseUnits("1", 6);
    const amountOut = parseUnits("1", 18);
    mockReadContract.mockResolvedValue([amountIn, amountOut]);

    const usdcWith6 = { ...USDC, decimals: 6 };
    const usdtWith18 = { ...USDT, decimals: 18 };
    const result = await computePancakeQuote(makeParams(usdcWith6, usdtWith18, "1", 50));

    expect(result).not.toBeNull();
    expect(result!.amountOutFormatted).toBe("1");
    // rate = (1e18 / 1e6) * 10^(6-18) = 1e12 * 1e-12 = 1.0
    expect(parseFloat(result!.rate)).toBeCloseTo(1.0, 4);
  });

  it("minReceived respects slippageBps correctly", async () => {
    const amountIn = parseUnits("1", 18);
    const amountOut = parseUnits("100", 18);
    mockReadContract.mockResolvedValue([amountIn, amountOut]);

    // 100 bps = 1% slippage → minReceived = 99% of amountOut
    const result = await computePancakeQuote(makeParams(BNB, USDT, "1", 100));
    expect(result).not.toBeNull();
    const expectedMin = (amountOut * 9900n) / 10000n;
    expect(result!.minReceived).toBe(expectedMin);
  });
});

// ── createPancakeSwap tests ───────────────────────────────────────

describe("createPancakeSwap", () => {
  beforeEach(() => {
    mockReadContract.mockReset();
    mockWriteContract.mockReset();
  });

  const makeParams = (from: TokenMeta, to: TokenMeta): PancakeSwapParams => ({
    fromToken: from,
    toToken: to,
    amount: "1",
    slippageBps: 50,
    recipient: RECIPIENT,
    owner: USER,
  });

  const sampleQuote = {
    path: [WBNB, USDT_ADDR] as readonly `0x${string}`[],
    amountIn: parseUnits("1", 18),
    amountOut: parseUnits("650", 18),
    amountOutFormatted: "650.0",
    rate: "650.000000",
    priceImpact: "0.250",
    minReceived: parseUnits("646.75", 18),
    minReceivedFormatted: "646.75",
  };

  // needsApproval
  it("needsApproval returns false for native token (BNB)", async () => {
    const adapter = createPancakeSwap(makeParams(BNB, USDT));
    const result = await adapter.needsApproval();
    expect(result).toBe(false);
    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it("needsApproval returns true when allowance < amountIn", async () => {
    mockReadContract.mockResolvedValue(parseUnits("0.5", 18)); // allowance < 1 BNB
    const adapter = createPancakeSwap(makeParams(USDT, BNB));
    const result = await adapter.needsApproval();
    expect(result).toBe(true);
  });

  it("needsApproval returns false when allowance >= amountIn", async () => {
    mockReadContract.mockResolvedValue(parseUnits("100", 18)); // allowance > 1
    const adapter = createPancakeSwap(makeParams(USDT, BNB));
    const result = await adapter.needsApproval();
    expect(result).toBe(false);
  });

  // execute routing
  it("execute calls swapExactETHForTokens for native-in (BNB → USDT)", async () => {
    mockWriteContract.mockResolvedValue("0xtxhash");
    const adapter = createPancakeSwap(makeParams(BNB, USDT));
    await adapter.execute(sampleQuote);

    expect(mockWriteContract).toHaveBeenCalledTimes(1);
    const call = mockWriteContract.mock.calls[0][1];
    expect(call.functionName).toBe("swapExactETHForTokens");
    expect(call.value).toBe(sampleQuote.amountIn);
  });

  it("execute calls swapExactTokensForETH for native-out (USDT → BNB)", async () => {
    mockWriteContract.mockResolvedValue("0xtxhash");
    const bnbOutQuote = { ...sampleQuote, path: [USDT_ADDR, WBNB] as readonly `0x${string}`[] };
    const adapter = createPancakeSwap(makeParams(USDT, BNB));
    await adapter.execute(bnbOutQuote);

    expect(mockWriteContract).toHaveBeenCalledTimes(1);
    const call = mockWriteContract.mock.calls[0][1];
    expect(call.functionName).toBe("swapExactTokensForETH");
  });

  it("execute calls swapExactTokensForTokens for ERC20↔ERC20 (USDT → ODD)", async () => {
    mockWriteContract.mockResolvedValue("0xtxhash");
    const erc20Quote = { ...sampleQuote, path: [USDT_ADDR, ODD_ADDR] as readonly `0x${string}`[] };
    const adapter = createPancakeSwap(makeParams(USDT, ODD));
    await adapter.execute(erc20Quote);

    expect(mockWriteContract).toHaveBeenCalledTimes(1);
    const call = mockWriteContract.mock.calls[0][1];
    expect(call.functionName).toBe("swapExactTokensForTokens");
  });

  it("execute passes recipient correctly", async () => {
    mockWriteContract.mockResolvedValue("0xtxhash");
    const adapter = createPancakeSwap(makeParams(BNB, USDT));
    await adapter.execute(sampleQuote);

    const call = mockWriteContract.mock.calls[0][1];
    // args[2] for swapExactETHForTokens is `to`
    expect(call.args[2]).toBe(RECIPIENT);
  });
});

// ── Testnet token fixtures ────────────────────────────────────────
const USDT_TESTNET_ADDR = "0xa8A74A6b4198F4C3650C8e6Fc2d2498a9B61377c";
const ODD_TESTNET_ADDR = "0x20c6aD67776725515F1b68b06865c865F62833FF";
const WBNB_TESTNET = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";

const USDT_TESTNET: TokenMeta = {
  symbol: "USDT",
  name: "Test USDT",
  address: USDT_TESTNET_ADDR,
  decimals: 18,
  iconUrl: "",
  tier: 3,
  chainId: 97,
};
const ODD_TESTNET: TokenMeta = {
  symbol: "ODD",
  name: "Odd Token",
  address: ODD_TESTNET_ADDR,
  decimals: 18,
  iconUrl: "",
  tier: 5,
  chainId: 97,
};

/**
 * DD-094: testnet 开放 swap。
 * 修复后 pancake-adapter 直接从 fromToken.chainId 取链 ID，不再依赖 CORE_CHAIN。
 * 测试使用 chainId=97 的 testnet token fixtures 验证路由正确。
 */
describe("pancake-adapter DD-094 testnet routing", () => {
  beforeEach(() => {
    mockReadContract.mockReset();
    mockWriteContract.mockReset();
  });

  const makeParams = (from: TokenMeta, to: TokenMeta): PancakeSwapParams => ({
    fromToken: from,
    toToken: to,
    amount: "1",
    slippageBps: 50,
    recipient: RECIPIENT,
    owner: USER,
  });

  it("computePancakeQuote(testnet) → calls readContract with chainId=97（testnet router）", async () => {
    mockReadContract.mockResolvedValue([parseUnits("1", 18), parseUnits("200", 18)]);
    const result = await computePancakeQuote(makeParams(USDT_TESTNET, ODD_TESTNET));
    expect(result).not.toBeNull();
    const call = mockReadContract.mock.calls[0][1];
    expect(call.chainId).toBe(97);
    // testnet 只有 USDT/ODD 直接池，路径不经过 WBNB
    expect(call.args[1]).toEqual([USDT_TESTNET_ADDR, ODD_TESTNET_ADDR]);
  });

  it("createPancakeSwap.execute(testnet ERC20→ERC20) → calls writeContract with chainId=97", async () => {
    mockWriteContract.mockResolvedValue("0xtxhash");
    const adapter = createPancakeSwap(makeParams(USDT_TESTNET, ODD_TESTNET));
    await adapter.execute({
      path: [USDT_TESTNET_ADDR, WBNB_TESTNET, ODD_TESTNET_ADDR] as readonly `0x${string}`[],
      amountIn: parseUnits("1", 18),
      amountOut: parseUnits("200", 18),
      amountOutFormatted: "200",
      rate: "200.000000",
      priceImpact: "0.250",
      minReceived: parseUnits("199", 18),
      minReceivedFormatted: "199",
    });
    const call = mockWriteContract.mock.calls[0][1];
    expect(call.chainId).toBe(97);
    expect(call.functionName).toBe("swapExactTokensForTokens");
  });

  it("createPancakeSwap.approve(testnet ERC-20) → calls writeContract with chainId=97", async () => {
    mockWriteContract.mockResolvedValue("0xtxhash");
    const adapter = createPancakeSwap(makeParams(USDT_TESTNET, ODD_TESTNET));
    await adapter.approve();
    const call = mockWriteContract.mock.calls[0][1];
    expect(call.chainId).toBe(97);
    expect(call.functionName).toBe("approve");
  });
});
