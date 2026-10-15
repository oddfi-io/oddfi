import type { TokenMeta } from "../token-registry";

// ── Proxy Wallet ──────────────────────────────────────────────────

/** Backend-assigned proxy wallet for the current user */
export interface ProxyWalletInfo {
  address: `0x${string}`;
  network: string;
  chainId: number;
}

/** Single-asset balance inside the proxy wallet */
export interface ProxyWalletBalance {
  symbol: string;
  /** Token amount as a decimal string, e.g. "0.00525" */
  balance: string;
  /** USD equivalent as a decimal string, e.g. "3.15" */
  usdValue: string;
}

// ── On-chain Transaction (generic) ────────────────────────────────

/** Action types supported by the proxy wallet transaction hook */
export type TxAction = "swap" | "transfer";

/**
 * Generic on-chain transaction request.
 *
 * Used by:
 *  - Deposit  (swap: user-token → platform-token)
 *  - Claim    (transfer: proxy-wallet ODD → user wallet)
 *  - Withdraw (swap: platform-token → user-token)
 */
export interface ProxyTxRequest {
  action: TxAction;
  fromToken: TokenMeta;
  toToken: TokenMeta;
  /** Source token amount as a decimal string */
  amountIn: string;
  /** Estimated output amount as a decimal string */
  amountOut: string;
  fromAddress: `0x${string}`;
  toAddress: `0x${string}`;
  slippage?: number;
}

export interface ProxyTxResult {
  txHash: `0x${string}`;
  status: "pending" | "confirming" | "success" | "failed";
  amountOut?: string;
}

// ── Transaction Confirm Summary (UI) ──────────────────────────────

/**
 * Data bag for the TransactionConfirmCard component.
 * Intentionally business-agnostic — works for Deposit, Claim, Withdraw.
 */
export interface TxConfirmSummary {
  /** Display amount, e.g. "$2.00" */
  usdAmount: string;
  sendAmount: string;
  sendSymbol: string;
  sendIconUrl?: string;
  sendChainIconUrl?: string;
  receiveAmount: string;
  receiveSymbol: string;
  receiveIconUrl?: string;
  receiveChainIconUrl?: string;
  /** Wallet provider icon URL, e.g. "/images/wallets/metamask.svg" */
  sourceIconUrl?: string;
  /** e.g. "Wallet (...0jds)" */
  sourceLabel: string;
  /** e.g. "ODD Wallet (...dfk0)" */
  destLabel: string;
  estimatedTime: string;
  networkCost?: string;
  priceImpact?: string;
  maxSlippage?: string;
}
