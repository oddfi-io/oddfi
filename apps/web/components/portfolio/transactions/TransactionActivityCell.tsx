"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowCounterClockwiseIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  LockSimpleIcon,
  LockSimpleOpenIcon,
  MinusCircleIcon,
  PlusCircleIcon,
  ReceiptIcon,
} from "@phosphor-icons/react";
import type { BusinessType } from "@/types/auth";

// ─── TransactionActivityCell ────────────────────────────────────────────────
// Figma row [1689:82592] — 非下注类 business_type 的 Market 列渲染
// 48px 外容器 + 40px 圆底（rgba(255,255,255,0.08)）+ 20px Phosphor 图标 + 14px 粗体文字
//
// 下注类（single / parlay / cancel_bet / claim_prize）不走此组件，
// 全部用队伍头像 + 比赛信息渲染（event_info 缺失时 Market 列为空）。
// 链上 stake_created / liquidity_deposited 等复用链下同语义图标文案；
// 未收录的新 business_type 走兜底（通用图标 + business_type 人性化文案），杜绝 Market 列空白。

interface ActivityCellEntry {
  icon: typeof ArrowDownIcon;
  labelKey: string;
}

const ACTIVITY_CELL_MAP: Partial<Record<BusinessType, ActivityCellEntry>> = {
  deposit: { icon: ArrowDownIcon, labelKey: "marketDeposited" },
  withdraw: { icon: ArrowUpIcon, labelKey: "marketWithdrew" },
  cancel_withdraw: { icon: ArrowCounterClockwiseIcon, labelKey: "marketCancelWithdraw" },
  stake: { icon: LockSimpleIcon, labelKey: "marketStake" },
  unstake: { icon: LockSimpleOpenIcon, labelKey: "marketUnstake" },
  add_lp: { icon: PlusCircleIcon, labelKey: "marketAddLiquidity" },
  remove_lp: { icon: MinusCircleIcon, labelKey: "marketRemoveLiquidity" },
  // 链上 Stake / Liquidity 流水 — 图标文案与链下同语义类型一致
  stake_created: { icon: LockSimpleIcon, labelKey: "marketStake" },
  stake_withdrawn: { icon: LockSimpleOpenIcon, labelKey: "marketUnstake" },
  liquidity_deposited: { icon: PlusCircleIcon, labelKey: "marketAddLiquidity" },
  liquidity_unbond_requested: { icon: MinusCircleIcon, labelKey: "marketRemoveLiquidity" },
  liquidity_withdrawn: { icon: MinusCircleIcon, labelKey: "marketRemoveLiquidity" },
};

// 下注类（Market 列渲染队伍头像 + 比赛信息，数据来自 event_info）— 不走 ActivityCell。
// ⚠️ 与 lib/adapters/portfolio.ts 的 BET_PLACEMENT_TYPES 语义不同：那边是「按结算状态
// 派生 won/lost 的下注流水」（不含 claim_prize/cancel_bet），这边是「Market 列用比赛信息
// 渲染的行」（含 claim_prize/cancel_bet），不可合并。
const BET_LIKE_TYPES: ReadonlySet<BusinessType> = new Set([
  "single",
  "parlay",
  "banner_single",
  "onchain_single",
  "claim_prize",
  "cancel_bet",
]);

/**
 * 非下注类 → Market 列走 ActivityCell（icon + 文案）。
 * 未收录进 ICON_MAP 的新类型同样返回 true，由组件内兜底渲染——
 * 后端新增 business_type 时最差展示通用图标 + 人性化文案，不再出现空白 Market 列。
 */
export function isNonBetBusinessType(bt: BusinessType): boolean {
  return !BET_LIKE_TYPES.has(bt);
}

/** 兜底文案："liquidity_unbond_requested" → "Liquidity Unbond Requested"（运行时输出英语） */
function humanizeBusinessType(bt: string): string {
  return bt
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

interface TransactionActivityCellProps {
  businessType: BusinessType;
  /** PC 行使用 px-16，H5 卡片由父级自行决定外边距 */
  className?: string;
}

function TransactionActivityCell({ businessType, className = "" }: TransactionActivityCellProps) {
  const t = useTranslations("portfolio");
  const entry = ACTIVITY_CELL_MAP[businessType];
  const Icon = entry?.icon ?? ReceiptIcon;

  return (
    <div className={`flex gap-[16px] items-center ${className}`}>
      {/* 48px 外容器 — 保留与队伍头像列相同的视觉权重 */}
      <div className="relative size-[48px] shrink-0">
        {/* @figma-hardcoded: rgba(255,255,255,0.08) fill/tag/gray — pending design token */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[40px] rounded-full bg-[rgba(255,255,255,0.08)] flex items-center justify-center">
          <Icon size={20} className="text-primary" />
        </div>
      </div>
      <span className="text-[14px] font-semibold text-primary leading-[19px] whitespace-nowrap">
        {entry ? t(entry.labelKey) : humanizeBusinessType(businessType)}
      </span>
    </div>
  );
}

export default memo(TransactionActivityCell);
