/**
 * 页脚共享数据常量（PC Footer + H5 MobileFooter 单一真源）。
 *
 * 视图层各写一套合理（桌面 4 列固定版式 / 移动折叠列版式确实不同），但产品/资源链接路由
 * 与社交账号是**产品级数据**，只在此维护一份 —— 避免改 nav 入口 / 社交账号 / 图标资产时
 * 漏改另一个文件导致 PC/H5 页脚不一致。`key` 经 `t(`links.${key}`)` 取 i18n 文案。
 */
import { isNavItemLaunchHidden } from "@/lib/feature-flags";

// DD-144：lend/swap 上线下架，默认隐藏（PC Footer + H5 MobileFooter 同步生效）。
export const PRODUCT_LINK_CONFIG = [
  { key: "markets" as const, href: "/markets" },
  { key: "pools" as const, href: "/liquidity" },
  { key: "stake" as const, href: "/stake" },
  { key: "lend" as const, href: "/lend" },
  { key: "swap" as const, href: "/swap" },
  { key: "referral" as const, href: "/referral" },
  { key: "rewards" as const, href: "/rewards" },
].filter((item) => !isNavItemLaunchHidden(item.key));

export const RESOURCE_LINK_CONFIG = [
  { key: "docs" as const, href: "https://oddfi.gitbook.io/oddfi-docs-1" },
  { key: "audits" as const, href: "#" },
  { key: "whitepaper" as const, href: "#" },
  { key: "contracts" as const, href: "#" },
];

export const SOCIAL_LINKS = [
  { label: "Twitter", href: "https://x.com/OddFiLabs", icon: "/images/footer/social-twitter.svg" },
  {
    label: "Telegram",
    href: "https://t.me/OddFi_Official",
    icon: "/images/footer/social-telegram.svg",
  },
  { label: "Discord", href: "https://oddfi.io/discord", icon: "/images/footer/social-discord.svg" },
] as const;
