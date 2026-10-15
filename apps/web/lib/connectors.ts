import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  okxWallet,
  binanceWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { makeRdnsLockedWallet } from "./wallet-mipd-lock";

// BUG-013 P2-lite：metaMask / OKX / Binance 走 MIPD rdns hard-lock，桌面端
// 跳过 window.ethereum 全局指针（避免被 Yoroi/TON/TRON 等扩展污染导致 wagmi
// state.current 被异步清空 → signMessageAsync 抛 ConnectorNotConnectedError）。
// Coinbase / WalletConnect 通道天然独立（自有 SDK popup / WC v2 协议），无需 hard-lock。
// 移动端透传 RK 原装行为（走 WC v2 / MM SDK cross-device，不依赖 window.ethereum）。
const metaMaskRdnsLocked = makeRdnsLockedWallet("io.metamask", metaMaskWallet);
const okxRdnsLocked = makeRdnsLockedWallet("com.okex.wallet", okxWallet);
const binanceRdnsLocked = makeRdnsLockedWallet("com.binance.wallet", binanceWallet);

// Lazy initialization: connectorsForWallets() triggers WalletConnect Core
// which uses indexedDB for storage — not available in Node.js SSR runtime.
// Return empty array on server, real connectors on client.
export const walletConnectors =
  typeof window === "undefined"
    ? []
    : connectorsForWallets(
        [
          {
            groupName: "Popular",
            wallets: [metaMaskRdnsLocked, coinbaseWallet, okxRdnsLocked],
          },
          {
            groupName: "More",
            wallets: [binanceRdnsLocked, walletConnectWallet],
          },
        ],
        {
          appName: "Oddfi",
          projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? "demo-project-id",
          appUrl: typeof window !== "undefined" ? window.location.origin : "https://oddfi.io",
          appDescription: "Next level betting",
          appIcon: `${window.location.origin}/images/logo-icon-blue-bg.svg`,
        }
      );
