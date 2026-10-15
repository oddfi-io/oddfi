"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LightningIcon, PencilLineIcon } from "@phosphor-icons/react";

import NumberInput from "@/components/ui/NumberInput";
import SportIcon from "@/components/ui/SportIcon";
import { runBetClick } from "@/hooks/useBetSelectionToggle";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { useBetSlipStore, selectIsSelected } from "@/stores/betSlipStore";
import { formatDisplayAmount, mul } from "@/lib/decimal";
import { getTeam } from "@/lib/match-utils";
import type { SportmonksFixture } from "@/types/api";
import type { BetSelection } from "@/types/betting";

/**
 * DD-122：AI 聊天 / 新闻内的「推荐下注卡片」V2（按 Figma 7235:127437 还原）。
 *
 * 三段式：
 *   ① 队伍 PK 头（home / VS+时间 / away）—— 队伍名 break-words 多行展示
 *   ② 玩法 + 赔率两列（1X2 自动补「胜」后缀）
 *   ③ 推荐金额（点击切 NumberInput）+ 预计收益
 *   ④ 全宽「下注」按钮 → addSelection + 写入用户金额，betslip 自动打开
 *
 * 前向兼容硬约束：只读 `selection` + `fixture.participants`，**绝不直读 `fixture.odds`**。
 */

/** 默认推荐金额（ODD），可由用户在 ③ 处修改。 */
const DEFAULT_STAKE_ODD = 100;

function formatKickoff(startingAt: string): string {
  const d = new Date(startingAt);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}

export function RecommendationBetCard({
  fixture,
  selection,
}: {
  fixture: SportmonksFixture;
  selection: BetSelection | null;
}) {
  const t = useTranslations("markets");
  const isSelected = useBetSlipStore(selection ? selectIsSelected(selection.id) : () => false);
  const setAmount = useBetSlipStore((s) => s.setAmount);
  const { canConvert, convert } = useCurrencyDisplay();

  const [stakeOdd, setStakeOdd] = useState<number>(DEFAULT_STAKE_ODD);
  const [isEditing, setIsEditing] = useState(false);

  const home = getTeam(fixture, "home");
  const away = getTeam(fixture, "away");

  const stakeOddStr = String(stakeOdd || DEFAULT_STAKE_ODD);

  // selection 文案标准化（业界实践：betslip 上下文显示语义后缀）
  const pickLabel = selection
    ? selection.selection === "Draw"
      ? t("draw")
      : selection.selection === "Over" && selection.total
        ? t("overLine", { line: selection.total })
        : selection.selection === "Under" && selection.total
          ? t("underLine", { line: selection.total })
          : selection.selection === "Home" && home
            ? selection.handicap
              ? `${home.name} ${selection.handicap}`
              : `${home.name} ${t("win")}`
            : selection.selection === "Away" && away
              ? selection.handicap
                ? `${away.name} ${selection.handicap}`
                : `${away.name} ${t("win")}`
              : selection.displayLabel
    : null;

  // 预计收益按当前 stake 实时计算
  const payout = selection ? formatDisplayAmount(mul(stakeOddStr, selection.odds), 0) : null;

  const handleBet = (e: React.MouseEvent) => {
    if (!selection) return;
    // add 模式：重复点击不会移除 selection（避免 AI 推荐"再点一次清空"的反直觉）
    runBetClick(e, selection, "add", fixture.enable_bet ?? true);
    // betslip store 内 amounts 存 display unit；canConvert 时把 ODD 折成 USD
    const displayAmount = canConvert ? convert(stakeOddStr) : stakeOddStr;
    setAmount(selection.id, displayAmount);
  };

  return (
    <div className="mt-[8px] flex w-full flex-col gap-[12px] rounded-2xl border border-divider bg-secondary p-[16px]">
      {/* ① 队伍 PK 头 — break-words 允许长队名换行 */}
      <div className="flex w-full items-start gap-[12px]">
        <div className="flex min-w-0 flex-1 items-start justify-end gap-[8px]">
          <SportIcon src={home?.image_path ?? ""} withBg className="size-[24px] shrink-0" />
          <span className="text-[14px] font-medium text-primary break-words text-right">
            {home?.name ?? "—"}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-center text-tertiary">
          <span className="text-[14px] italic font-medium leading-[18px]">VS</span>
          <span className="text-[12px] leading-[18px]">{formatKickoff(fixture.starting_at)}</span>
        </div>
        <div className="flex min-w-0 flex-1 items-start justify-start gap-[8px]">
          <SportIcon src={away?.image_path ?? ""} withBg className="size-[24px] shrink-0" />
          <span className="text-[14px] font-medium text-primary break-words">
            {away?.name ?? "—"}
          </span>
        </div>
      </div>

      {/* ② 玩法 + 赔率 */}
      <div className="flex items-start justify-between gap-[12px]">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[12px] leading-[18px] text-secondary">玩法</span>
          <span className="text-[14px] font-medium text-primary break-words">
            {pickLabel ?? "—"}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-[12px] leading-[18px] text-secondary">赔率</span>
          <span className="text-[14px] font-medium text-brand-default">
            {selection ? `x${selection.odds}` : "—"}
          </span>
        </div>
      </div>

      {/* ③ 推荐金额（点击切 NumberInput）+ 预计收益 */}
      <div className="flex flex-col gap-[8px] rounded-lg bg-tertiary px-[12px] py-[8px]">
        <div className="flex items-center justify-between gap-[8px]">
          <span className="text-[12px] leading-[18px] text-tertiary">推荐金额</span>
          {isEditing ? (
            <div className="flex items-center gap-[6px]">
              <NumberInput
                value={stakeOdd}
                onChange={(n) => setStakeOdd(n)}
                integerOnly
                min={1}
                ariaLabel="推荐金额"
                className="h-[28px] w-[88px] bg-secondary px-[8px] text-right text-[14px]"
              />
              <span className="text-[14px] font-semibold leading-[18px] text-primary">ODD</span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-[12px] font-medium leading-[18px] text-brand-default"
              >
                完成
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-[2px] text-[14px] font-semibold leading-[18px] text-primary"
            >
              {formatDisplayAmount(stakeOddStr, 0)} ODD
              <PencilLineIcon size={16} className="text-tertiary" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] leading-[18px] text-tertiary">预计收益</span>
          <span
            className="bg-clip-text text-[14px] font-semibold leading-[18px] text-transparent"
            // @figma-hardcoded: linear-gradient(161.5deg, #4AE7DD 42%, #EAEA32 92%) payout-gradient — pending design token
            style={{
              backgroundImage: "linear-gradient(161.5deg, #4AE7DD 42.267%, #EAEA32 91.863%)",
            }}
          >
            {payout ?? "—"} ODD
          </span>
        </div>
      </div>

      {/* ④ 全宽「下注」按钮 */}
      {selection ? (
        <button
          type="button"
          onClick={handleBet}
          aria-pressed={isSelected}
          style={{ touchAction: "manipulation" }}
          className="flex h-[40px] w-full items-center justify-center gap-[8px] rounded-lg bg-btn-primary text-[14px] font-medium text-static-black transition-colors hover:bg-btn-primary-hover"
        >
          <LightningIcon size={20} weight="fill" />
          下注
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="flex h-[40px] w-full cursor-not-allowed items-center justify-center gap-[8px] rounded-lg bg-btn-secondary text-[14px] font-medium text-tertiary"
        >
          赔率待开
        </button>
      )}
    </div>
  );
}
