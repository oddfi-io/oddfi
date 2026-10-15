// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { findConnector, isWalletComingSoon, truncateAddress, WALLETS } from "./walletConfig";
import type { Connector } from "wagmi";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConnector(overrides: {
  id: string;
  name: string;
  type?: string;
  rkDetails?: { id?: string };
}): Connector {
  return overrides as unknown as Connector;
}

// ─── findConnector ────────────────────────────────────────────────────────────

describe("findConnector", () => {
  describe("rkDetails.id exact match (RainbowKit connector path)", () => {
    it("finds OKX when rkDetails.id='okx' even though connector.id='walletConnect'", () => {
      // This is the core bug fix: OKX on H5 falls back to WalletConnect-backed connector.
      // The wagmi connector gets id="walletConnect" but rkDetails.id="okx" is preserved.
      const connectors = [
        makeConnector({ id: "walletConnect", name: "WalletConnect", rkDetails: { id: "okx" } }),
        makeConnector({ id: "walletConnect", name: "WalletConnect", rkDetails: { id: "binance" } }),
        makeConnector({ id: "metaMaskSDK", name: "MetaMask", rkDetails: { id: "metaMask" } }),
      ];
      const result = findConnector("okx", connectors);
      expect((result as unknown as { rkDetails?: { id?: string } })?.rkDetails?.id).toBe("okx");
    });

    it("finds Binance when rkDetails.id='binance' even though connector.id='walletConnect'", () => {
      const connectors = [
        makeConnector({ id: "walletConnect", name: "WalletConnect", rkDetails: { id: "okx" } }),
        makeConnector({ id: "walletConnect", name: "WalletConnect", rkDetails: { id: "binance" } }),
      ];
      const result = findConnector("binance", connectors);
      expect((result as unknown as { rkDetails?: { id?: string } })?.rkDetails?.id).toBe("binance");
    });

    it("finds MetaMask by rkDetails.id='metaMask' (case-insensitive)", () => {
      const connectors = [
        makeConnector({ id: "metaMaskSDK", name: "MetaMask", rkDetails: { id: "metaMask" } }),
      ];
      const result = findConnector("metamask", connectors);
      expect(result?.id).toBe("metaMaskSDK");
    });

    it("finds walletConnect connector by rkDetails.id='walletConnect'", () => {
      const connectors = [
        makeConnector({
          id: "walletConnect",
          name: "WalletConnect",
          rkDetails: { id: "walletConnect" },
        }),
      ];
      const result = findConnector("walletconnect", connectors);
      expect(result?.id).toBe("walletConnect");
    });

    it("prefers rkDetails match over fuzzy name match", () => {
      // If both OKX-by-rkDetails and a hypothetical "okx"-named connector exist,
      // rkDetails match wins (first in order).
      const okxViaWc = makeConnector({
        id: "walletConnect",
        name: "WalletConnect",
        rkDetails: { id: "okx" },
      });
      const okxInjected = makeConnector({ id: "okx", name: "OKX Wallet" });
      const result = findConnector("okx", [okxViaWc, okxInjected]);
      expect(result).toBe(okxViaWc);
    });
  });

  describe("EIP-6963 preference over RK injected (window.ethereum contention fix)", () => {
    it("prefers EIP-6963 Binance connector over RK injected when both exist on PC", () => {
      // Scenario: PC with MetaMask + Binance extensions.
      // RK creates injected connector for Binance, but its getProvider() may
      // resolve to MetaMask's window.ethereum (provider contention).
      // EIP-6963 connector uses the provider announced by Binance extension directly.
      const rkBinance = makeConnector({
        id: "injected",
        name: "Binance Wallet",
        type: "injected",
        rkDetails: { id: "binance" },
      });
      const eip6963Binance = makeConnector({
        id: "com.binance.wallet",
        name: "Binance Wallet",
        type: "injected",
      });
      const rkMetamask = makeConnector({
        id: "injected",
        name: "MetaMask",
        type: "injected",
        rkDetails: { id: "metaMask" },
      });
      const result = findConnector("binance", [rkBinance, eip6963Binance, rkMetamask]);
      // Must return EIP-6963 connector, not the RK one
      expect(result).toBe(eip6963Binance);
    });

    it("falls back to RK injected when no EIP-6963 match exists", () => {
      // Some wallets may not support EIP-6963 yet
      const rkBinance = makeConnector({
        id: "injected",
        name: "Binance Wallet",
        type: "injected",
        rkDetails: { id: "binance" },
      });
      const result = findConnector("binance", [rkBinance]);
      expect(result).toBe(rkBinance);
    });

    it("EIP-6963 preference also works for WC-backed RK connectors", () => {
      // Existing behavior: when RK connector is WC-backed, prefer EIP-6963
      const rkBinanceWc = makeConnector({
        id: "walletConnect",
        name: "WalletConnect",
        type: "walletConnect",
        rkDetails: { id: "binance" },
      });
      const eip6963Binance = makeConnector({
        id: "com.binance.wallet",
        name: "Binance Wallet",
        type: "injected",
      });
      const result = findConnector("binance", [rkBinanceWc, eip6963Binance]);
      expect(result).toBe(eip6963Binance);
    });
  });

  describe("fuzzy match fallback (non-RainbowKit connectors)", () => {
    it("finds MetaMask SDK injected connector by id fuzzy match", () => {
      const connectors = [makeConnector({ id: "metaMaskSDK", name: "MetaMask SDK" })];
      // "metaMaskSDK".toLowerCase() = "metamasksdk", "metamasksdk".includes("metamask") = true
      const result = findConnector("metamask", connectors);
      expect(result?.id).toBe("metaMaskSDK");
    });

    it("finds OKX injected connector by id='okx' fuzzy match when no rkDetails", () => {
      const connectors = [makeConnector({ id: "okx", name: "OKX Wallet" })];
      const result = findConnector("okx", connectors);
      expect(result?.id).toBe("okx");
    });

    it("returns undefined when no connector matches", () => {
      const connectors = [makeConnector({ id: "metaMaskSDK", name: "MetaMask" })];
      expect(findConnector("binance", connectors)).toBeUndefined();
    });

    it("returns undefined for empty connectors array", () => {
      expect(findConnector("okx", [])).toBeUndefined();
    });
  });
});

// ─── WALLETS icon config ─────────────────────────────────────────────────────

describe("WALLETS", () => {
  it("all icons use .svg format", () => {
    for (const wallet of WALLETS) {
      expect(wallet.icon).toMatch(/\.svg$/);
    }
  });

  it("contains expected wallet IDs", () => {
    const ids = WALLETS.map((w) => w.id);
    expect(ids).toEqual(["telegram", "metamask", "coinbase", "okx", "binance", "walletconnect"]);
  });

  it("does not have iconBg property", () => {
    for (const wallet of WALLETS) {
      expect(wallet).not.toHaveProperty("iconBg");
    }
  });
});

// ─── isWalletComingSoon ───────────────────────────────────────────────────────

describe("isWalletComingSoon", () => {
  it("returns true for telegram (UI 占位、功能未接入)", () => {
    expect(isWalletComingSoon("telegram")).toBe(true);
  });

  it("returns false for fully wired wallets", () => {
    for (const id of ["metamask", "coinbase", "okx", "binance", "walletconnect"]) {
      expect(isWalletComingSoon(id)).toBe(false);
    }
  });
});

// ─── truncateAddress ──────────────────────────────────────────────────────────

describe("truncateAddress", () => {
  it("truncates long address to 5+...+5 format", () => {
    expect(truncateAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x123...45678");
  });

  it("returns short address unchanged (<=13 chars)", () => {
    expect(truncateAddress("0x1234567")).toBe("0x1234567");
    expect(truncateAddress("0x12345678901")).toBe("0x12345678901");
  });
});
