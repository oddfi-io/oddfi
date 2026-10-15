/**
 * Landing §3 AdvantagesSection 6 张 USP 卡片数据（Figma 4227:195229）
 *
 * 图源：设计师统一导出版（v2）—— 已在 Figma 内打包 mask + 染色蒙层 + 卡背景，
 * 6 张图统一为 404×505 满卡尺寸，前端不再叠任何 overlay，直接铺满即可。
 *
 * 已查 ASSETS.md（关键词：uspData / USP_CARDS / advantages / predictionCardData），
 * 无现成 USP 数据模块；新建对齐 §2 predictionCardData.ts 的同源模式。
 */
export interface UspItem {
  id: string;
  imageSrc: string;
  imageAlt: string;
  title: string;
  description: string;
}

export const USP_CARDS: UspItem[] = [
  {
    id: "zero-slippage",
    imageSrc: "/images/landing/advantages/usp-1-v2.png",
    imageAlt: "Zero slippage",
    title: "零滑点",
    description: "固定赔率，所见即所得",
  },
  {
    id: "lending",
    imageSrc: "/images/landing/advantages/usp-2-v2.png",
    imageAlt: "Position lending",
    title: "仓位借贷",
    description: "仓位抵押，提升资金利用率",
  },
  {
    id: "staking",
    imageSrc: "/images/landing/advantages/usp-3-v2.png",
    imageAlt: "Staking dividend",
    title: "质押分润",
    description: "ODD 持有者共享协议收入",
  },
  {
    id: "market-making",
    imageSrc: "/images/landing/advantages/usp-4-v2.png",
    imageAlt: "Open market making",
    title: "人人做市",
    description: "一键注入流动性，分享做市商收益",
  },
  {
    id: "ai-agent",
    imageSrc: "/images/landing/advantages/usp-5-v2.png",
    imageAlt: "AI Agent autonomous betting",
    title: "AI Agent 自主下注",
    description: "从分析预测到记忆复盘，全流程链上闭环",
  },
  {
    id: "no-kyc",
    imageSrc: "/images/landing/advantages/usp-6-v2.png",
    imageAlt: "No KYC required",
    title: "无 KYC",
    description: "连接钱包即可开始，随时出金",
  },
];
