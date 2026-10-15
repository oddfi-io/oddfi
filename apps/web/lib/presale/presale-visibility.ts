/**
 * 认购功能可见性 SSOT（DD-119 §3.5）。
 *
 * 默认仅 mainnet(prod) 开放，testnet 完全隐藏（入口 + 路由 + 页面 + 代理转发）。
 * 预留独立 env `NEXT_PUBLIC_PRESALE_DISABLED` 作 prod kill-switch
 * （认购结束后可单独下线，不依赖切 testnet）。
 *
 * Next.js DefinePlugin 静态折叠 NEXT_PUBLIC_* → testnet bundle 里此值恒 false，
 * 配合 page 级 notFound() 让认购组件树可被 tree-shake。
 *
 * ⚠️ 与 IS_SUBSCRIPTION_MODE 正交：后者是 prod "认购期"全站冻结开关（DD-113），
 * 不是认购本身的可见性开关。判断认购是否可见一律用本常量，不要用 IS_SUBSCRIPTION_MODE。
 */
import { IS_TESTNET } from "@/lib/network-mode";

export const IS_PRESALE_ENABLED = !IS_TESTNET && process.env.NEXT_PUBLIC_PRESALE_DISABLED !== "1";
