"use client";

/**
 * Hover Popover — PC 卡片 hover 弹出快速下注卡（DD-091 §3.5(7) +
 * Figma `4697:71536`）。
 *
 * 状态分支：
 *   - market_status=open: 3 个竖排赔率单元格（Figma 4384:88602）
 *   - market_status=pre_open: bg-tertiary 容器 + 短码标签行 + 锁 + 待开盘
 */
import type { CSSProperties } from "react";
import { LockSimpleIcon } from "@phosphor-icons/react";
import type { SportmonksFixture, SportmonksOddsEntry } from "@/types/api";
import type { BetSelection } from "@/types/betting";
import {
  getMarketStatus,
  getStageId,
  getHomeAway,
  getTeamShortCode,
  getFlagSrc,
} from "@/lib/calendar/derivers";
import { formatKickoffInTz, getBrowserTimezone } from "@/lib/calendar/timezone";
import { useTranslations } from "next-intl";
import { useBetSlipStore, selectIsSelected } from "@/stores/betSlipStore";
import { useCalendarStore, selectTzPref } from "@/stores/calendarStore";
import { makeSelectionId } from "@/lib/selection-id";
export type HoverPlacement = "above" | "below";

interface CalendarHoverPopoverProps {
  fixture: SportmonksFixture;
  position: { top: number; left: number; placement: HoverPlacement };
  groupName?: string;
  describedById?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function CalendarHoverPopover({
  fixture,
  position,
  groupName,
  describedById,
  onMouseEnter,
  onMouseLeave,
}: CalendarHoverPopoverProps) {
  const t = useTranslations("calendarPage");
  const tzPref = useCalendarStore(selectTzPref);
  const toggleSelection = useBetSlipStore((s) => s.toggleSelection);

  const status = getMarketStatus(fixture);
  const stageId = getStageId(fixture);
  const { home, away } = getHomeAway(fixture);
  const homeName = home?.name ?? "—";
  const awayName = away?.name ?? "—";
  const homeCode = getTeamShortCode(home);
  const awayCode = getTeamShortCode(away);

  const tz = tzPref === "UTC" ? "UTC" : getBrowserTimezone();
  const { date, hour, minute } = formatKickoffInTz(fixture.starting_at_timestamp, tz);

  const isOpen = status === "open";

  const odds1x2 = fixture.odds.filter((o) => o.market_id === 1);
  const homeOdd = odds1x2.find((o) => o.label === "Home");
  const drawOdd = odds1x2.find((o) => o.label === "Draw");
  const awayOdd = odds1x2.find((o) => o.label === "Away");

  function makeSel(
    entry: SportmonksOddsEntry | undefined,
    displayLabel: string
  ): BetSelection | null {
    if (!entry) return null;
    return {
      id: makeSelectionId(fixture.id, 1, entry.label),
      oddId: entry.id,
      fixtureId: fixture.id,
      fixtureName: fixture.name,
      leagueName: fixture.league?.name ?? fixture.name,
      marketType: "1x2",
      marketDescription: entry.market_description,
      selection: entry.label,
      displayLabel,
      odds: entry.value,
      homeLogo: home?.image_path || undefined,
      awayLogo: away?.image_path || undefined,
    };
  }

  const homeSel = makeSel(homeOdd, homeName);
  const drawSel = makeSel(drawOdd, "Draw");
  const awaySel = makeSel(awayOdd, awayName);

  const homeFlagSrc = getFlagSrc(home?.short_code);
  const awayFlagSrc = getFlagSrc(away?.short_code);

  // hooks 无条件调用
  const isHomeSelected = useBetSlipStore(
    homeOdd ? selectIsSelected(makeSelectionId(fixture.id, 1, "Home")) : () => false
  );
  const isDrawSelected = useBetSlipStore(
    drawOdd ? selectIsSelected(makeSelectionId(fixture.id, 1, "Draw")) : () => false
  );
  const isAwaySelected = useBetSlipStore(
    awayOdd ? selectIsSelected(makeSelectionId(fixture.id, 1, "Away")) : () => false
  );

  const style: CSSProperties = {
    position: "fixed",
    top: position.top,
    left: position.left,
    transform: "translateX(-50%)",
    width: 280,
    zIndex: 50,
  };

  return (
    <div
      role="dialog"
      aria-label={`${homeName} versus ${awayName}`}
      aria-describedby={describedById}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="rounded-8 border border-divider bg-secondary shadow-[0_4px_4px_rgba(0,0,0,0.25)] p-[16px] flex flex-col gap-[16px]"
    >
      {/* Teams + Meta */}
      <div className="flex flex-col gap-[8px]">
        <div className="flex items-center gap-[12px]">
          <div className="flex items-center gap-[8px] min-w-0 flex-1">
            {homeFlagSrc && (
              <img
                src={homeFlagSrc}
                alt={homeName}
                width={20}
                height={20}
                className="shrink-0 rounded-full"
              />
            )}
            <span className="text-[14px] font-bold leading-[180%] text-primary truncate">
              {homeName}
            </span>
          </div>
          <span className="text-[12px] font-bold leading-[180%] text-primary uppercase shrink-0">
            VS
          </span>
          <div className="flex items-center gap-[8px] min-w-0 justify-end flex-1">
            <span className="text-[14px] font-bold leading-[180%] text-primary truncate">
              {awayName}
            </span>
            {awayFlagSrc && (
              <img
                src={awayFlagSrc}
                alt={awayName}
                width={20}
                height={20}
                className="shrink-0 rounded-full"
              />
            )}
          </div>
        </div>

        <div className="text-[12px] font-medium leading-[180%] text-secondary text-center">
          {stageId === "group" && groupName
            ? t("hover.groupLabel", { name: groupName })
            : t(`stages.${stageId}`)}{" "}
          · {date} · {hour}:{minute} {tzPref === "UTC" ? "UTC" : t("hover.local")}
        </div>
      </div>

      {/* 投注区 */}
      {isOpen ? (
        <div className="flex gap-[8px] h-[65px]">
          {(
            [
              { code: homeCode, odd: homeOdd, sel: homeSel, selected: isHomeSelected },
              { code: "Draw", odd: drawOdd, sel: drawSel, selected: isDrawSelected },
              { code: awayCode, odd: awayOdd, sel: awaySel, selected: isAwaySelected },
            ] as const
          ).map(({ code, odd, sel, selected }, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => sel && toggleSelection(sel)}
              className={`flex-[1_0_0] self-stretch rounded-[8px] flex flex-col gap-[6px] items-center justify-center px-[10px] py-[12px] transition-colors ${
                selected ? "bg-fn-brand" : "bg-tertiary"
              }`}
            >
              <span
                className={`text-[12px] font-medium leading-normal ${selected ? "text-static-black" : "text-primary"}`}
              >
                {code}
              </span>
              <span
                className={`text-[14px] font-bold leading-normal ${selected ? "text-static-black" : "text-brand-default"}`}
              >
                {odd?.value ?? "—"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        /* Pre-open — Figma 5034:3736 */
        <div className="bg-tertiary rounded-8 w-full py-[4px]">
          {/* 短码标签行 32px — Figma 5034:3737 */}
          <div className="flex h-[32px] items-center w-full">
            {[homeCode, "Draw", awayCode].map((label, idx) => (
              <div
                key={idx}
                className="flex flex-[1_0_0] h-full items-center justify-center px-[16px] rounded-8"
              >
                <span className="text-[12px] font-medium leading-[18px] text-secondary truncate">
                  {label}
                </span>
              </div>
            ))}
          </div>
          {/* 锁 + 待开盘 — Figma 5034:3741 */}
          <div className="flex items-center justify-center gap-[4px] px-[16px] py-[4px]">
            <LockSimpleIcon size={16} weight="fill" className="text-tertiary" />
            <span className="text-[14px] font-semibold leading-[19px] text-tertiary">
              {t("hover.preOpen")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
