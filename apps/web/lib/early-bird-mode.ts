/**
 * Early Bird Mode (DD-103)
 *
 * 主站早鸟模式 SSOT。env=`NEXT_PUBLIC_EARLY_BIRD_MODE=1` 时启用，仅放行 Home Landing，
 * 所有跨路由跳转 / 钱包入口被拦截弹「早鸟登记」Modal；其他环境（testnet/dev/pre）行为不变。
 *
 * 供 middleware（server）+ Provider（client）共用。`NEXT_PUBLIC_*` 会被 Next.js DefinePlugin
 * 静态折叠为字面量，client bundle 不会保留运行时分支。
 *
 * DD-113 互斥层：认购模式（NEXT_PUBLIC_SUBSCRIPTION_MODE=1）开启时强制关闭早鸟，
 * 单点关闭让 middleware / EarlyBirdProvider / LandingPage SSR 全部走非早鸟分支，
 * 早鸟代码完整保留，env 切回即恢复。
 */

export const IS_EARLY_BIRD_MODE =
  process.env.NEXT_PUBLIC_EARLY_BIRD_MODE === "1" &&
  process.env.NEXT_PUBLIC_SUBSCRIPTION_MODE !== "1";

/**
 * Early Bird Bypass —— 调试通道（DD-103 续）。
 *
 * 开发/运营在早鸟模式生产环境通过 DevToolsModal 输入邀请码（=后端 INVITE_CODE env），
 * 校验通过后服务端下发 cookie。middleware + LandingPage SSR + layout SSR 共享 server-only
 * 校验，cookie 值 = INVITE_CODE 原文且 httpOnly，客户端无法读取/伪造。
 *
 * 客户端组件（EarlyBirdProvider / LandingPhoneRedirect / DevToolsModal）改从
 * `useEarlyBird().isActive` 推断 bypass 状态（layout SSR 已把 bypass 反向写入 active prop）。
 */
export const EB_BYPASS_COOKIE = "oddfi_eb_bypass";

/** Server-side check. Compare cookie value against INVITE_CODE secret. */
export function isEarlyBirdBypassValid(cookieValue: string | undefined): boolean {
  const INVITE_CODE = process.env.INVITE_CODE;
  return !!INVITE_CODE && cookieValue === INVITE_CODE;
}
