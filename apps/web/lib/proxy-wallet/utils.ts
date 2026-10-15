import type { TxConfirmSummary } from "./types";

/**
 * Truncate an Ethereum address for display.
 *
 * @example truncateAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18")
 *          // → "0x742d...bD18"
 */
export function truncateAddress(addr: string, head = 4, tail = 4): string {
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head + 2)}...${addr.slice(-tail)}`;
}

/**
 * Build a business-agnostic transaction confirm summary.
 * Used by TransactionConfirmCard in Deposit, Claim, Withdraw flows.
 */
export function buildTxSummary(params: {
  usdAmount: string;
  sendAmount: string;
  sendSymbol: string;
  sendIconUrl?: string;
  sendChainIconUrl?: string;
  receiveAmount: string;
  receiveSymbol: string;
  receiveIconUrl?: string;
  receiveChainIconUrl?: string;
  sourceAddress: string;
  sourceIconUrl?: string;
  sourceLabel?: string;
  destAddress: string;
  destLabel?: string;
  estimatedTime?: string;
  networkCost?: string;
  priceImpact?: string;
  maxSlippage?: string;
}): TxConfirmSummary {
  return {
    usdAmount: `$${params.usdAmount}`,
    sendAmount: params.sendAmount,
    sendSymbol: params.sendSymbol,
    sendIconUrl: params.sendIconUrl,
    sendChainIconUrl: params.sendChainIconUrl,
    receiveAmount: params.receiveAmount,
    receiveSymbol: params.receiveSymbol,
    receiveIconUrl: params.receiveIconUrl,
    receiveChainIconUrl: params.receiveChainIconUrl,
    sourceIconUrl: params.sourceIconUrl,
    sourceLabel: `${params.sourceLabel ?? "Wallet"} (${truncateAddress(params.sourceAddress)})`,
    destLabel: `${params.destLabel ?? "Wallet"} (${truncateAddress(params.destAddress)})`,
    estimatedTime: params.estimatedTime ?? "< 1 min",
    networkCost: params.networkCost,
    priceImpact: params.priceImpact,
    maxSlippage: params.maxSlippage,
  };
}
