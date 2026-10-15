/**
 * Mobile wallet environment detection utilities.
 *
 * Detects whether the page is running inside a wallet's built-in dApp browser
 * (injected provider available) or in an external mobile browser (WalletConnect needed).
 *
 * Pure functions — no React dependencies, fully testable.
 */

/** Wallet IDs align with walletConfig.ts WALLETS[*].id */
export type DappBrowserWallet = "metamask" | "okx" | "coinbase" | "binance";

export type MobileWalletEnv =
  | { type: "dapp-browser"; wallet: DappBrowserWallet }
  | { type: "external-browser" }
  | { type: "desktop" };

/**
 * @deprecated Use `detectWalletEnv(connectors)` from `lib/wallet-env.ts` instead.
 * This function hand-checks window object flags which drift when wallets update
 * their injection mechanism. The new function reads RainbowKit's connector metadata
 * as a single source of truth.
 */
export function detectMobileWalletEnv(): MobileWalletEnv {
  if (typeof window === "undefined") return { type: "desktop" };

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) return { type: "desktop" };

  // Priority order: OKX > Coinbase > Binance > MetaMask (last resort)
  //
  // MetaMask's `isMetaMask` flag is a de-facto "public marker" — many wallets
  // (OKX, Trust Wallet, Rabby, etc.) set it to true for compatibility.
  // Checking MetaMask first leads to misidentification inside OKX/Coinbase/Binance
  // built-in browsers. Their own flags (okxwallet, isCoinbaseWallet, BinanceChain)
  // are unique and should be checked first. Same exclusion logic used by RainbowKit
  // (index.js:7192: if (ethereum.isOkxWallet || ethereum.isOKExWallet) return false).
  const eth = (window as unknown as Record<string, unknown>).ethereum as
    | Record<string, unknown>
    | undefined;

  // OKX injects both window.okxwallet and window.ethereum.isOkxWallet
  const okx = (window as unknown as Record<string, unknown>).okxwallet;
  if (okx || eth?.isOkxWallet || eth?.isOKExWallet) return { type: "dapp-browser", wallet: "okx" };

  if (eth?.isCoinbaseWallet) return { type: "dapp-browser", wallet: "coinbase" };

  // Binance Web3 Wallet: desktop extension injects window.BinanceChain,
  // App DApp browser injects ethereum.isBinance (but NOT window.BinanceChain)
  const binance = (window as unknown as Record<string, unknown>).BinanceChain;
  if (binance || eth?.isBinance) return { type: "dapp-browser", wallet: "binance" };

  // MetaMask last — only trust isMetaMask when other unique identifiers are absent
  if (eth?.isMetaMask) return { type: "dapp-browser", wallet: "metamask" };

  return { type: "external-browser" };
}

/**
 * Generate a universal link / deep link that opens the given URL inside the
 * specified wallet's built-in dApp browser.
 *
 * Returns null for wallets that don't have a dApp browser redirect (WalletConnect).
 * Universal links redirect to the App Store / Play Store when the wallet is not installed.
 */
export function getWalletOpenLink(
  walletId: DappBrowserWallet | "walletconnect",
  pageUrl: string
): string | null {
  // Strip protocol for MetaMask universal link — it expects bare "domain/path"
  const bareUrl = pageUrl.replace(/^https?:\/\//, "");
  const encodedUrl = encodeURIComponent(pageUrl);

  switch (walletId) {
    case "metamask":
      // https://metamask.app.link/dapp/{domain/path} — iOS + Android universal link
      return `https://metamask.app.link/dapp/${bareUrl}`;

    case "okx":
      // OKX universal link: encode the full inner deep link in one pass (no pre-encoding of pageUrl)
      return `https://www.okx.com/download?deeplink=${encodeURIComponent(
        `okx://wallet/dapp/details?dappUrl=${pageUrl}`
      )}`;

    case "coinbase":
      return `https://go.cb-w.com/dapp?cb_url=${encodedUrl}`;

    case "binance":
      return `https://app.binance.com/cedefi/dapp/browser?url=${encodedUrl}`;

    case "walletconnect":
      return null;
  }
}

/** Convenience: get the open-in-wallet link for the current page URL. */
export function getWalletOpenLinkForCurrentPage(
  walletId: DappBrowserWallet | "walletconnect"
): string | null {
  if (typeof window === "undefined") return null;
  return getWalletOpenLink(walletId, window.location.href);
}

/**
 * Wrap a raw WalletConnect pairing URI into a wallet-specific deep link
 * that opens the wallet App and presents the WC connection request.
 *
 * Deep link formats sourced from RainbowKit wallet connector source files:
 *   - OKX:     chunk-TSAUQMO4.js — `okex://main/wc?uri=...` on iOS, raw URI on Android
 *   - Binance: chunk-IFRJOIVF.js — `bnc://app.binance.com/cedefi/wc?uri=...` on iOS, raw URI on Android
 *   - MetaMask:chunk-XWY3TP2I.js — `https://metamask.app.link/wc?uri=...` (universal link, works on both)
 *
 * Returns null for wallets without a known deep link scheme (generic walletconnect).
 */
export function getWcDeepLink(walletId: string, wcUri: string): string | null {
  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
  const encodedUri = encodeURIComponent(wcUri);
  switch (walletId) {
    case "okx":
      // Android intent system handles raw wc: URI natively; iOS needs custom scheme
      return isAndroid ? wcUri : `okex://main/wc?uri=${encodedUri}`;
    case "binance":
      return isAndroid ? wcUri : `bnc://app.binance.com/cedefi/wc?uri=${encodedUri}`;
    case "metamask":
      // Universal link works on both iOS and Android
      return `https://metamask.app.link/wc?uri=${encodedUri}`;
    case "coinbase":
      return `cbwallet://wc?uri=${encodedUri}`;
    default:
      return null;
  }
}

/**
 * Get a simple deep link that opens the wallet App to its WalletConnect screen.
 * Used in the signing step to guide the user back to the wallet after a WC session
 * is already established (no URI needed — the pending signing request is already there).
 */
export function getWalletAppLink(walletId: string): string | null {
  switch (walletId) {
    case "okx":
      return "okex://main/wc";
    case "binance":
      return "bnc://app.binance.com/cedefi/wc";
    case "metamask":
      return "metamask://";
    case "coinbase":
      return "cbwallet://";
    default:
      return null;
  }
}
