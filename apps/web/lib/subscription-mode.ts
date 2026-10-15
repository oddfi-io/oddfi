/**
 * Subscription Mode (DD-113)
 *
 * 主站认购模式 SSOT。env=`NEXT_PUBLIC_SUBSCRIPTION_MODE=1` 启用，全站可见但操作冻结，
 * 唯一可用入口 /odd-presale（DD-146 起，旧 /invest 已下线、308 重定向到此）。开启时强制覆盖早鸟模式（参见 lib/early-bird-mode.ts 的互斥逻辑）。
 *
 * Next.js DefinePlugin 静态折叠 → bundle 不留运行时分支。
 */
export const IS_SUBSCRIPTION_MODE = process.env.NEXT_PUBLIC_SUBSCRIPTION_MODE === "1";
