/**
 * 钱包会话存储清理 — 统一工具
 *
 * 职责：集中定义钱包 session 相关的存储 key，并提供统一清理函数。
 *
 * 调用路径（必须保持行为一致，否则会导致钱包连接态不同步）：
 * - `useWallet.disconnect.onSuccess` — 用户主动断开
 * - `useWalletConnect.backToSelect`  — 签名取消后点 Reconnect
 * - `useAuth.performLogout`          — 级联登出（session 失效 / 主动登出）
 *
 * 为什么需要统一：
 * MetaMask 等 injected connector 的 disconnect 不撤销扩展权限，
 * 下次 connect() 可能静默 emit 'connect'，UI 只闪一下不弹权限框。
 * 三条路径都必须清 session flag，让 performLogin 正确判定这是全新连接。
 *
 * 不做什么：不调用 wagmi disconnect、不清 auth store — 仅存储层清理，
 * 调用方自行编排 wagmi / store reset。
 */
import type { Config } from "wagmi";
import { getAccount } from "wagmi/actions";
import { clearConnectedWallet } from "@/components/wallet/walletConfig";

/**
 * 标记用户是否通过我们的 UI 主动发起钱包连接。
 * 由 WalletConnectModal / MobileWalletConnectSheet 在用户点击钱包时写入，useAuth 消费后立即清除。
 * 用 sessionStorage 而非 useRef：持久化跨 React StrictMode 双重挂载，
 * 且不依赖 wagmi 各 connector 实现不一致的 status 字段。
 *
 * H5 deep link 跳转时额外写入 localStorage（sessionStorage 跨 App 切换后丢失）。
 * localStorage 条目附带时间戳 key，超过 TTL 视为无效（防止残留 flag 误触签名）。
 */
export const EXPLICIT_CONNECT_KEY = "oddfi_explicit_connect";
export const EXPLICIT_CONNECT_TS_KEY = "oddfi_explicit_connect_ts";
/** MetaMask 通过通用 WC connector 连接时，sessionStorage 记录真实钱包选择，performLogin 优先读取 */
export const SELECTED_WALLET_KEY = "oddfi_selected_wallet";
/**
 * 上次成功连接的 connector.id。登录成功时写入，**logout / disconnect 都不清**。
 * 用途：钱包选择 modal 在用户回访时给上次用过的钱包加「Last used」tag。
 * 仅在下次成功登录其他钱包时被覆盖；用户清浏览器数据自然失效。
 */
export const LAST_CONNECTOR_ID_KEY = "oddfi_last_connector_id";

/**
 * 清除所有钱包 session 相关的存储 key：
 * - sessionStorage: EXPLICIT_CONNECT_KEY / SELECTED_WALLET_KEY
 * - localStorage:   EXPLICIT_CONNECT_KEY / EXPLICIT_CONNECT_TS_KEY
 * - 持久化的钱包选择（CONNECTED_WALLET_KEY，via clearConnectedWallet）
 *
 * **不清** LAST_CONNECTOR_ID_KEY：跨 logout 持久存在以驱动「Last used」tag。
 */
export function clearWalletSessionStorage(): void {
  try {
    sessionStorage.removeItem(EXPLICIT_CONNECT_KEY);
    sessionStorage.removeItem(SELECTED_WALLET_KEY);
  } catch {
    /* SSR / private browsing */
  }
  try {
    localStorage.removeItem(EXPLICIT_CONNECT_KEY);
    localStorage.removeItem(EXPLICIT_CONNECT_TS_KEY);
  } catch {
    /* private browsing */
  }
  clearConnectedWallet();
}

/**
 * 撤销当前 connector 的 dApp 权限（EIP-2255 `wallet_revokePermissions`）。
 *
 * 为什么需要：wagmi `disconnect()` 只清本地状态，**不撤销**钱包扩展的已授权权限；
 * 下次 `connect()` 会直接 emit 'connect' 事件，UI 只闪一下不拉起 MetaMask 选账户/签名弹窗。
 * 用户必须刷新页面或手动在钱包里 revoke 才恢复。
 *
 * 实现：EIP-2255 `wallet_revokePermissions` 是通用协议，MetaMask / OKX / Binance Wallet 等主流 injected 钱包支持；
 * 不支持的钱包会抛错（比如 WalletConnect session 本身用 disconnect 协议），吞掉即可。
 *
 * 必须在 wagmi disconnect **之前**调用：disconnect 后 connector 的 provider 引用会被清空。
 */
export async function revokeWalletPermissions(config: Config): Promise<void> {
  const { connector } = getAccount(config);
  if (!connector) return;
  try {
    const provider = (await connector.getProvider()) as {
      request?: (args: { method: string; params: unknown[] }) => Promise<unknown>;
    } | null;
    await provider?.request?.({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    /* 钱包不支持 EIP-2255 / 已撤销 — 静默降级 */
  }
}
