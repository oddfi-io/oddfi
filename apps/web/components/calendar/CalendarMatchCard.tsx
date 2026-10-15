"use client";

/**
 * 单场比赛卡片（Figma `4384:88424` 系列）。
 *
 * 视觉：默认 192×84，左侧 stage 色条（按 stage_id 取自 STAGE_PALETTE）；
 * 内容两行 — Teams `ARG VS PER`（VS 大写 Bold）+ 副标 `{Stage} · M{N}`。
 * pre_open 比赛叠加 🔒 锁标 + cursor: not-allowed。
 *
 * 点击行为：H5（isPhone）→ router.push 跳 fixture 详情页；
 * PC → calendarStore.openMatch 展开右侧详情列；pre_open 短路。
 */
import { LockSimpleIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { SportmonksFixture } from "@/types/api";
import {
  getMarketStatus,
  getStageId,
  getHomeAway,
  getTeamShortCode,
  getFlagSrc,
} from "@/lib/calendar/derivers";
import { MATCH_CARD_HEIGHT, STAGE_PALETTE } from "@/lib/calendar/constants";
import { useCalendarStore, selectOpenMatchId } from "@/stores/calendarStore";
import { useIsPhone } from "@/hooks/useIsPhone";
import type { CSSProperties } from "react";

interface CalendarMatchCardProps {
  fixture: SportmonksFixture;
  /** CSS Grid 派位 style */
  style?: CSSProperties;
  /** 父组件回调 ref，用于 hover popover 计算锚点位置 */
  cardRef?: (el: HTMLButtonElement | null) => void;
  /** 父组件下发的 hover-intent 绑定（mouseEnter/Leave），用于触发 popover */
  hoverProps?: { onMouseEnter: () => void; onMouseLeave: () => void };
  /** 该 fixture 在所属 stage 中的序号（1-indexed） */
  ordinal?: number;
  /** 小组赛时传入组别名（如 "A"），展示为 "Group A" */
  groupName?: string;
}

export default function CalendarMatchCard({
  fixture,
  style,
  cardRef,
  hoverProps,
  ordinal,
  groupName,
}: CalendarMatchCardProps) {
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
  const homeFlagSrc = getFlagSrc(home?.short_code);
  const awayFlagSrc = getFlagSrc(away?.short_code);

  const isOpen = status === "open";
  const isHighlighted = openMatchId === fixture.id;
  const palette = STAGE_PALETTE[stageId];

  const stageLabel =
    stageId === "group" && groupName
      ? t("hover.groupLabel", { name: groupName })
      : t(`stages.${stageId}`);
  const subtitle = ordinal ? `${stageLabel} · M${ordinal}` : stageLabel;

  const ariaLabel = `${home?.name ?? homeCode} versus ${away?.name ?? awayCode}, ${stageLabel}`;

  const handleClick = () => {
    if (!isOpen) return;
    if (isPhone) {
      router.push(`/${locale}/markets/fixture/${fixture.id}`);
    } else {
      openMatch(fixture.id);
    }
  };

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={handleClick}
      onMouseEnter={hoverProps?.onMouseEnter}
      onMouseLeave={hoverProps?.onMouseLeave}
      aria-label={ariaLabel}
      aria-disabled={!isOpen}
      style={{
        ...style,
        height: MATCH_CARD_HEIGHT,
        borderLeftColor: palette.hex,
      }}
      className={`relative m-[4px] rounded-8 border-l-4 text-left flex flex-col justify-center gap-[8px] p-[16px] transition-colors
        ${isHighlighted ? "bg-tertiary" : "bg-secondary"}
        ${!isOpen ? "cursor-not-allowed opacity-90" : "cursor-pointer hover:bg-tertiary"}`}
    >
      {/* Teams row */}
      <div className="flex items-center justify-between gap-[8px]">
        <div className="flex items-center gap-[6px] min-w-0">
          {homeFlagSrc && (
            <img
              src={homeFlagSrc}
              alt={homeCode}
              width={20}
              height={20}
              className="shrink-0 rounded-full"
            />
          )}
          <span className="text-[14px] leading-[19px] font-bold text-primary uppercase truncate">
            {homeCode}
          </span>
        </div>
        <span className="text-[12px] leading-[18px] font-bold text-primary uppercase shrink-0">
          VS
        </span>
        <div className="flex items-center gap-[6px] min-w-0 justify-end">
          <span className="text-[14px] leading-[19px] font-bold text-primary uppercase truncate">
            {awayCode}
          </span>
          {awayFlagSrc && (
            <img
              src={awayFlagSrc}
              alt={awayCode}
              width={20}
              height={20}
              className="shrink-0 rounded-full"
            />
          )}
        </div>
      </div>

      {/* Stage / ordinal line */}
      <div className="text-[12px] leading-[18px] text-secondary truncate">{subtitle}</div>

      {/* Pre-open lock */}
      {!isOpen && (
        <span
          aria-hidden
          className="absolute bottom-[8px] right-[8px] flex items-center justify-center text-tertiary"
        >
          <LockSimpleIcon size={14} weight="fill" />
        </span>
      )}
    </button>
  );
}
