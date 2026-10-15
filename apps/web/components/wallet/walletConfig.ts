import type { Connector } from "wagmi";
import { LAST_CONNECTOR_ID_KEY } from "@/lib/wallet-session";
import { IS_TESTNET } from "@/lib/network-mode";

export const WALLETS = [
  { id: "telegram", label: "Telegram", icon: "/images/wallets/telegram.svg" },
  { id: "metamask", label: "MetaMask", icon: "/images/wallets/metamask.svg" },
  { id: "coinbase", label: "Coinbase Wallet", icon: "/images/wallets/coinbase.svg" },
  { id: "okx", label: "OKX Wallet", icon: "/images/wallets/okx.svg" },
  { id: "binance", label: "Binance Wallet", icon: "/images/wallets/binance.svg" },
  { id: "walletconnect", label: "Wallet Connect", icon: "/images/wallets/walletconnect.svg" },
] as const;

export type WalletConfig = (typeof WALLETS)[number];

/**
 * DD-079: Testnet 模式下不支持的钱包列表。
 * Coinbase / Binance / WalletConnect 在 BSC Testnet 上 add network 链路不稳定，
 * 联调期间禁用，仅保留 MetaMask 和 OKX。
 */
const TESTNET_DISABLED_WALLETS = new Set<string>(["coinbase", "binance", "walletconnect"]);

/**
 * 永久占位的钱包：UI 渲染但功能未接入，置灰避免误点。
 * Telegram 登录链路待后端 + PM 确认 OAuth 方案，UI 先按设计稿落地。
 */
const COMING_SOON_WALLETS = new Set<string>(["telegram"]);

export function isWalletDisabledForTestnet(walletId: string): boolean {
  return IS_TESTNET && TESTNET_DISABLED_WALLETS.has(walletId);
}

export function isWalletComingSoon(walletId: string): boolean {
  return COMING_SOON_WALLETS.has(walletId);
}

export function findConnector(
  walletId: string,
  connectors: readonly Connector[]
): Connector | undefined {
  const lc = walletId.toLowerCase();

  // 1. Exact match on RainbowKit wallet id (highest priority).
  //    When a wallet has no injected provider (e.g. OKX on H5), RainbowKit
  //    creates a WalletConnect-backed connector whose top-level .id/.name
  //    become "walletConnect"/"WalletConnect". The original wallet identity
  //    is preserved in connector.rkDetails.id (e.g. "okx", "binance").
  const byRkId = connectors.find(
    (c) => (c as unknown as { rkDetails?: { id?: string } }).rkDetails?.id?.toLowerCase() === lc
  );

  if (byRkId) {
    // Always prefer EIP-6963 auto-discovered injected connector over RK connector.
    // EIP-6963 providers are explicitly announced by each extension, avoiding the
    // window.ethereum contention issue when multiple wallets are installed
    // (e.g., MetaMask + Binance both setting flags on window.ethereum).
    // RK's injected connector may resolve to the wrong provider via getProvider().
    const eip6963 = connectors.find((c) => {
      if (c === byRkId) return false;
      if (c.type !== "injected") return false;
      const name = c.name.toLowerCase().replace(/\s/g, "");
      const id = c.id.toLowerCase();
      return name.includes(lc) || id.includes(lc);
    });
    if (eip6963) return eip6963;
    return byRkId;
  }

  // 2. Fuzzy match on connector name/id — fallback for non-RainbowKit connectors.
  return connectors.find((c) => {
    const name = c.name.toLowerCase().replace(/\s/g, "");
    const id = c.id.toLowerCase();
    return name.includes(lc) || id.includes(lc);
  });
}

export function truncateAddress(addr: string): string {
  if (addr.length <= 13) return addr;
  return `${addr.slice(0, 5)}...${addr.slice(-5)}`;
}

/**
 * Find the WalletConnect Modal connector created by RainbowKit for `walletConnectWallet`.
 * This connector has `isWalletConnectModalConnector: true` and delegates to Reown/Web3Modal.
 *
 * RainbowKit creates two WC connectors for walletConnectWallet:
 * - QR connector (showQrModal: false): RainbowKit renders its own QR code
 * - Modal connector (isWalletConnectModalConnector: true): opens official Reown modal
 *
 * Source: @rainbow-me/rainbowkit/dist/index.js line ~6962
 */
export function findWcModalConnector(connectors: readonly Connector[]): Connector | undefined {
  return connectors.find(
    (c) =>
      (c as unknown as { rkDetails?: { isWalletConnectModalConnector?: boolean } }).rkDetails
        ?.isWalletConnectModalConnector === true
  );
}

/**
 * Find the generic WalletConnect QR connector (showQrModal: false, non-modal).
 * Used for wallets that don't have a wallet-specific WC-backed connector,
 * e.g. MetaMask on H5 (RainbowKit uses MetaMask SDK connector on mobile instead).
 * Calling connect() with this connector initiates a WC handshake and fires display_uri.
 */
export function findWcQrConnector(connectors: readonly Connector[]): Connector | undefined {
  return connectors.find((c) => {
    const rk = (
      c as unknown as {
        rkDetails?: { id?: string; isWalletConnectModalConnector?: boolean };
      }
    ).rkDetails;
    return rk?.id === "walletConnect" && !rk?.isWalletConnectModalConnector;
  });
}

/* ------------------------------------------------------------------ */
/*  钱包身份解析 — 统一入口                                              */
/* ------------------------------------------------------------------ */

const CONNECTED_WALLET_KEY = "oddfi_connected_wallet";

/**
 * 统一 connector → wallet ID 映射表。
 * 覆盖所有已知 connector 标识符：rkDetails.id、EIP-6963 rdns、wagmi connector.id。
 */
const CONNECTOR_ID_MAP: Record<string, string> = {
  // RainbowKit rkDetails.id
  metaMask: "metamask",
  coinbase: "coinbase",
  coinbaseWallet: "coinbase",
  okx: "okx",
  binance: "binance",
  walletConnect: "walletconnect",
  // EIP-6963 rdns
  "io.metamask": "metamask",
  "io.metamask.flask": "metamask",
  "com.coinbase.wallet": "coinbase",
  "com.okex.wallet": "okx",
  "com.binance.wallet": "binance",
  // wagmi SDK connector IDs
  metaMaskSDK: "metamask",
  coinbaseWalletSDK: "coinbase",
};

/**
 * 从 connector 对象解析出标准化 wallet ID。
 * 5 级 fallback：rkDetails.id → connector.id → rkDetails.rdns → connector.name → undefined
 */
export function resolveWalletId(
  connector:
    | { id?: string; name?: string; rkDetails?: { id?: string; rdns?: string } }
    | null
    | undefined
): string | undefined {
  if (!connector) return undefined;

  // Level 1: rkDetails.id（RainbowKit 创建的 connector 最可靠）
  const rkId = (connector as unknown as { rkDetails?: { id?: string } }).rkDetails?.id;
  if (rkId && CONNECTOR_ID_MAP[rkId]) return CONNECTOR_ID_MAP[rkId];

  // Level 2: connector.id（含 wagmi SDK ID 如 "metaMaskSDK"、EIP-6963 rdns 如 "io.metamask"）
  if (connector.id && CONNECTOR_ID_MAP[connector.id]) return CONNECTOR_ID_MAP[connector.id];

  // Level 3: rkDetails.rdns（RainbowKit 钱包定义中的 rdns 字段）
  const rdns = (connector as unknown as { rkDetails?: { rdns?: string } }).rkDetails?.rdns;
  if (rdns && CONNECTOR_ID_MAP[rdns]) return CONNECTOR_ID_MAP[rdns];

  // Level 4: connector.name 模糊匹配（最后兜底）
  const name = connector.name?.toLowerCase().replace(/\s/g, "") ?? "";
  if (name.includes("metamask")) return "metamask";
  if (name.includes("okx") || name.includes("okex")) return "okx";
  if (name.includes("coinbase")) return "coinbase";
  if (name.includes("binance")) return "binance";

  return undefined;
}

/** 持久化用户选择的钱包 ID（独立于 wagmi connector 状态） */
export function storeConnectedWallet(walletId: string): void {
  try {
    localStorage.setItem(CONNECTED_WALLET_KEY, walletId);
  } catch {
    /* private browsing */
  }
}

/** 读取持久化的钱包选择 */
export function getConnectedWallet(): string | undefined {
  try {
    return localStorage.getItem(CONNECTED_WALLET_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** 断开连接时清除 */
export function clearConnectedWallet(): void {
  try {
    localStorage.removeItem(CONNECTED_WALLET_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 读取上次成功登录的钱包 ID（标准化为 metamask / coinbase / okx / binance / walletconnect）。
 * 数据源：localStorage[LAST_CONNECTOR_ID_KEY]，由 useAuth.performLogin 登录成功时写入；
 * wagmi disconnect 不清，仅 performLogout / clearWalletSessionStorage 清 — 正好对齐「最后使用」语义。
 */
export function getLastUsedWalletId(): string | undefined {
  let connectorId: string | null;
  try {
    connectorId = localStorage.getItem(LAST_CONNECTOR_ID_KEY);
  } catch {
    return undefined;
  }
  if (!connectorId) return undefined;
  if (CONNECTOR_ID_MAP[connectorId]) return CONNECTOR_ID_MAP[connectorId];
  const lc = connectorId.toLowerCase();
  if (lc.includes("metamask")) return "metamask";
  if (lc.includes("coinbase")) return "coinbase";
  if (lc.includes("okx") || lc.includes("okex")) return "okx";
  if (lc.includes("binance")) return "binance";
  if (lc.includes("walletconnect")) return "walletconnect";
  return undefined;
}
