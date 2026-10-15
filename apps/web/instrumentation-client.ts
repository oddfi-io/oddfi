import * as Sentry from "@sentry/nextjs";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NEXT_PUBLIC_VERCEL_ENV === "production",
  tracesSampleRate: 0.5,

  // 钱包扩展 / 第三方脚本噪音 — 堆栈常落在 app:/// 里，无法仅靠 denyUrls 过滤
  ignoreErrors: [
    // Talisman（波卡钱包）未完成 onboarding 时注入 provider 抛错
    /Talisman extension has not been configured/i,
    // 通用兜底：任何钱包扩展的 "not configured" / "continue with onboarding" 文案
    /extension has not been configured/i,
    /Please continue with onboarding/i,
    // wagmi 2.x 已知竞态：connector 静默 emit 'connect' 早于 React render，
    // 用户同帧点击会触发 uid === current 检查失败（详见 useWalletConnect.ts L347-353 注释）
    "ConnectorAlreadyConnectedError",
    /Connector already connected/i,
  ],

  beforeSend(event) {
    const exValue = event.exception?.values?.[0]?.value ?? "";
    const exType = event.exception?.values?.[0]?.type ?? "";
    const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];

    // Browser extension errors → discard
    if (frames.some((f) => f.filename?.includes("extension://"))) return null;

    // Wallet extension injected errors (TronLink, MetaMask, Phantom, etc.) → discard
    if (
      exValue.includes("tronlinkParams") ||
      exValue.includes("ethereum") ||
      exValue.includes("solana") ||
      exValue.includes("Origin not allowed") ||
      frames.some((f) => f.filename?.includes("injected") || f.filename?.includes("inpage.js"))
    )
      return null;

    // ResizeObserver (Chrome bug) → discard
    if (exValue.includes("ResizeObserver")) return null;

    // Sentry SDK 内部序列化错误（Safari/WKWebView JavaScriptCore 对 span 循环引用报错）
    // 堆栈全为 lib 帧（无 inApp），说明是 Sentry 自身的 helpers.js 调用 JSON.stringify 时崩溃
    // 非我方代码问题，不可操作，丢弃
    if (
      exType === "TypeError" &&
      (exValue.includes("cyclic") || exValue.includes("circular")) &&
      frames.length <= 3 &&
      frames.every((f) => !f.in_app)
    )
      return null;

    // Telegram Mini App bridge errors → discard (non-Telegram browser context)
    if (exValue.includes("postEvent")) return null;

    // Wallet user rejection → discard (user clicked "Reject" in wallet popup)
    if (exType === "UserRejectedRequestError") return null;

    // WalletConnect proposal timeout → discard (user didn't approve in time)
    if (exValue.includes("Proposal expired")) return null;

    // User network errors → discard
    if (exType === "TypeError" && exValue.includes("Failed to fetch")) return null;

    // wagmi/EIP-1193 wallet reconnect: plain object {code, message} rejected without stack → discard
    // exValue is Sentry's own wrapper string; original wallet error content is not visible here
    if (exType === "UnhandledRejection" && exValue.includes("keys: code, message")) return null;

    return event;
  },

  denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],

  // Session Replay: upgrade to Team plan to enable
  // replaysSessionSampleRate: 0.1,
  // replaysOnErrorSampleRate: 1.0,
});
