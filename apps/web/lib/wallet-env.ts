/**
 * Wallet environment detection — single source of truth.
 *
 * Instead of hand-checking `window.ethereum.isXxx` flags (which drift when
 * wallets change their injection mechanism), this module queries RainbowKit's
 * connector metadata. RainbowKit already performs accurate per-wallet detection
 * via `hasInjectedProvider()` at boot time; the result is materialized in each
 * connector's `type` ("injected" vs "walletConnect") and `rkDetails.id`.
 *
 * Adding a new wallet:
 *   1. Register in `lib/connectors.ts` (RainbowKit provides detection logic)
 *   2. Add one entry to `RK_ID_TO_WALLET` + `RDNS_TO_WALLET` below
 *   3. Done — detection works automatically
 */

import type { Connector } from "wagmi";

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

/** Wallet IDs — aligned with walletConfig.ts WALLETS[*].id */
export type WalletId = "metamask" | "okx" | "coinbase" | "binance";

export type WalletEnv =
  | { type: "dapp-browser"; wallet: WalletId }
  | { type: "external-browser" }
  | { type: "desktop" };

/* ------------------------------------------------------------------ */
/*  Mapping tables                                                     */
/* ------------------------------------------------------------------ */

/**
 * RainbowKit `rkDetails.id` → our wallet ID.
 * Covers connectors created by `connectorsForWallets()`.
 */
const RK_ID_TO_WALLET: Record<string, WalletId> = {
  okx: "okx",
  coinbase: "coinbase",
  binance: "binance",
  metaMask: "metamask",
};

/**
 * EIP-6963 `rdns` → our wallet ID.
 * Covers auto-discovered connectors (e.g. Coinbase DApp browser which
 * doesn't use RainbowKit's `getInjectedConnector` path).
 */
const RDNS_TO_WALLET: Record<string, WalletId> = {
  "com.okex.wallet": "okx",
  "com.coinbase.wallet": "coinbase",
  "com.binance.wallet": "binance",
  "io.metamask": "metamask",
};

/**
 * Detection priority — MetaMask last because many wallets set
 * `isMetaMask = true` for compatibility.
 */
const PRIORITY: WalletId[] = ["okx", "coinbase", "binance", "metamask"];

/* ------------------------------------------------------------------ */
/*  Core detection                                                     */
/* ------------------------------------------------------------------ */

/**
 * Detect wallet environment by reading RainbowKit/wagmi connector metadata.
 *
 * On mobile, if any configured wallet has a non-WalletConnect connector
 * (i.e. RainbowKit detected its injected provider), we're inside that
 * wallet's DApp browser. This eliminates the need for manual `window`
 * object checks that go stale when wallets update their injection flags.
 *
 * @param connectors - `config.connectors` from wagmi's `useConfig()`
 */
export function detectWalletEnv(connectors: readonly Connector[]): WalletEnv {
  if (typeof window === "undefined") return { type: "desktop" };
  if (!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return { type: "desktop" };

  // Collect all wallet IDs that have a non-WalletConnect connector
  const injectedWallets = new Set<WalletId>();

  for (const c of connectors) {
    if (c.type !== "injected") continue; // whitelist: only true injected providers

    // Path 1: RainbowKit explicitly created injected connector
    const rkId = (c as unknown as { rkDetails?: { id?: string } }).rkDetails?.id;
    if (rkId && RK_ID_TO_WALLET[rkId]) {
      injectedWallets.add(RK_ID_TO_WALLET[rkId]);
    }

    // Path 2: EIP-6963 auto-discovered connector
    if (RDNS_TO_WALLET[c.id]) {
      injectedWallets.add(RDNS_TO_WALLET[c.id]);
    }
  }

  // Return the highest-priority injected wallet
  for (const wallet of PRIORITY) {
    if (injectedWallets.has(wallet)) {
      return { type: "dapp-browser", wallet };
    }
  }

  return { type: "external-browser" };
}
