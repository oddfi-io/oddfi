import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// BUG-005 Fix F: Vercel 部署若忘配 NEXT_PUBLIC_NETWORK_MODE 直接 fail build，
// 杜绝双部署架构静默回落 mainnet（同类教训：DD-090 worktree env 缺失静默回落）。
// 本地 `pnpm dev` 不受影响（无 VERCEL env）。
if (process.env.VERCEL && !process.env.NEXT_PUBLIC_NETWORK_MODE) {
  throw new Error(
    '[network-mode] NEXT_PUBLIC_NETWORK_MODE must be explicitly set on Vercel deployments. ' +
    'Set it in Project Settings → Environment Variables for the relevant scope (production / preview).'
  );
}

/**
 * 强制把 NEXT_PUBLIC_NETWORK_MODE 注入 client bundle。
 *
 * 为什么必须显式注入：Next.js DefinePlugin 只对「构建时存在于 process.env 中的
 * NEXT_PUBLIC_* 变量」做静态替换。production 部署如果忘记在 Vercel 配置该变量，
 * `process.env.NEXT_PUBLIC_NETWORK_MODE` 会被保留为运行时表达式，并通过 webpack
 * 的 process polyfill 兜底 `window.process.env`。任何在客户端污染了 window.process
 * 的代码（钱包扩展 / devtools 手工赋值 / 第三方脚本）都能让 IS_TESTNET 误判为 true，
 * 触发 useAuth.switchChainAsync({ chainId: 97 }) → ConnectorChainMismatchError。
 *
 * 通过 next.config 的 `env` 字段下沉默认值后，Next.js 在 build 时一定能拿到值，
 * DefinePlugin 会把表达式静态折叠成字面量，运行时不再读 window.process。
 */
const ACTIVE_NETWORK_MODE =
  process.env.NEXT_PUBLIC_NETWORK_MODE === 'testnet' ? 'testnet' : 'mainnet';

// DD-126 §3.3：直播 iframe 去 sandbox 后，用 CSP frame-src 白名单兜底
// —— 只约束「哪些域能被嵌进 iframe」，不碰 script/style/connect（不影响 Sentry/钱包 RPC/API）。
//
// ENH embed-allowlist-sot（2026-06-13）：CSP frame-src 已从这里的静态 headers() 搬到 middleware.ts
// 运行时下发——直播 embed 域从后端单一真值源（market-api /api/v1/stream/embed-allowlist）拉取，
// 后端轮换 embed 域只改一处 STREAM_EMBED_ALLOWED_HOSTS env，前端 CSP 自动跟随、无需前端发版，
// 根治了过去「域轮换要同步改 3 处 2 仓」的 whack-a-mole。稳定段（self + 钱包域）与 baked 兜底
// 直播域见 lib/embed-allowlist.ts。⚠️ 不要在此 headers() 再加 CSP frame-src，否则两份 CSP 头取交集
// 会把 middleware 的动态新域拦死。
// 域名轮换史（streamed.pk 上游）：embedme.top → embedsports.top(2026-05-29) → embed.st(2026-06-13, BUG-031)。

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/discord',
        destination: 'https://discord.gg/hyv3thNyR',
        permanent: false,
      },
      {
        source: '/:locale/discord',
        destination: 'https://discord.gg/hyv3thNyR',
        permanent: false,
      },
    ];
  },
  env: {
    NEXT_PUBLIC_NETWORK_MODE: ACTIVE_NETWORK_MODE,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/trustwallet/assets/**",
      },
      {
        protocol: "https",
        hostname: "cdn.sportmonks.com",
        pathname: "/images/soccer/**",
      },
      {
        protocol: "https",
        hostname: "coin-images.coingecko.com",
        pathname: "/coins/images/**",
      },
      // DD-112: codex-pets sprite-sheet CDN（AI Agent 头像，immutable 版本锁路径）
      {
        protocol: "https",
        hostname: "codex-pets.net",
        pathname: "/assets/pets/v/**",
      },
    ],
    // ENH-023 Batch 1: Cache TTL 与 vercel.json /images/ 对齐到 30 天
    minimumCacheTTL: 2592000,
    // ENH-023 Batch 1: 锁单格式避免 webp+avif 双格式翻倍 transformations 计费
    formats: ["image/avif", "image/webp"],
    // ENH-023 Batch 1: 业务宽度白名单（< 640，遵循 Next 官方 imageSizes < min(deviceSizes) 约束）
    // 含 landing 9 张球员卡渲染宽（271/297/307/342/278/301/363/364/80）+ trade card / odd-logo-3d
    imageSizes: [16, 24, 36, 48, 72, 80, 100, 140, 144, 256, 271, 297, 307, 342, 384, 502, 627],
    // ENH-023 Batch 1: 显式 deviceSizes — 默认值 + 863（HeroSection 渲染宽）+ 1200（market-preview）
    deviceSizes: [640, 750, 828, 863, 1080, 1200, 1920, 2048, 3840],
    // ENH-023 Batch 1: 路径白名单 — /images/ 与 /banner/ 走 Image Optimization；
    // /icons/ 必须包含（WalletConnectModal 等业务组件用 <Image src="/icons/..." />），
    // 缺失会让 image-optimizer.js 服务端返回 400 'url parameter is not allowed'。
    localPatterns: [
      { pathname: "/images/**", search: "" },
      { pathname: "/banner/**", search: "" },
      { pathname: "/icons/**", search: "" },
    ],
  },
  experimental: {
    optimizePackageImports: [
      '@phosphor-icons/react',
      '@rainbow-me/rainbowkit',
      '@tanstack/react-query',
      'framer-motion',
    ],
  },
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.module.rules.push({
        test: /\.(tsx|jsx)$/,
        use: [{ loader: '@locator/webpack-loader', options: { env: 'development' } }],
      });
    }

    // Suppress warnings from optional/React Native deps bundled inside third-party libs
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    };

    return config;
  },
};

const sentryOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
};

// Skip Sentry webpack plugin in dev — saves ~5-10s per page compilation
const withPlugins = withNextIntl(nextConfig);
export default process.env.NODE_ENV === 'production'
  ? withSentryConfig(withPlugins, sentryOptions)
  : withPlugins;
