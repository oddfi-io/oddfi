// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  detectMobileWalletEnv,
  getWalletOpenLink,
  getWcDeepLink,
  getWalletAppLink,
} from "./mobile-wallet-detect";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function setUserAgent(ua: string) {
  vi.stubGlobal("navigator", { ...navigator, userAgent: ua });
}

// ─── detectMobileWalletEnv ────────────────────────────────────────────────────

describe("detectMobileWalletEnv", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns desktop when not mobile", () => {
    setUserAgent(DESKTOP_UA);
    expect(detectMobileWalletEnv()).toEqual({ type: "desktop" });
  });

  it("returns external-browser on iOS Safari with no injected provider", () => {
    setUserAgent(MOBILE_UA);
    vi.stubGlobal("ethereum", undefined);
    expect(detectMobileWalletEnv()).toEqual({ type: "external-browser" });
  });

  it("returns external-browser on Android Chrome with no injected provider", () => {
    setUserAgent(ANDROID_UA);
    vi.stubGlobal("ethereum", undefined);
    expect(detectMobileWalletEnv()).toEqual({ type: "external-browser" });
  });

  it("detects MetaMask dApp browser via window.ethereum.isMetaMask", () => {
    setUserAgent(MOBILE_UA);
    vi.stubGlobal("ethereum", { isMetaMask: true });
    expect(detectMobileWalletEnv()).toEqual({ type: "dapp-browser", wallet: "metamask" });
  });

  it("detects OKX dApp browser via window.okxwallet", () => {
    setUserAgent(MOBILE_UA);
    vi.stubGlobal("okxwallet", {});
    expect(detectMobileWalletEnv()).toEqual({ type: "dapp-browser", wallet: "okx" });
  });

  it("detects OKX dApp browser via window.ethereum.isOkxWallet", () => {
    setUserAgent(MOBILE_UA);
    vi.stubGlobal("ethereum", { isOkxWallet: true });
    expect(detectMobileWalletEnv()).toEqual({ type: "dapp-browser", wallet: "okx" });
  });

  it("detects Coinbase dApp browser via window.ethereum.isCoinbaseWallet", () => {
    setUserAgent(MOBILE_UA);
    vi.stubGlobal("ethereum", { isCoinbaseWallet: true });
    expect(detectMobileWalletEnv()).toEqual({ type: "dapp-browser", wallet: "coinbase" });
  });

  it("detects Binance dApp browser via window.BinanceChain (desktop extension)", () => {
    setUserAgent(MOBILE_UA);
    vi.stubGlobal("BinanceChain", {});
    expect(detectMobileWalletEnv()).toEqual({ type: "dapp-browser", wallet: "binance" });
  });

  it("detects Binance App DApp browser via ethereum.isBinance (no BinanceChain)", () => {
    setUserAgent(MOBILE_UA);
    // Binance App DApp browser: injects ethereum.isBinance=true but NOT window.BinanceChain
    // Also sets isMetaMask=true for compatibility — Binance must be detected first
    vi.stubGlobal("ethereum", { isBinance: true, isMetaMask: true });
    expect(detectMobileWalletEnv()).toEqual({ type: "dapp-browser", wallet: "binance" });
  });

  it("detects Binance App DApp browser with both BinanceChain and isBinance", () => {
    setUserAgent(MOBILE_UA);
    vi.stubGlobal("BinanceChain", {});
    vi.stubGlobal("ethereum", { isBinance: true, isMetaMask: true });
    expect(detectMobileWalletEnv()).toEqual({ type: "dapp-browser", wallet: "binance" });
  });

  it("OKX takes priority over MetaMask when both flags exist (OKX DApp browser sets isMetaMask=true for compat)", () => {
    setUserAgent(MOBILE_UA);
    vi.stubGlobal("ethereum", { isMetaMask: true, isOkxWallet: true });
    vi.stubGlobal("okxwallet", {});
    expect(detectMobileWalletEnv()).toEqual({ type: "dapp-browser", wallet: "okx" });
  });

  it("detects OKX via isOKExWallet (alternate flag name)", () => {
    setUserAgent(MOBILE_UA);
    vi.stubGlobal("ethereum", { isMetaMask: true, isOKExWallet: true });
    expect(detectMobileWalletEnv()).toEqual({ type: "dapp-browser", wallet: "okx" });
  });

  it("MetaMask detected correctly when only isMetaMask is set (no OKX/Coinbase/Binance flags)", () => {
    setUserAgent(MOBILE_UA);
    vi.stubGlobal("ethereum", { isMetaMask: true });
    expect(detectMobileWalletEnv()).toEqual({ type: "dapp-browser", wallet: "metamask" });
  });

  it("OKX takes priority over Coinbase when both globals exist", () => {
    setUserAgent(MOBILE_UA);
    vi.stubGlobal("ethereum", { isOkxWallet: true, isCoinbaseWallet: true });
    expect(detectMobileWalletEnv()).toEqual({ type: "dapp-browser", wallet: "okx" });
  });

  it("desktop detection ignores injected providers", () => {
    setUserAgent(DESKTOP_UA);
    vi.stubGlobal("ethereum", { isMetaMask: true });
    expect(detectMobileWalletEnv()).toEqual({ type: "desktop" });
  });
});

// ─── getWalletOpenLink ────────────────────────────────────────────────────────

describe("getWalletOpenLink", () => {
  const URL = "https://oddfi.io/markets";

  it("generates correct MetaMask universal link (strips https://)", () => {
    expect(getWalletOpenLink("metamask", URL)).toBe(
      "https://metamask.app.link/dapp/oddfi.io/markets"
    );
  });

  it("generates MetaMask link for root path", () => {
    expect(getWalletOpenLink("metamask", "https://oddfi.io/")).toBe(
      "https://metamask.app.link/dapp/oddfi.io/"
    );
  });

  it("generates correct OKX universal link (single-encoded dappUrl)", () => {
    const link = getWalletOpenLink("okx", URL);
    // The outer deeplink param encodes the okx:// inner link
    const expectedInner = encodeURIComponent(`okx://wallet/dapp/details?dappUrl=${URL}`);
    expect(link).toBe(`https://www.okx.com/download?deeplink=${expectedInner}`);
  });

  it("generates correct Coinbase link", () => {
    expect(getWalletOpenLink("coinbase", URL)).toBe(
      `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(URL)}`
    );
  });

  it("generates correct Binance link", () => {
    expect(getWalletOpenLink("binance", URL)).toBe(
      `https://app.binance.com/cedefi/dapp/browser?url=${encodeURIComponent(URL)}`
    );
  });

  it("returns null for walletconnect (no redirect applicable)", () => {
    expect(getWalletOpenLink("walletconnect", URL)).toBeNull();
  });

  it("preserves query params in URL encoding", () => {
    const urlWithQuery = "https://oddfi.io/markets?tab=live";
    const link = getWalletOpenLink("metamask", urlWithQuery);
    expect(link).toBe("https://metamask.app.link/dapp/oddfi.io/markets?tab=live");
  });
});

// ─── getWcDeepLink ────────────────────────────────────────────────────────────

describe("getWcDeepLink", () => {
  const WC_URI = "wc:abc123@2?relay-protocol=irn&symKey=xyz";

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns okex:// custom scheme on iOS for OKX", () => {
    setUserAgent(MOBILE_UA); // iOS UA
    const result = getWcDeepLink("okx", WC_URI);
    expect(result).toBe(`okex://main/wc?uri=${encodeURIComponent(WC_URI)}`);
  });

  it("returns raw WC URI on Android for OKX (Android intent system handles it)", () => {
    setUserAgent(ANDROID_UA);
    expect(getWcDeepLink("okx", WC_URI)).toBe(WC_URI);
  });

  it("returns bnc:// custom scheme on iOS for Binance", () => {
    setUserAgent(MOBILE_UA);
    expect(getWcDeepLink("binance", WC_URI)).toBe(
      `bnc://app.binance.com/cedefi/wc?uri=${encodeURIComponent(WC_URI)}`
    );
  });

  it("returns raw WC URI on Android for Binance", () => {
    setUserAgent(ANDROID_UA);
    expect(getWcDeepLink("binance", WC_URI)).toBe(WC_URI);
  });

  it("returns MetaMask universal link (iOS + Android both)", () => {
    setUserAgent(MOBILE_UA);
    expect(getWcDeepLink("metamask", WC_URI)).toBe(
      `https://metamask.app.link/wc?uri=${encodeURIComponent(WC_URI)}`
    );
  });

  it("MetaMask universal link works on Android too", () => {
    setUserAgent(ANDROID_UA);
    expect(getWcDeepLink("metamask", WC_URI)).toBe(
      `https://metamask.app.link/wc?uri=${encodeURIComponent(WC_URI)}`
    );
  });

  it("returns coinbase deep link with cbwallet:// scheme", () => {
    setUserAgent(MOBILE_UA);
    expect(getWcDeepLink("coinbase", WC_URI)).toBe(
      `cbwallet://wc?uri=${encodeURIComponent(WC_URI)}`
    );
  });

  it("returns null for walletconnect (handled by Reown modal)", () => {
    setUserAgent(MOBILE_UA);
    expect(getWcDeepLink("walletconnect", WC_URI)).toBeNull();
  });
});

// ─── getWalletAppLink ─────────────────────────────────────────────────────────

describe("getWalletAppLink", () => {
  it("returns OKX WC screen link", () => {
    expect(getWalletAppLink("okx")).toBe("okex://main/wc");
  });

  it("returns Binance WC screen link", () => {
    expect(getWalletAppLink("binance")).toBe("bnc://app.binance.com/cedefi/wc");
  });

  it("returns MetaMask app link", () => {
    expect(getWalletAppLink("metamask")).toBe("metamask://");
  });

  it("returns Coinbase app link", () => {
    expect(getWalletAppLink("coinbase")).toBe("cbwallet://");
  });

  it("returns null for unknown wallet", () => {
    expect(getWalletAppLink("unknownwallet")).toBeNull();
  });

  it("returns null for walletconnect", () => {
    expect(getWalletAppLink("walletconnect")).toBeNull();
  });
});
