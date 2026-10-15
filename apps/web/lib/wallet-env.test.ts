// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { detectWalletEnv } from "./wallet-env";

/* ------------------------------------------------------------------ */
/*  Helper: create a mock connector                                    */
/* ------------------------------------------------------------------ */

interface MockConnectorOpts {
  id?: string;
  name?: string;
  type?: string;
  rkDetailsId?: string;
}

function mockConnector(opts: MockConnectorOpts = {}) {
  return {
    id: opts.id ?? "unknown",
    name: opts.name ?? "Unknown",
    type: opts.type ?? "injected",
    ...(opts.rkDetailsId
      ? { rkDetails: { id: opts.rkDetailsId, name: opts.name ?? "Unknown" } }
      : {}),
    // Minimal Connector shape required by the function
    connect: vi.fn(),
    disconnect: vi.fn(),
    getAccounts: vi.fn(),
    getChainId: vi.fn(),
    getProvider: vi.fn(),
    isAuthorized: vi.fn(),
    onAccountsChanged: vi.fn(),
    onChainChanged: vi.fn(),
    onDisconnect: vi.fn(),
    setup: vi.fn(),
    emitter: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as never,
    uid: "test-uid",
  } as never;
}

/* ------------------------------------------------------------------ */
/*  UA mocking                                                         */
/* ------------------------------------------------------------------ */

const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile/15E148";
const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

let originalNavigator: PropertyDescriptor | undefined;

function setUA(ua: string) {
  Object.defineProperty(window, "navigator", {
    value: { userAgent: ua },
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  originalNavigator = Object.getOwnPropertyDescriptor(window, "navigator");
});

afterEach(() => {
  if (originalNavigator) {
    Object.defineProperty(window, "navigator", originalNavigator);
  }
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("detectWalletEnv", () => {
  describe("desktop environment", () => {
    it("returns desktop when UA is not mobile", () => {
      setUA(DESKTOP_UA);
      const result = detectWalletEnv([]);
      expect(result).toEqual({ type: "desktop" });
    });

    it("returns desktop even with injected connectors on desktop UA", () => {
      setUA(DESKTOP_UA);
      const connectors = [
        mockConnector({ rkDetailsId: "okx", type: "injected" }),
        mockConnector({ rkDetailsId: "metaMask", type: "injected" }),
      ];
      expect(detectWalletEnv(connectors)).toEqual({ type: "desktop" });
    });
  });

  describe("mobile external browser", () => {
    it("returns external-browser when no injected connectors on mobile", () => {
      setUA(MOBILE_UA);
      const connectors = [
        mockConnector({ rkDetailsId: "okx", type: "walletConnect" }),
        mockConnector({ rkDetailsId: "binance", type: "walletConnect" }),
        mockConnector({ rkDetailsId: "metaMask", type: "walletConnect" }),
      ];
      expect(detectWalletEnv(connectors)).toEqual({ type: "external-browser" });
    });

    it("returns external-browser when connector list is empty on mobile", () => {
      setUA(MOBILE_UA);
      expect(detectWalletEnv([])).toEqual({ type: "external-browser" });
    });
  });

  describe("dapp-browser detection via rkDetails.id", () => {
    it("detects OKX DApp browser", () => {
      setUA(MOBILE_UA);
      const connectors = [
        mockConnector({ rkDetailsId: "okx", type: "injected" }),
        mockConnector({ rkDetailsId: "metaMask", type: "walletConnect" }),
      ];
      expect(detectWalletEnv(connectors)).toEqual({ type: "dapp-browser", wallet: "okx" });
    });

    it("detects Binance DApp browser", () => {
      setUA(MOBILE_UA);
      const connectors = [
        mockConnector({ rkDetailsId: "okx", type: "walletConnect" }),
        mockConnector({ rkDetailsId: "binance", type: "injected" }),
        mockConnector({ rkDetailsId: "metaMask", type: "walletConnect" }),
      ];
      expect(detectWalletEnv(connectors)).toEqual({ type: "dapp-browser", wallet: "binance" });
    });

    it("detects MetaMask DApp browser", () => {
      setUA(MOBILE_UA);
      const connectors = [mockConnector({ rkDetailsId: "metaMask", type: "injected" })];
      expect(detectWalletEnv(connectors)).toEqual({ type: "dapp-browser", wallet: "metamask" });
    });

    it("detects Coinbase DApp browser via rkDetails", () => {
      setUA(MOBILE_UA);
      const connectors = [mockConnector({ rkDetailsId: "coinbase", type: "injected" })];
      expect(detectWalletEnv(connectors)).toEqual({ type: "dapp-browser", wallet: "coinbase" });
    });
  });

  describe("dapp-browser detection via EIP-6963 rdns", () => {
    it("detects Binance via EIP-6963 rdns when rkDetails is absent", () => {
      setUA(MOBILE_UA);
      const connectors = [mockConnector({ id: "com.binance.wallet", type: "injected" })];
      expect(detectWalletEnv(connectors)).toEqual({ type: "dapp-browser", wallet: "binance" });
    });

    it("detects OKX via EIP-6963 rdns", () => {
      setUA(MOBILE_UA);
      const connectors = [mockConnector({ id: "com.okex.wallet", type: "injected" })];
      expect(detectWalletEnv(connectors)).toEqual({ type: "dapp-browser", wallet: "okx" });
    });

    it("detects Coinbase via EIP-6963 rdns (Coinbase uses wagmi built-in connector)", () => {
      setUA(MOBILE_UA);
      const connectors = [mockConnector({ id: "com.coinbase.wallet", type: "injected" })];
      expect(detectWalletEnv(connectors)).toEqual({ type: "dapp-browser", wallet: "coinbase" });
    });

    it("detects MetaMask via EIP-6963 rdns", () => {
      setUA(MOBILE_UA);
      const connectors = [mockConnector({ id: "io.metamask", type: "injected" })];
      expect(detectWalletEnv(connectors)).toEqual({ type: "dapp-browser", wallet: "metamask" });
    });
  });

  describe("priority ordering", () => {
    it("OKX wins over MetaMask when both are injected", () => {
      setUA(MOBILE_UA);
      const connectors = [
        mockConnector({ rkDetailsId: "metaMask", type: "injected" }),
        mockConnector({ rkDetailsId: "okx", type: "injected" }),
      ];
      expect(detectWalletEnv(connectors)).toEqual({ type: "dapp-browser", wallet: "okx" });
    });

    it("Binance wins over MetaMask when both are injected", () => {
      setUA(MOBILE_UA);
      const connectors = [
        mockConnector({ rkDetailsId: "metaMask", type: "injected" }),
        mockConnector({ rkDetailsId: "binance", type: "injected" }),
      ];
      expect(detectWalletEnv(connectors)).toEqual({ type: "dapp-browser", wallet: "binance" });
    });

    it("Coinbase wins over Binance and MetaMask", () => {
      setUA(MOBILE_UA);
      const connectors = [
        mockConnector({ rkDetailsId: "metaMask", type: "injected" }),
        mockConnector({ rkDetailsId: "binance", type: "injected" }),
        mockConnector({ rkDetailsId: "coinbase", type: "injected" }),
      ];
      expect(detectWalletEnv(connectors)).toEqual({ type: "dapp-browser", wallet: "coinbase" });
    });

    it("OKX wins over all others", () => {
      setUA(MOBILE_UA);
      const connectors = [
        mockConnector({ rkDetailsId: "coinbase", type: "injected" }),
        mockConnector({ rkDetailsId: "binance", type: "injected" }),
        mockConnector({ rkDetailsId: "metaMask", type: "injected" }),
        mockConnector({ rkDetailsId: "okx", type: "injected" }),
      ];
      expect(detectWalletEnv(connectors)).toEqual({ type: "dapp-browser", wallet: "okx" });
    });
  });

  describe("mixed rkDetails + EIP-6963 connectors", () => {
    it("combines both detection paths", () => {
      setUA(MOBILE_UA);
      const connectors = [
        // RainbowKit connector for MetaMask (WC because not detected)
        mockConnector({ rkDetailsId: "metaMask", type: "walletConnect" }),
        // EIP-6963 auto-discovered Binance
        mockConnector({ id: "com.binance.wallet", type: "injected" }),
      ];
      expect(detectWalletEnv(connectors)).toEqual({ type: "dapp-browser", wallet: "binance" });
    });

    it("rkDetails and EIP-6963 for same wallet both contribute", () => {
      setUA(MOBILE_UA);
      const connectors = [
        mockConnector({ rkDetailsId: "okx", type: "injected" }),
        mockConnector({ id: "com.okex.wallet", type: "injected" }),
      ];
      // Should still return OKX (no duplication issue)
      expect(detectWalletEnv(connectors)).toEqual({ type: "dapp-browser", wallet: "okx" });
    });
  });

  describe("ignores walletConnect-type connectors", () => {
    it("WC connector with rkDetails.id is not treated as injected", () => {
      setUA(MOBILE_UA);
      const connectors = [mockConnector({ rkDetailsId: "binance", type: "walletConnect" })];
      expect(detectWalletEnv(connectors)).toEqual({ type: "external-browser" });
    });

    it("WC connector with matching rdns is not treated as injected", () => {
      setUA(MOBILE_UA);
      const connectors = [mockConnector({ id: "com.binance.wallet", type: "walletConnect" })];
      expect(detectWalletEnv(connectors)).toEqual({ type: "external-browser" });
    });
  });

  describe("ignores Coinbase SDK connector (B1+B2 regression)", () => {
    it("Coinbase SDK connector (type=coinbaseWallet) is not treated as injected on mobile H5", () => {
      setUA(MOBILE_UA);
      // Coinbase Wallet SDK always creates a connector with type="coinbaseWallet"
      // and installed=true, even in external browsers where no Coinbase DApp is present.
      // This must NOT be misidentified as an injected provider.
      const connectors = [
        mockConnector({ rkDetailsId: "coinbase", type: "coinbaseWallet" }),
        mockConnector({ rkDetailsId: "okx", type: "walletConnect" }),
        mockConnector({ rkDetailsId: "metaMask", type: "walletConnect" }),
      ];
      expect(detectWalletEnv(connectors)).toEqual({ type: "external-browser" });
    });

    it("Binance DApp browser + Coinbase SDK: detects binance, not coinbase (B2)", () => {
      setUA(MOBILE_UA);
      // In Binance DApp browser: Binance has an injected connector,
      // but Coinbase SDK also has its coinbaseWallet connector active.
      // Must detect binance (real injected), not coinbase (SDK artifact).
      const connectors = [
        mockConnector({ rkDetailsId: "binance", type: "injected" }),
        mockConnector({ rkDetailsId: "coinbase", type: "coinbaseWallet" }),
        mockConnector({ rkDetailsId: "metaMask", type: "walletConnect" }),
      ];
      expect(detectWalletEnv(connectors)).toEqual({ type: "dapp-browser", wallet: "binance" });
    });

    it("H5 external browser with only WC + Coinbase SDK connectors returns external-browser", () => {
      setUA(MOBILE_UA);
      // Pure H5 browser: all wallets are WC-backed except Coinbase SDK
      const connectors = [
        mockConnector({ rkDetailsId: "okx", type: "walletConnect" }),
        mockConnector({ rkDetailsId: "binance", type: "walletConnect" }),
        mockConnector({ rkDetailsId: "metaMask", type: "walletConnect" }),
        mockConnector({ rkDetailsId: "coinbase", type: "coinbaseWallet" }),
      ];
      expect(detectWalletEnv(connectors)).toEqual({ type: "external-browser" });
    });
  });
});
