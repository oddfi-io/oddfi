import type { Wallet } from "@rainbow-me/rainbowkit";
import { createConnector } from "wagmi";
import { injected } from "wagmi/connectors";
import { createStore, type Store } from "mipd";

// RK 未在 root re-export DefaultWalletOptions（在 ./wallets/Wallet.d.ts 内部），自定义最小化版本
type DefaultWalletOptions = {
  projectId: string;
  walletConnectParameters?: Record<string, unknown>;
};

/**
 * BUG-013 · P2-lite — MIPD rdns hard-lock 钱包封装
 *
 * 把 RainbowKit `metaMaskWallet` / `okxWallet` / `binanceWallet` 等默认走
 * `window.ethereum` 旁路检测的 wallet factory 包一层，强制 connector 仅绑定到
 * EIP-6963 announce 的对应 rdns provider 上，跳过被多扩展污染的 `window.ethereum` 全局指针。
 *
 * 桌面场景生效；移动场景透传 RK 原装 createConnector（移动走 WC v2 / SDK cross-device，
 * 不依赖 `window.ethereum` 抢占，无 contention 风险）。
 *
 * 参考：critic v1 §替代方案 + BD v2 §3.3 + 实证 V-1~V-4。
 */

type WalletFactory = (params: DefaultWalletOptions) => Wallet;

// MIPD store 单例（SSR-safe），客户端首次访问时 lazy init
let mipdStoreSingleton: Store | null = null;

function getMipdStore(): Store | null {
  if (typeof window === "undefined") return null;
  if (!mipdStoreSingleton) mipdStoreSingleton = createStore();
  return mipdStoreSingleton;
}

/** 仅供测试：覆盖 mipd store（替换默认单例） */
export function setMipdStoreForTestOnly(store: Store | null): void {
  mipdStoreSingleton = store;
}

/** 仅供测试：覆盖 isMobile UA 检测（默认走 navigator.userAgent） */
let isMobileOverride: boolean | null = null;
export function setIsMobileForTestOnly(value: boolean | null): void {
  isMobileOverride = value;
}

function isMobileEnv(): boolean {
  if (isMobileOverride !== null) return isMobileOverride;
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/**
 * 把 RK wallet factory 包一层：桌面用 EIP-6963 rdns hard-lock，移动透传。
 *
 * @param rdns Reverse Domain Name (EIP-6963 announce 标识)，如 "io.metamask"
 * @param base 原 RK wallet factory（metaMaskWallet / okxWallet / binanceWallet）
 */
export function makeRdnsLockedWallet(rdns: string, base: WalletFactory): WalletFactory {
  return (params) => {
    const wallet = base(params);
    const probeProvider = () => getMipdStore()?.findProvider({ rdns })?.provider;
    const onMobile = isMobileEnv();

    if (onMobile) {
      // 移动端：透传 RK 原装行为，不动 installed 也不动 createConnector
      return wallet;
    }

    // 桌面：installed 由 MIPD announce 决定（与 window.ethereum 污染脱钩）
    return {
      ...wallet,
      installed: !!probeProvider(),
      createConnector: (walletDetails) =>
        createConnector((config) => {
          const injectedConnector = injected({
            target: () => {
              const provider = probeProvider();
              if (!provider) {
                // RK UI 应已通过 installed:false 阻止用户点击；防御性兜底
                return undefined;
              }
              return {
                id: wallet.id,
                name: wallet.name,
                provider,
              };
            },
          })(config);
          return {
            ...injectedConnector,
            ...walletDetails,
          };
        }),
    };
  };
}
