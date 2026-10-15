"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import CaretDownIcon from "@/components/icons/CaretDownIcon";
import { useBetSlipStore } from "@/stores/betSlipStore";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { useCurrencyStore } from "@/stores/currencyStore";
import { formatDisplayAmount } from "@/lib/decimal";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";

type OddsValue = "any" | "higher_only" | "none";
type CurrencyValue = "ODD" | "USD";
type OpenMenu = "odds" | "currency" | null;

interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface PreferenceDropdownProps<T extends string> {
  options: ReadonlyArray<DropdownOption<T>>;
  selected: T;
  onSelect: (value: T) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

function PreferenceDropdown<T extends string>({
  options,
  selected,
  onSelect,
  anchorRef,
}: PreferenceDropdownProps<T>) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<"below" | "above">("below");

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const dropdown = dropdownRef.current;
    if (!anchor || !dropdown) return;
    const anchorRect = anchor.getBoundingClientRect();
    const dropdownHeight = dropdown.offsetHeight;
    const gap = 4;
    const margin = 8;
    const spaceBelow = window.innerHeight - anchorRect.bottom - margin;
    const spaceAbove = anchorRect.top - margin;
    if (spaceBelow < dropdownHeight + gap && spaceAbove >= dropdownHeight + gap) {
      setPlacement("above");
    } else {
      setPlacement("below");
    }
  }, [anchorRef, options.length]);

  const positionClass = placement === "above" ? "bottom-full mb-[4px]" : "top-full mt-[4px]";

  return (
    <div
      ref={dropdownRef}
      className={`absolute right-0 ${positionClass} z-20 flex flex-col gap-[4px] p-[4px] rounded-[8px] border border-divider bg-fill-input backdrop-blur-[6.5px] min-w-[130px]`}
      role="listbox"
    >
      {options.map((opt) => {
        const isSelected = opt.value === selected;
        return (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(opt.value)}
            className="flex items-center justify-between gap-[8px] h-[32px] px-[8px] rounded-[8px] w-[122px] hover:bg-fill-hover transition-colors"
          >
            <span
              className={`text-[12px] leading-[18px] font-normal whitespace-nowrap ${
                isSelected ? "text-brand-default" : "text-primary"
              }`}
            >
              {opt.label}
            </span>
            {isSelected && (
              <CheckIcon size={16} weight="bold" className="text-brand-default shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function getOddsLabel(value: OddsValue, t: (key: string) => string): string {
  switch (value) {
    case "any":
      return t("oddsOptionYes");
    case "higher_only":
      return t("oddsOptionBetterOnly");
    case "none":
      return t("oddsOptionNo");
  }
}

function BetSettings() {
  const t = useTranslations("betSlip");
  const settings = useBetSlipStore((s) => s.settings);
  const updateSettings = useBetSlipStore((s) => s.updateSettings);
  const setSettingsOpen = useBetSlipStore((s) => s.setSettingsOpen);
  const { currency, rate } = useCurrencyDisplay();
  const setCurrency = useCurrencyStore((s) => s.setCurrency);

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const oddsTriggerRef = useRef<HTMLButtonElement>(null);
  const currencyTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openMenu]);

  const oddsOptions: ReadonlyArray<DropdownOption<OddsValue>> = [
    { value: "any", label: t("oddsOptionYes") },
    { value: "higher_only", label: t("oddsOptionBetterOnly") },
    { value: "none", label: t("oddsOptionNo") },
  ];

  const currencyOptions: ReadonlyArray<DropdownOption<CurrencyValue>> = [
    { value: "ODD", label: PLATFORM_TOKEN_DISPLAY },
    { value: "USD", label: "USD" },
  ];

  const rateText = rate ? formatDisplayAmount(rate, 2) : "...";

  const handleSelectOdds = (value: OddsValue) => {
    updateSettings({ oddsAcceptance: value });
    setOpenMenu(null);
  };

  const handleSelectCurrency = (value: CurrencyValue) => {
    setCurrency(value);
    setOpenMenu(null);
  };

  return (
    <div ref={rootRef} className="flex flex-col gap-[32px] h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="text-primary text-[24px] leading-[32px] font-bold"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: "-0.24px",
          }}
        >
          Preferences
        </h2>
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center -mr-[12px]"
          onClick={() => setSettingsOpen(false)}
          aria-label="Close preferences"
        >
          <XIcon size={20} className="text-secondary" />
        </button>
      </div>

      {/* Setting items */}
      <div className="flex flex-col gap-[24px]">
        {/* Accept odds change */}
        <div className="flex flex-col gap-[8px]">
          <div className="relative">
            <button
              ref={oddsTriggerRef}
              type="button"
              onClick={() => setOpenMenu(openMenu === "odds" ? null : "odds")}
              aria-haspopup="listbox"
              aria-expanded={openMenu === "odds"}
              className="bg-secondary rounded-full p-[16px] flex items-center justify-between w-full min-h-[44px] transition-colors hover:bg-fill-hover"
            >
              <span className="text-primary text-[16px] font-bold">{t("oddsChanges")}</span>
              <div className="flex gap-[4px] items-center">
                <span className="text-brand-default text-[16px] font-bold">
                  {getOddsLabel(settings.oddsAcceptance, t)}
                </span>
                <CaretDownIcon size={20} className="text-brand-default" />
              </div>
            </button>
            {openMenu === "odds" && (
              <PreferenceDropdown
                options={oddsOptions}
                selected={settings.oddsAcceptance}
                onSelect={handleSelectOdds}
                anchorRef={oddsTriggerRef}
              />
            )}
          </div>
          <p className="text-secondary text-[12px] font-normal leading-[18px] px-[4px]">
            You can accelerate the pace of placing your bet by accepting odds changes.
          </p>
        </div>

        {/* Currency */}
        <div className="flex flex-col gap-[8px]">
          <div className="relative">
            <button
              ref={currencyTriggerRef}
              type="button"
              onClick={() => setOpenMenu(openMenu === "currency" ? null : "currency")}
              aria-haspopup="listbox"
              aria-expanded={openMenu === "currency"}
              className="bg-secondary rounded-full p-[16px] flex items-center justify-between w-full min-h-[44px] transition-colors hover:bg-fill-hover"
            >
              <span className="text-primary text-[16px] font-bold">{t("currency")}</span>
              <div className="flex gap-[4px] items-center">
                <span className="text-brand-default text-[16px] font-bold">
                  {currency === "ODD" ? PLATFORM_TOKEN_DISPLAY : "USD"}
                </span>
                <CaretDownIcon size={20} className="text-brand-default" />
              </div>
            </button>
            {openMenu === "currency" && (
              <PreferenceDropdown
                options={currencyOptions}
                selected={currency}
                onSelect={handleSelectCurrency}
                anchorRef={currencyTriggerRef}
              />
            )}
          </div>
          <p className="text-secondary text-[12px] font-normal leading-[18px] px-[4px]">
            {`1 ${PLATFORM_TOKEN_DISPLAY} ≈ $${rateText} USD`}
          </p>
        </div>
      </div>
    </div>
  );
}

export default memo(BetSettings);
