"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { getMarketFixtureDetail } from "@/lib/api";
import {
  deriveRecommendedSelection,
  deriveSelectionForPick,
  sortPicksByConfidence,
  type AnalysisPick,
} from "@/lib/betting/recommend-selection";
import { tagClasses } from "@/lib/bet-tag-classes";
import { cn } from "@/lib/utils";
import { RecommendationBetCard } from "./RecommendationBetCard";

/**
 * DD-120 / DD-136：AI 聊天内推荐卡的容器型组件。
 *
 * 按 matchId 客户端拉单场详情（复用 BetCard 同款 query key `["market-fixture", id, locale]`
 * → 共享缓存），再交给展示型 RecommendationBetCard。
 *
 * DD-136 W3 多卡模式：`picks`（LLM 结构化推荐）存在时按置信度降序渲染至多 3 张玩法卡
 * （1×2 / 亚洲让球 / 亚洲大小球）。置信度仅用于排序不展示（用户验收反馈：表述不佳）；
 * 一句话解读（reason）做成统一色小标签（复用 tagClasses("market")，与 Portfolio/BetSlip 同款）。
 * 该玩法当前无盘 → 渲染「赔率待开」占位卡。picks 缺失 / 解析失败 → 回落 DD-120 单卡。
 *
 * 渲染策略（DD-120 验收，保持不变）：
 *   - query pending / error / 无 fixture → 静默不渲染（拉不到比赛 = 不占位）
 *   - fixture 拿到但无可下注赔率 → 「赔率待开」占位卡（selection=null）
 */

export function ChatRecommendationCard({
  matchId,
  picks,
}: {
  matchId: string;
  picks?: AnalysisPick[];
}) {
  const locale = useLocale();
  const t = useTranslations("markets");
  const fixtureId = Number(matchId);
  const { data: fixture } = useQuery({
    queryKey: ["market-fixture", fixtureId, locale],
    // 与 BetCard 同 query key 共享缓存；空数组返回 null（非 undefined，React Query v5 禁止 queryFn 返 undefined）
    queryFn: () =>
      getMarketFixtureDetail(fixtureId, "statis", { locale }).then((arr) => arr?.[0] ?? null),
    staleTime: 60_000,
    enabled: Number.isFinite(fixtureId) && fixtureId > 0,
  });

  if (!fixture) return null;

  // DD-136 多卡模式：LLM picks → 按置信度降序的三玩法卡
  if (picks && picks.length > 0) {
    const marketLabel: Record<AnalysisPick["market"], string> = {
      "1x2": "1×2",
      asian_handicap: t("asianHandicap"),
      asian_total: t("asianTotal"),
    };
    return (
      <div className="flex w-full flex-col">
        {sortPicksByConfidence(picks).map((pick) => (
          <div key={pick.market} data-market={pick.market}>
            <div className="mt-[12px] flex flex-wrap items-center gap-[8px]">
              <span className="text-[13px] font-semibold text-primary">
                {marketLabel[pick.market]}
              </span>
              {pick.reason && (
                <span
                  className={cn(
                    "max-w-full truncate rounded px-[6px] py-[1px] text-[11px] font-medium leading-[16px]",
                    tagClasses("market")
                  )}
                >
                  {pick.reason}
                </span>
              )}
            </div>
            <RecommendationBetCard
              fixture={fixture}
              selection={deriveSelectionForPick(fixture, pick)?.sel ?? null}
            />
          </div>
        ))}
        <p className="mt-[8px] text-[11px] leading-[16px] text-tertiary">
          * AI 推荐仅供参考，不构成投注建议，请理性投注
        </p>
      </div>
    );
  }

  // DD-120 单卡兜底：有赔率 → 完整推荐；无赔率 → 「赔率待开」占位（selection=null）
  const rec = deriveRecommendedSelection(fixture);
  return <RecommendationBetCard fixture={fixture} selection={rec?.sel ?? null} />;
}
