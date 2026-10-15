import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import {
  IS_EARLY_BIRD_MODE,
  EB_BYPASS_COOKIE,
  isEarlyBirdBypassValid,
} from "./lib/early-bird-mode";
import { IS_SUBSCRIPTION_MODE } from "./lib/subscription-mode";
import { IS_PRESALE_ENABLED } from "./lib/presale/presale-visibility";
import { isDisabledFeatureRoute } from "./lib/feature-flags";
import { buildFrameSrc } from "./lib/embed-allowlist";

const intlMiddleware = createMiddleware(routing);

const SUPPORTED_LOCALES = new Set<string>(routing.locales);

/**
 * ENH embed-allowlist-sot：CSP frame-src 从 next.config.mjs 静态头搬到这里运行时下发，
 * 直播域部分从后端单一真值源（market-api /api/v1/stream/embed-allowlist）拉取，
 * 后端轮换 embed 域只改一处 env，前端 CSP 在缓存 TTL 内自动跟随、无需前端发版。
 * next.config.mjs 已移除该 CSP 头，避免两份 CSP 头取交集把动态新域拦死。
 * 在所有返回响应上统一打 CSP（重定向无害，页面响应是直播 iframe 的实际约束点）。
 */
function withCSP(res: NextResponse, frameSrc: string): NextResponse {
  res.headers.set("Content-Security-Policy", `frame-src ${frameSrc};`);
  return res;
}

/**
 * DD-146 §8.2：认购专属路由收窄为仅 `/odd-presale`（旧 `/invest` 已下线）。
 * referral/invite 是站点级，不门控。匹配根路径与带 locale 前缀的变体及子路径。
 */
function isPresaleRoute(pathname: string): boolean {
  const m = pathname.match(/^(?:\/([a-z]{2}))?\/(odd-presale)(?:\/|$)/);
  if (!m) return false;
  // 带 locale 前缀时校验是否合法 locale，避免误判 /xx/odd-presale
  return m[1] === undefined || SUPPORTED_LOCALES.has(m[1]);
}

/**
 * DD-146 §8.2：旧 `/invest` 路由下线 → 308 永久重定向到 `/odd-presale`（保留 locale 前缀）。
 * 与 feature gate（isPresaleRoute）分离：deprecation redirect 先于一切门控执行，
 * 命中即返回新路径（不带 search），让收藏夹 / 分享旧链接稳定迁移。
 * 返回目标 pathname；非 /invest 返回 null。
 */
function investRedirectTarget(pathname: string): string | null {
  const m = pathname.match(/^(?:\/([a-z]{2}))?\/invest(?:\/|$)/);
  if (!m) return null;
  const locale = m[1];
  if (locale !== undefined && !SUPPORTED_LOCALES.has(locale)) return null;
  return locale ? `/${locale}/odd-presale` : "/odd-presale";
}

/**
 * DD-103 早鸟模式路径放行判断。Landing 真实路径是 `/<locale>/home`，
 * 项目 `app/[locale]/page.tsx` 在 `/<locale>` 用 next-intl `redirect` 自动跳到 `/<locale>/home`。
 * 因此早鸟模式必须放行：根 `/`、`/<locale>`、`/<locale>/`、`/<locale>/home`、`/<locale>/home/`。
 * locale 部分严格校验是否在 routing.locales 白名单内，避免任意 [a-z]{2} 被误判为合法 home。
 */
function isHomePath(pathname: string): boolean {
  if (pathname === "/") return true;
  const m = pathname.match(/^\/([a-z]{2})(?:\/(home\/?)?)?$/);
  if (!m) return false;
  return SUPPORTED_LOCALES.has(m[1]);
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ENH embed-allowlist-sot：先算好本次响应的 CSP frame-src（直播域来自后端单一真值源，已缓存）。
  const frameSrc = await buildFrameSrc();

  // DD-146 §8.2：旧 /invest 路由下线 → 308 永久重定向到 /odd-presale（保留 locale 前缀）。
  // deprecation redirect 先于一切门控（feature gate / 早鸟 / 邀请码）执行，确保旧链接稳定迁移。
  const investTarget = investRedirectTarget(pathname);
  if (investTarget) {
    const url = request.nextUrl.clone();
    url.pathname = investTarget;
    url.search = "";
    return withCSP(NextResponse.redirect(url, 308), frameSrc);
  }

  // DD-119 §3.5 第1层：认购仅 prod 上线。testnet（或 prod kill-switch）下硬拦截认购路由，
  // 防直接输 URL / 收藏夹 / 分享链接绕过入口隐藏访问。这是唯一可靠的硬门控。
  if (!IS_PRESALE_ENABLED && isPresaleRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return withCSP(NextResponse.redirect(url, 307), frameSrc);
  }

  // DD-144：lend/swap 上线下架硬拦截。仿 presale，防直接输 URL / 收藏夹 / 分享链接绕过入口隐藏。
  if (isDisabledFeatureRoute(pathname, SUPPORTED_LOCALES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return withCSP(NextResponse.redirect(url, 307), frameSrc);
  }

  // 早鸟模式（DD-103）：先于邀请码闸门处理，仅作用于主站 Production
  if (IS_EARLY_BIRD_MODE) {
    // DD-103 续：bypass cookie（值=INVITE_CODE）匹配 → 跳过早鸟拦截
    if (isEarlyBirdBypassValid(request.cookies.get(EB_BYPASS_COOKIE)?.value)) {
      return withCSP(intlMiddleware(request), frameSrc);
    }
    if (isHomePath(pathname)) {
      return withCSP(intlMiddleware(request), frameSrc);
    }
    // 防御性放行 /access 和 /invite（含 locale 前缀）— 早鸟切换窗口期 / 内部预览仍可达
    if (
      pathname.startsWith("/access") ||
      pathname.startsWith("/invite") ||
      /^\/[a-z]{2}\/(access|invite)(\/|$)/.test(pathname)
    ) {
      return withCSP(NextResponse.next(), frameSrc);
    }
    // 非 Home 路由 → 307 临时重定向回根（用 307 不用 308 避免浏览器缓存 redirect chain）
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return withCSP(NextResponse.redirect(url, 307), frameSrc);
  }

  // 本地开发环境跳过邀请码校验
  if (process.env.NODE_ENV === "development") {
    return withCSP(intlMiddleware(request), frameSrc);
  }

  // DD-113 认购模式：跳过邀请码访问门（与早鸟模式互斥层语义一致 — 全站全功能可见但操作冻结）
  if (IS_SUBSCRIPTION_MODE) {
    return withCSP(intlMiddleware(request), frameSrc);
  }

  // 放行：邀请码验证页 + 验证 API
  if (pathname.startsWith("/access") || pathname.startsWith("/api/auth")) {
    return withCSP(NextResponse.next(), frameSrc);
  }

  // 邀请码门禁：以「是否配置 INVITE_CODE」为开关。
  // 未配置（删除 / 留空）→ 视为关闭门禁，全站直接放行；配置了才校验 cookie。
  // 想重新上门禁：把 INVITE_CODE 设回非空值并 redeploy 即可。
  const INVITE_CODE = process.env.INVITE_CODE;
  if (INVITE_CODE) {
    const token = request.cookies.get("access-token")?.value;
    if (token !== INVITE_CODE) {
      return withCSP(NextResponse.redirect(new URL("/access", request.url)), frameSrc);
    }
  }

  // 已授权（或门禁关闭）→ 走 i18n 路由
  return withCSP(intlMiddleware(request), frameSrc);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
