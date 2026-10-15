"use client";

/**
 * 同时段双场紧凑布局（DD-091 §3.5(8) + Figma `4676:135338` + `4676:135354`）。
 *
 * FIFA 反默契规则下小组赛末轮同组 2 场必同时刻同点开球，本组件把两场比赛
 * 水平拼接在同一 grid cell（192×92），每张子卡 96×92。
 */
import type { CSSProperties } from "react";
import { LockSimpleIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import SportIcon from "@/components/ui/SportIcon";
import type { SportmonksFixture } from "@/types/api";
import {
  getMarketStatus,
  getStageId,
  getHomeAway,
  getTeamShortCode,
} from "@/lib/calendar/derivers";
import { STAGE_PALETTE } from "@/lib/calendar/constants";
import { useCalendarStore, selectOpenMatchId } from "@/stores/calendarStore";
import { useIsPhone } from "@/hooks/useIsPhone";

export interface PairSlotBinding {
  cardRef?: (el: HTMLButtonElement | null) => void;
  hoverProps?: { onMouseEnter: () => void; onMouseLeave: () => void };
}

interface CalendarMatchPairProps {
  fixtures: [SportmonksFixture, SportmonksFixture];
  style?: CSSProperties;
  /** 两个子卡的独立 ref + hover binding */
  slotBindings?: [PairSlotBinding, PairSlotBinding];
  /** 两个子卡各自对应的小组名（小组赛时传入） */
  groupNames?: [string | undefined, string | undefined];
}

interface MiniCardProps {
  fixture: SportmonksFixture;
  binding?: PairSlotBinding;
  groupName?: string;
}

function MiniCard({ fixture, binding, groupName }: MiniCardProps) {
  const t = useTranslations("calendarPage");
  const openMatch = useCalendarStore((s) => s.openMatch);
  const openMatchId = useCalendarStore(selectOpenMatchId);
  const isPhone = useIsPhone();
  const router = useRouter();
  const locale = useLocale();

  const status = getMarketStatus(fixture);
  const stageId = getStageId(fixture);
  const { home, away } = getHomeAway(fixture);
  const homeCode = getTeamShortCode(home);
  const awayCode = getTeamShortCode(away);

  const isOpen = status === "open";
  const isHighlighted = openMatchId === fixture.id;

  const stageLabel =
    stageId === "group" && groupName
      ? t("hover.groupLabel", { name: groupName })
      : t(`stages.${stageId}`);

  const ariaLabel = `${home?.name ?? homeCode} versus ${away?.name ?? awayCode}, ${stageLabel}`;

  const handleClick = () => {
    if (!isOpen) return;
    if (isPhone) {
      router.push(`/${locale}/markets/fixture/${fixture.id}`);
    } else {
      openMatch(fixture.id);
    }
  };

  const stageColor = STAGE_PALETTE[stageId]?.hex;

  return (
    <button
      ref={binding?.cardRef}
      type="button"
      onClick={handleClick}
      onMouseEnter={binding?.hoverProps?.onMouseEnter}
      onMouseLeave={binding?.hoverProps?.onMouseLeave}
      aria-label={ariaLabel}
      aria-disabled={!isOpen}
      className={`relative flex flex-col gap-[8px] rounded-8 border-l-4 border-solid bg-secondary px-[16px] py-[8px] text-left transition-colors
        ${isHighlighted ? "ring-1 ring-fn-brand" : ""}
        ${!isOpen ? "cursor-not-allowed opacity-90" : "cursor-pointer"}`}
      style={{ width: 96, height: 92, borderLeftColor: stageColor }}
    >
      <div className="flex flex-col gap-[4px] min-w-0 w-full">
        <div className="flex items-center gap-[8px] min-w-0">
          {home?.image_path && (
            <SportIcon src={home.image_path} alt={homeCode} size={16} withBg={false} />
          )}
          <span className="text-[12px] leading-[18px] font-semibold text-primary truncate">
            {homeCode}
          </span>
        </div>
        <div className="flex items-center gap-[8px] min-w-0">
          {away?.image_path && (
            <SportIcon src={away.image_path} alt={awayCode} size={16} withBg={false} />
          )}
          <span className="text-[12px] leading-[18px] font-semibold text-primary truncate">
            {awayCode}
          </span>
        </div>
      </div>
      <div className="text-[12px] leading-[18px] text-secondary truncate w-full">
        {stageLabel} · ...
      </div>
      {!isOpen && (
        <span aria-hidden className="absolute bottom-[4px] right-[4px] text-tertiary">
          <LockSimpleIcon size={10} weight="fill" />
        </span>
      )}
    </button>
  );
}

export default function CalendarMatchPair({
  fixtures,
  style,
  slotBindings,
  groupNames,
}: CalendarMatchPairProps) {
  return (
    <div role="presentation" style={{ ...style, height: 92 }} className="flex items-stretch">
      <MiniCard fixture={fixtures[0]} binding={slotBindings?.[0]} groupName={groupNames?.[0]} />
      <MiniCard fixture={fixtures[1]} binding={slotBindings?.[1]} groupName={groupNames?.[1]} />
    </div>
  );
}
