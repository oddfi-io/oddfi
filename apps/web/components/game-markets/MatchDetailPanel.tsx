"use client";

/**
 * 市场页详情列 wrapper（DD-091 §3.4 重构后）。
 *
 * 行为说明：
 *   - 内部用 useQuery 拉 SportmonksFixture（refetchInterval=15s）
 *   - 渲染层全部委托 `MatchDetailContent`
 *   - Calendar 等其他场景请直接用 `MatchDetailContent`，不要走此 wrapper
 *
 * 重构红线：保持 props (`fixtureId: number`) 与外部 API 完全一致；视觉与行为零变化。
 */
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { getMarketFixtureDetail } from "@/lib/api";
import { useMarketsLayoutStore } from "@/stores/marketsLayoutStore";
import MatchDetailContent from "@/components/match-detail/MatchDetailContent";

// ─── Re-exports（DD-091 §3.4：保持 MatchHeader 既有 import 路径不动） ────────
export {
  STAT_CATEGORIES,
  STAT_ICONS,
  getStatValue,
} from "@/components/match-detail/MatchDetailContent";

// ─── Skeleton ──────────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <div className="bg-primary border border-DEFAULT rounded-16 px-[16px] py-[24px] flex flex-col gap-[24px]">
      <div className="flex items-center justify-between">
        <div className="h-[26px] w-[200px] rounded bg-white/10 animate-pulse" />
        <div className="size-[24px] rounded-8 bg-white/10 animate-pulse" />
      </div>
      <div className="h-[217px] rounded-12 bg-white/5 animate-pulse" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-16 overflow-hidden">
          <div className="bg-secondary h-[48px] flex items-center px-[16px]">
            <div className="h-[19px] w-[80px] rounded bg-white/10 animate-pulse" />
          </div>
          <div className="bg-secondary p-[16px] flex gap-[16px]">
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex-1 h-[40px] rounded-8 bg-white/10 animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

interface MatchDetailPanelProps {
  fixtureId: number;
}

export default function MatchDetailPanel({ fixtureId }: MatchDetailPanelProps) {
  const locale = useLocale();
  const t = useTranslations("markets");
  const closeDetail = useMarketsLayoutStore((s) => s.closeDetail);

  const {
    data: fixture,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["market-fixture", fixtureId, locale],
    queryFn: () => getMarketFixtureDetail(fixtureId, "statis", { locale }).then((arr) => arr?.[0]),
    enabled: fixtureId > 0,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  if (isLoading) return <PanelSkeleton />;

  if (isError || !fixture) {
    return (
      <div className="bg-primary border border-DEFAULT rounded-16 px-[16px] py-[24px]">
        <div className="rounded-12 bg-secondary px-6 py-10 text-center text-secondary text-sm">
          {t("loadError")}
        </div>
      </div>
    );
  }

  return <MatchDetailContent fixture={fixture} locale={locale} onClose={closeDetail} />;
}
