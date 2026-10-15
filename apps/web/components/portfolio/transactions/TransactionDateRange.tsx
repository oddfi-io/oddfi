"use client";

import { memo, useState, useEffect } from "react";
import { addDays, addMonths, addYears, format } from "date-fns";
import { enUS, zhCN, de, es, fr, hi, ja, pt, tr } from "date-fns/locale";
import type { Locale as DfnsLocale } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarBlankIcon, XIcon } from "@phosphor-icons/react";
import { useTranslations, useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { useIsPhone } from "@/hooks/useIsPhone";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import ArrowRightIcon from "@/components/icons/ArrowRightIcon";

interface Props {
  beginDate?: string; // YYYY-MM-DD
  endDate?: string;
  onChange: (v: { beginDate?: string; endDate?: string }) => void;
}

// @figma-hardcoded: #111114 popover-bg / trigger-bg — pending design token

const LOCALE_MAP: Record<string, DfnsLocale> = {
  en: enUS,
  zh: zhCN,
  de,
  es,
  fr,
  hi,
  ja,
  pt,
  tr,
};

function strToDate(s?: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  // local midnight to avoid UTC offset issues
  return new Date(y, m - 1, d);
}

function dateToStr(d?: Date): string | undefined {
  if (!d) return undefined;
  return format(d, "yyyy-MM-dd");
}

const PRESET_KEYS = ["today", "7d", "30d", "6mo", "12mo"] as const;
type PresetKey = (typeof PRESET_KEYS)[number];

function getPresetRange(key: PresetKey): DateRange {
  const now = new Date();
  switch (key) {
    case "today":
      return { from: now, to: now };
    case "7d":
      return { from: addDays(now, -7), to: now };
    case "30d":
      return { from: addDays(now, -30), to: now };
    case "6mo":
      return { from: addMonths(now, -6), to: now };
    case "12mo":
      return { from: addYears(now, -1), to: now };
  }
}

function TransactionDateRange({ beginDate, endDate, onChange }: Props) {
  const t = useTranslations("portfolio");
  const locale = useLocale();
  const dfnsLocale = LOCALE_MAP[locale] ?? enUS;
  const isPhone = useIsPhone();
  const PRESET_LABEL_KEYS: Record<PresetKey, string> = {
    today: t("datePresetToday"),
    "7d": t("datePreset7d"),
    "30d": t("datePreset30d"),
    "6mo": t("datePreset6mo"),
    "12mo": t("datePreset12mo"),
  };
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined);
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);

  // Sync draft state when popover opens
  useEffect(() => {
    if (open) {
      setDraftRange({ from: strToDate(beginDate), to: strToDate(endDate) });
      setActivePreset(null);
    }
  }, [open, beginDate, endDate]);

  const active = Boolean(beginDate || endDate);

  function applyRange(range: DateRange | undefined) {
    onChange({
      beginDate: dateToStr(range?.from),
      endDate: dateToStr(range?.to),
    });
  }

  function handlePreset(key: PresetKey) {
    const range = getPresetRange(key);
    setDraftRange(range);
    setActivePreset(key);
    applyRange(range);
    setOpen(false);
  }

  function handleApply() {
    applyRange(draftRange);
    setOpen(false);
  }

  function handleReset() {
    setDraftRange(undefined);
    setActivePreset(null);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange({ beginDate: undefined, endDate: undefined });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          style={{ touchAction: "manipulation" }}
          className="flex items-center gap-[8px] h-[44px] px-[12px] rounded-12 bg-[#111114] border-[0.5px] border-secondary min-h-[44px]"
        >
          <CalendarBlankIcon size={16} className="text-secondary shrink-0 hidden lg:block" />
          <span
            className={cn(
              "text-[13px] font-normal leading-[19px] whitespace-nowrap",
              beginDate ? "text-primary" : "text-tertiary"
            )}
          >
            {beginDate || t("datePlaceholder")}
          </span>
          <ArrowRightIcon className="text-secondary shrink-0" />
          <span
            className={cn(
              "text-[13px] font-normal leading-[19px] whitespace-nowrap",
              endDate ? "text-primary" : "text-tertiary"
            )}
          >
            {endDate || t("datePlaceholder")}
          </span>
          {active && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date range"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  handleClear(e as unknown as React.MouseEvent);
              }}
              className="ml-[2px] flex items-center text-tertiary hover:text-primary"
            >
              <XIcon size={14} />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="p-0 w-auto" align="start">
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-divider">
          {/* Shortcut presets — horizontal scroll on mobile, vertical list on desktop */}
          <div className="flex flex-row sm:flex-col gap-[4px] p-[12px] overflow-x-auto sm:overflow-visible sm:w-[132px]">
            {PRESET_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => handlePreset(key)}
                style={{ touchAction: "manipulation" }}
                className={cn(
                  "flex-shrink-0 sm:flex-shrink text-left px-[10px] py-[7px] rounded-8 text-[13px] whitespace-nowrap sm:whitespace-normal transition-colors min-h-[36px]",
                  activePreset === key
                    ? "bg-fn-brand/20 text-fn-brand"
                    : "text-secondary hover:text-primary hover:bg-fill-input"
                )}
              >
                {PRESET_LABEL_KEYS[key]}
              </button>
            ))}
          </div>

          {/* Calendar + action row */}
          <div className="flex flex-col">
            <Calendar
              mode="range"
              selected={draftRange}
              onSelect={(range) => {
                setDraftRange(range);
                setActivePreset(null);
              }}
              numberOfMonths={isPhone ? 1 : 2}
              defaultMonth={draftRange?.from ?? new Date()}
              locale={dfnsLocale}
            />

            {/* Apply / Reset */}
            <div className="flex gap-[8px] px-[16px] pb-[14px]">
              <button
                onClick={handleReset}
                style={{ touchAction: "manipulation" }}
                className="flex-1 h-[36px] rounded-8 border-[0.5px] border-secondary text-[13px] text-secondary hover:text-primary transition-colors"
              >
                {t("dateReset")}
              </button>
              <button
                onClick={handleApply}
                style={{ touchAction: "manipulation" }}
                className="flex-1 h-[36px] rounded-8 bg-fn-brand text-[13px] text-static-black font-medium"
              >
                {t("dateApply")}
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default memo(TransactionDateRange);
