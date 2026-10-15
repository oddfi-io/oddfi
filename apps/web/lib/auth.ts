/**
 * Build the sign message for EOA wallet login.
 * Format is strictly defined by backend — do NOT change spaces or punctuation.
 *
 * Example output:
 * "oddfi wants you to sign in with your account:0x123...abc ChainID:bsc Nonce:dpcmbz4v Issued At:1774598277 Expiration time:1774598577"
 */
export function buildSignMessage(
  address: string,
  chainId: string,
  nonce: string,
  issuedAt: number
): string {
  return `oddfi wants you to sign in with your account:${address} ChainID:${chainId} Nonce:${nonce} Issued At:${issuedAt} Expiration time:${issuedAt + 300}`;
}

/**
 * Map wagmi connector to backend wallet_type value.
 *
 * Accepts a connector object rather than just connectorId to handle the
 * WalletConnect-backed path: when a wallet (e.g. OKX) has no injected provider,
 * RainbowKit creates a connector with .id = "walletConnect", but the original
 * wallet identity is preserved in connector.rkDetails.id (e.g. "okx").
 */
const WALLET_TYPE_MAP: Record<string, string> = {
  // Injected path connector IDs（短名）
  metaMask: "metamask",
  metaMaskSDK: "metamask", // MetaMask SDK connector on mobile
  okx: "okx",
  binance: "binance",
  coinbaseWallet: "coinbase",
  // WalletConnect path
  walletConnect: "walletconnect",
  // rdns 形式（BUG-013 rdns-lock 后 connector.id 为 rdns，如实测 OKX = com.okex.wallet）
  "com.okex.wallet": "okx",
  "com.binance.wallet": "binance",
  "io.metamask": "metamask",
  // Legacy alias
  "com.binance": "binance",
};

export function mapWalletType(
  connector?: { id?: string; rkDetails?: { id?: string } } | null
): string {
  // 依次解析 rkDetails.id（WC 时为真实钱包身份）→ connector.id；
  // 每个先查白名单 map，再做子串兜底 —— 任何 id 形态（短名 / rdns / 变体）都能归一，
  // 避免自动重登路径（DD-131，无 SELECTED_WALLET_KEY）因 id 不在白名单而错落到 metamask。
  for (const raw of [connector?.rkDetails?.id, connector?.id]) {
    if (!raw) continue;
    if (WALLET_TYPE_MAP[raw]) return WALLET_TYPE_MAP[raw];
    const lower = raw.toLowerCase();
    if (lower.includes("binance")) return "binance";
    if (lower.includes("okex") || lower.includes("okx")) return "okx";
    if (lower.includes("coinbase")) return "coinbase";
    if (lower.includes("walletconnect")) return "walletconnect";
    if (lower.includes("metamask")) return "metamask";
  }

  return "metamask";
}

/**
 * Map wagmi chain ID to backend chain name.
 */
export function mapChainName(chainId?: number): string {
  if (chainId === 56 || chainId === 97) return "bsc";
  if (chainId === 1) return "eth";
  if (chainId === 137) return "polygon";
  if (chainId === 42161) return "arbitrum";
  if (chainId === 8453) return "base";
  throw new Error(`[mapChainName] Unsupported chainId: ${chainId}`);
}

/**
 * 解码 JWT payload 中的 `address` 字段，用于钱包账户切换保护。
 *
 * 仅做 base64url 解码 + JSON 解析，不验证签名（签名验证由后端完成，前端只需读取 claim）。
 * 任何异常（非法 token、非法 base64、缺字段等）一律返回 null，由调用方 fallback。
 */
export function decodeJwtAddress(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    // base64url → base64
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    // 补齐 padding
    const pad = b64.length % 4;
    if (pad === 2) b64 += "==";
    else if (pad === 3) b64 += "=";
    else if (pad === 1) return null;
    const json =
      typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("utf-8");
    const payload = JSON.parse(json) as { address?: unknown };
    return typeof payload.address === "string" ? payload.address : null;
  } catch {
    return null;
  }
}
