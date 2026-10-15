/**
 * 功能上线收敛开关 SSOT（DD-144）。
 *
 * lend / swap 在主网上线时整体下架（入口隐藏 + 路由拦截），待产品决定回归。
 * 语义与 presale 的 `_DISABLED` kill-switch 相反：presale 是「在线可随时关」，
 * 这两个是「下架待回归」，故用 `_ENABLED`（默认 off），未来恢复只需对应环境置 1，不动代码。
 *
 * Next.js DefinePlugin 静态折叠 NEXT_PUBLIC_* → bundle 内此值为编译期常量，
 * 关闭态下相关组件树可被 tree-shake，不留运行时分支。
 *
 * ⚠️ 只认字符串 "1"，其余（true/yes/on/0/空/拼写错误）一律视为关闭，避免误开。
 */
export const IS_LEND_ENABLED = process.env.NEXT_PUBLIC_LEND_ENABLED === "1";
export const IS_SWAP_ENABLED = process.env.NEXT_PUBLIC_SWAP_ENABLED === "1";

/**
 * DD-144：导航项是否因 lend/swap 下架而应隐藏。
 * 供 TopNav / MobileMenuSheet / MobileTabBar / footer-links 统一调用，
 * 避免过滤谓词散落多处导致漏改（新增第三处下架功能也只改这一个函数）。
 */
export function isNavItemLaunchHidden(key: string): boolean {
  return (!IS_LEND_ENABLED && key === "lend") || (!IS_SWAP_ENABLED && key === "swap");
}

/**
 * DD-144：判断 pathname 是否命中「已下架功能」路由（lend/swap），供 middleware 硬拦截
 * （直接输 URL / 收藏夹 / 分享链接绕过入口隐藏访问）。命中 → middleware 307 回首页。
 *
 * 纯函数：locale 白名单由调用方注入（middleware 持有 routing.locales），便于单测。
 * 匹配根路径 `/lend`、带合法 locale 前缀 `/xx/lend` 及其子路径；功能已启用则不拦截。
 */
export function isDisabledFeatureRoute(
  pathname: string,
  supportedLocales: ReadonlySet<string>
): boolean {
  const m = pathname.match(/^(?:\/([a-z]{2}))?\/(lend|swap)(?:\/|$)/);
  if (!m) return false;
  // 带 locale 前缀时校验是否合法 locale，避免误判 /xx/lend
  if (m[1] !== undefined && !supportedLocales.has(m[1])) return false;
  return m[2] === "lend" ? !IS_LEND_ENABLED : !IS_SWAP_ENABLED;
}
