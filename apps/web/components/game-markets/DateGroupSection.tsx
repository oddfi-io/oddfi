"use client";

import { memo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SportmonksFixture } from "@/types/api";
import type { OddsFilter } from "@/types/betting";
import {
  useLayoutState,
  useMarketsLayoutStore,
  selectSelectedFixtureId,
} from "@/stores/marketsLayoutStore";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import MatchCard from "./MatchCard";
import DateGroupHeader from "./DateGroupHeader";

interface DateGroupSectionProps {
  /** 日期分组的本地运营日 key；非日期分组（传 label）可省略 */
  date?: string;
  today?: string;
  fixtures: SportmonksFixture[];
  locale: string;
  oddsFilter?: OddsFilter;
  isTripleOdds?: boolean;
  defaultCollapsed?: boolean;
  /** 非日期分组（如「测试」组）的组头文案；透传给 DateGroupHeader 跳过日期格式化 */
  label?: string;
}

function DateGroupSection({
  date,
  today,
  fixtures,
  locale,
  oddsFilter,
  isTripleOdds,
  defaultCollapsed = false,
  label,
}: DateGroupSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const router = useRouter();
  const layoutState = useLayoutState();
  const mode = useResponsiveMode();
  const selectedFixtureId = useMarketsLayoutStore(selectSelectedFixtureId);
  const selectFixture = useMarketsLayoutStore((s) => s.selectFixture);

  const isDefault = layoutState === "default";

  const handleCardClick = useCallback(
    (fixtureId: number) => {
      if (window.innerWidth >= 1024) {
        selectFixture(fixtureId);
      } else {
        router.push(`/${locale}/markets/fixture/${fixtureId}`);
      }
    },
    [locale, router, selectFixture]
  );

  return (
    <div>
      <DateGroupHeader
        date={date}
        today={today}
        matchCount={fixtures.length}
        isCollapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        label={label}
      />
      {!collapsed && (
        <div
          className="grid gap-[16px] mt-1"
          style={{
            gridTemplateColumns:
              isDefault && fixtures.length > 1
                ? isTripleOdds
                  ? mode === "ultra"
                    ? "repeat(auto-fill, minmax(min(100%, 680px), 1fr))"
                    : "repeat(2, minmax(0, 1fr))"
                  : "repeat(auto-fill, minmax(min(100%, 480px), 1fr))"
                : "minmax(0, 1fr)",
          }}
        >
          {fixtures.map((fixture) => (
            <div
              key={fixture.id}
              style={{ contentVisibility: "auto", containIntrinsicSize: "auto 200px" }}
            >
              <MatchCard
                fixture={fixture}
                locale={locale}
                isSelected={fixture.id === selectedFixtureId}
                compact={mode === "standard" && layoutState === "betslip"}
                tripleOdds={isTripleOdds}
                oddsFilter={oddsFilter}
                onClick={() => handleCardClick(fixture.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(DateGroupSection);
