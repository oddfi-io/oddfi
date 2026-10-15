// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTokenPickerSource } from "./useTokenPickerSource";
import type { PortfolioToken } from "./useMultiChainPortfolio";
import { BSC_TOKENS, BASE_TOKENS } from "@/lib/token-registry";
import { POPULAR_TOKEN_IDS, resolvePopularTokens } from "@/lib/swap/picker-popular";
import { PLATFORM_TOKEN } from "@/lib/platform-token";

const PLATFORM_ID = `${PLATFORM_TOKEN.chainId}:${PLATFORM_TOKEN.symbol}`;

// ── Mocks ────────────────────────────────────────────────────
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const mockPortfolio = vi.fn<() => { portfolio: PortfolioToken[]; isLoading: boolean }>();
vi.mock("@/hooks/useMultiChainPortfolio", () => ({
  useMultiChainPortfolio: () => mockPortfolio(),
}));

const mockWallet = vi.fn<() => { address?: `0x${string}` }>();
vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => mockWallet(),
}));

// ── Fixtures ─────────────────────────────────────────────────
const BSC_USDT = BSC_TOKENS.find((t) => t.symbol === "USDT")!;
const BASE_USDC = BASE_TOKENS.find((t) => t.symbol === "USDC")!;

const OWNED_BSC_USDT: PortfolioToken = {
  meta: BSC_USDT,
  chainId: 56,
  chainIcon: "/images/chains/bsc.svg",
  balance: "1240",
  usdValue: "1240",
  hasPriceData: true,
};

const OWNED_BASE_USDC: PortfolioToken = {
  meta: BASE_USDC,
  chainId: 8453,
  chainIcon: "/images/chains/base.svg",
  balance: "300.15",
  usdValue: "300.15",
  hasPriceData: true,
};

const OWNED_NO_PRICE: PortfolioToken = {
  meta: { ...BSC_USDT, symbol: "NODATA", name: "No Price Token" },
  chainId: 56,
  chainIcon: "/images/chains/bsc.svg",
  balance: "10",
  usdValue: "0",
  hasPriceData: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useTokenPickerSource", () => {
  describe("登录态门控（平台币始终置顶）", () => {
    it("未连钱包 → [PlatformTop, Popular]，Popular 去重 TODD", () => {
      mockWallet.mockReturnValue({ address: undefined });
      mockPortfolio.mockReturnValue({ portfolio: [], isLoading: false });

      const { result } = renderHook(() => useTokenPickerSource());
      const [platform, popular] = result.current.sections;

      expect(result.current.sections).toHaveLength(2);
      expect(platform.label).toBeUndefined();
      expect(platform.variant).toBe("owned");
      expect(platform.items).toHaveLength(1);
      expect(platform.items[0].id).toBe(PLATFORM_ID);

      expect(popular.label).toBe("popular");
      expect(popular.items.map((i) => i.id)).not.toContain(PLATFORM_ID);
    });

    it("连钱包 + 有资产（无 TODD）→ [PlatformTop, Owned, Popular]", () => {
      mockWallet.mockReturnValue({ address: "0xabc" });
      mockPortfolio.mockReturnValue({
        portfolio: [OWNED_BSC_USDT, OWNED_BASE_USDC],
        isLoading: false,
      });

      const { result } = renderHook(() => useTokenPickerSource());
      const [platform, owned, popular] = result.current.sections;

      expect(result.current.sections).toHaveLength(3);
      expect(platform.items[0].id).toBe(PLATFORM_ID);

      expect(owned.label).toBe("ownedAssets");
      expect(owned.items.map((i) => i.id)).toEqual(["56:USDT", "8453:USDC"]);

      expect(popular.label).toBe("popular");
      // 56:USDT 已在 Owned，Popular 应去重
      expect(popular.items.map((i) => i.id)).not.toContain("56:USDT");
      expect(popular.items.map((i) => i.id)).not.toContain(PLATFORM_ID);
    });

    it("连钱包 + 零资产 → [PlatformTop, Popular]（无空 Owned 壳）", () => {
      mockWallet.mockReturnValue({ address: "0xabc" });
      mockPortfolio.mockReturnValue({ portfolio: [], isLoading: false });

      const { result } = renderHook(() => useTokenPickerSource());
      expect(result.current.sections).toHaveLength(2);
      expect(result.current.sections[0].items[0].id).toBe(PLATFORM_ID);
      expect(result.current.sections[1].label).toBe("popular");
    });
  });

  describe("平台币置顶行为", () => {
    it("未持有 TODD → 合成条目 balance='0' / usdValue='$—' / hasPriceData=false", () => {
      mockWallet.mockReturnValue({ address: undefined });
      mockPortfolio.mockReturnValue({ portfolio: [], isLoading: false });

      const { result } = renderHook(() => useTokenPickerSource());
      const platform = result.current.sections[0].items[0];
      expect(platform.balance).toBe("0");
      expect(platform.usdValue).toBe("$—");
      expect(platform.hasPriceData).toBe(false);
    });

    it("持有 TODD → 真实 balance + usdValue；Owned 分组去重（不重复渲染）", () => {
      const OWNED_TODD: PortfolioToken = {
        meta: PLATFORM_TOKEN,
        chainId: PLATFORM_TOKEN.chainId,
        chainIcon: "/images/chains/bsc.svg",
        balance: "500",
        usdValue: "500",
        hasPriceData: true,
      };
      mockWallet.mockReturnValue({ address: "0xabc" });
      mockPortfolio.mockReturnValue({
        portfolio: [OWNED_TODD, OWNED_BSC_USDT],
        isLoading: false,
      });

      const { result } = renderHook(() => useTokenPickerSource());
      const [platform, owned] = result.current.sections;

      expect(platform.items[0].id).toBe(PLATFORM_ID);
      expect(platform.items[0].balance).toBe("500");
      expect(platform.items[0].usdValue).toBe("$500.00");

      // Owned 分组应去重，不再包含 TODD
      expect(owned.items.map((i) => i.id)).not.toContain(PLATFORM_ID);
      expect(owned.items.map((i) => i.id)).toEqual(["56:USDT"]);
    });
  });

  describe("chainTabs", () => {
    it("固定顺序 [All, Ethereum, BSC, Base, Arbitrum, Polygon]", () => {
      mockWallet.mockReturnValue({ address: undefined });
      mockPortfolio.mockReturnValue({ portfolio: [], isLoading: false });

      const { result } = renderHook(() => useTokenPickerSource());
      expect(result.current.chainTabs.map((t) => t.chainId)).toEqual([
        "all",
        1,
        56,
        8453,
        42161,
        137,
      ]);
    });

    it("BSC 标签显示为 'BSC' 而非 'BNB Chain'", () => {
      mockWallet.mockReturnValue({ address: undefined });
      mockPortfolio.mockReturnValue({ portfolio: [], isLoading: false });

      const { result } = renderHook(() => useTokenPickerSource());
      const bsc = result.current.chainTabs.find((t) => t.chainId === 56);
      expect(bsc?.label).toBe("BSC");
    });

    it("登录态变化不影响 chainTabs 形状", () => {
      mockWallet.mockReturnValue({ address: "0xabc" });
      mockPortfolio.mockReturnValue({
        portfolio: [OWNED_BSC_USDT],
        isLoading: false,
      });
      const { result } = renderHook(() => useTokenPickerSource());
      expect(result.current.chainTabs).toHaveLength(6);
    });
  });

  describe("isLoading", () => {
    it("未连钱包 → isLoading=false（忽略 portfolio loading）", () => {
      mockWallet.mockReturnValue({ address: undefined });
      mockPortfolio.mockReturnValue({ portfolio: [], isLoading: true });

      const { result } = renderHook(() => useTokenPickerSource());
      expect(result.current.isLoading).toBe(false);
    });

    it("连钱包 + portfolio loading → isLoading=true", () => {
      mockWallet.mockReturnValue({ address: "0xabc" });
      mockPortfolio.mockReturnValue({ portfolio: [], isLoading: true });

      const { result } = renderHook(() => useTokenPickerSource());
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("PickerItem 归一化", () => {
    it("owned item 携带 decimals + address（handlePickerSelect 回组 TokenMeta 所需）", () => {
      mockWallet.mockReturnValue({ address: "0xabc" });
      mockPortfolio.mockReturnValue({
        portfolio: [OWNED_BSC_USDT],
        isLoading: false,
      });

      const { result } = renderHook(() => useTokenPickerSource());
      // sections[0] = PlatformTop, sections[1] = Owned
      const owned = result.current.sections[1].items[0];
      expect(owned.decimals).toBe(BSC_USDT.decimals);
      expect(owned.address).toBe(BSC_USDT.address);
    });

    it("hasPriceData=false → usdValue='$—'", () => {
      mockWallet.mockReturnValue({ address: "0xabc" });
      mockPortfolio.mockReturnValue({
        portfolio: [OWNED_NO_PRICE],
        isLoading: false,
      });

      const { result } = renderHook(() => useTokenPickerSource());
      expect(result.current.sections[1].items[0].usdValue).toBe("$—");
    });

    it("hasPriceData=true → usdValue='$<amount>'", () => {
      mockWallet.mockReturnValue({ address: "0xabc" });
      mockPortfolio.mockReturnValue({
        portfolio: [OWNED_BSC_USDT],
        isLoading: false,
      });

      const { result } = renderHook(() => useTokenPickerSource());
      expect(result.current.sections[1].items[0].usdValue).toBe("$1240.00");
    });

    it("owned item id = `${chainId}:${symbol}`", () => {
      mockWallet.mockReturnValue({ address: "0xabc" });
      mockPortfolio.mockReturnValue({
        portfolio: [OWNED_BSC_USDT, OWNED_BASE_USDC],
        isLoading: false,
      });

      const { result } = renderHook(() => useTokenPickerSource());
      expect(result.current.sections[1].items.map((i) => i.id)).toEqual(["56:USDT", "8453:USDC"]);
    });

    it("popular item 携带 decimals + address（源自 registry）", () => {
      mockWallet.mockReturnValue({ address: undefined });
      mockPortfolio.mockReturnValue({ portfolio: [], isLoading: false });

      const { result } = renderHook(() => useTokenPickerSource());
      // sections[0] = PlatformTop, sections[1] = Popular
      const first = result.current.sections[1].items[0];
      expect(typeof first.decimals).toBe("number");
      expect(typeof first.address).toBe("string");
    });
  });
});

describe("resolvePopularTokens", () => {
  it("按 POPULAR_TOKEN_IDS 顺序返回 BSC BNB/USDT/USDC", () => {
    const tokens = resolvePopularTokens();
    expect(tokens.map((t) => `${t.chainId}:${t.symbol}`)).toEqual(["56:BNB", "56:USDT", "56:USDC"]);
  });

  it("当前 registry 下每个 popular id 都能命中", () => {
    const tokens = resolvePopularTokens();
    expect(tokens.length).toBe(POPULAR_TOKEN_IDS.length);
  });
});

/**
 * DD-079: testnet 下 CHAIN_TAB_ORDER 只留 BSC Testnet，
 * 避免用户在 TokenPicker 切到 mainnet 链产生误操作。
 */
describe("useTokenPickerSource DD-079 testnet CHAIN_TAB_ORDER", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "testnet");
    mockPortfolio.mockReturnValue({ portfolio: [], isLoading: false });
    mockWallet.mockReturnValue({ address: undefined });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("testnet：chainTabs = [All, BSC Testnet(97)]，长度 2", async () => {
    const { useTokenPickerSource: hook } = await import("./useTokenPickerSource");
    const { result } = renderHook(() => hook());
    expect(result.current.chainTabs).toHaveLength(2);
    expect(result.current.chainTabs.map((t) => t.chainId)).toEqual(["all", 97]);
  });
});
