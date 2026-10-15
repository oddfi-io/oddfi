import type { Execute } from "@relayprotocol/relay-sdk";

/** Relay `quote.details` 结构（SDK `/quote/v2` 响应派生），
 *  来源 `@relayprotocol/relay-sdk` 的 `Execute["details"]`（即 `QuoteDetails`）。
 *  派生而非手写，避免随 SDK 演进结构漂移。 */
export type RelayQuoteDetails = NonNullable<Execute["details"]>;

/** Execution status for Bridge Tab (useRelayExecute) */
export type BridgeExecutionStatus = "idle" | "signing" | "relaying" | "completed" | "failed";

export type BridgeExecutionState = {
  status: BridgeExecutionStatus;
  /** 0-based index of the currently active step */
  currentStep: number;
  /** Total steps in this execution flow (from quote) */
  totalSteps: number;
  /** All tx hashes emitted so far */
  txHashes: string[];
  /** Set when status === "failed" */
  errorMessage?: string;
};

/** Parameters for requesting a cross-chain Relay quote */
export type RelayQuoteParams = {
  chainId: number;
  currency: string; // source token contract address ("0x0000...0000" for native)
  toChainId: number;
  toCurrency: string; // destination token contract address
  amount: string; // raw amount in smallest unit (wei / token decimals)
  user: string; // sender wallet address
  recipient?: string; // destination address; defaults to user
  /** 失败退款地址（SDK `options.refundTo`）。未指定时 Relay 会 fallback 到 recipient
   *  或 user —— 当 recipient 是 Proxy Wallet 时，退款就会落 Proxy Wallet 而非用户 EOA，
   *  所以 Deposit 跨链入金路径**必须**显式传用户 EOA。 */
  refundTo?: string;
};

/** State machine for useRelayQuote */
export type RelayQuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; quote: Execute; expiresAt: number }
  | { status: "error"; error: Error }
  | { status: "expired" };
