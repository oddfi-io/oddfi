"use client";

/**
 * Calendar 页详情列宿主（DD-091 §3.4）。
 *
 * 复用市场页详情列的纯展示组件 MatchDetailContent，但跳过其内置 useQuery，
 * 直接喂入 calendar mock fixture（已在 useCalendarMatches cache 中）。
 *
 * 行为：
 *   - 读 calendarStore.openMatchId
 *   - 从 useCalendarMatches 命中 fixture
 *   - 关闭按钮 → calendarStore.closeMatch（同步触发 marketsLayoutStore.closeDetail）
 *   - fullPageHref={null} 隐藏全屏链接（Calendar 无独立详情页）
 */
import { useLocale } from "next-intl";
import MatchDetailContent from "@/components/match-detail/MatchDetailContent";
import { useCalendarMatches } from "@/hooks/useCalendarData";
import { useCalendarStore, selectOpenMatchId } from "@/stores/calendarStore";

export default function CalendarDetailPanelHost() {
  const locale = useLocale();
  const openMatchId = useCalendarStore(selectOpenMatchId);
  const closeMatch = useCalendarStore((s) => s.closeMatch);
  const { data: matches = [] } = useCalendarMatches();

  if (openMatchId === null) return null;

  const fixture = matches.find((f) => f.id === openMatchId);
  if (!fixture) {
    // 防御：openMatchId 与现有数据不一致 → 静默清除
    return null;
  }

  return (
    <MatchDetailContent
      fixture={fixture}
      locale={locale}
      onClose={closeMatch}
      fullPageHref={null}
    />
  );
}
