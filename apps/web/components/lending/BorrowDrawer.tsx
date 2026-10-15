"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { borrowFromPosition } from "@/lib/api";
import { IS_SUBSCRIPTION_MODE } from "@/lib/subscription-mode";
import { mul, formatAmount } from "@/lib/decimal";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import MobileBottomSheet from "@/components/ui/MobileBottomSheet";
import Modal from "@/components/ui/Modal";
import TeamAvatarPair from "@/components/lending/TeamAvatarPair";
import type { CollateralPosition } from "@/types/lending";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BorrowDrawerProps {
  open: boolean;
  onClose: () => void;
  position: CollateralPosition;
}

// ─── Slider percentages ──────────────────────────────────────────────────────
const SLIDER_MARKS = [0, 25, 50, 75, 100] as const;

// ─── Slider ───────────────────────────────────────────────────────────────────

interface SliderWithMarksProps {
  value: number; // 0-100
  onChange: (pct: number) => void;
}

function SliderWithMarks({ value, onChange }: SliderWithMarksProps) {
  const filledWidth = `${value}%`;

  return (
    <div className="flex flex-col gap-[7px]">
      {/* Track + thumb */}
      <div className="relative h-[16px]">
        {/* Background track */}
        <div className="absolute left-0 right-0 top-[6px] h-[4px] rounded-full bg-fill-slider" />
        {/* Filled track — brand-default (mint) */}
        <div
          className="absolute left-0 top-[6px] h-[4px] rounded-full bg-btn-primary transition-all"
          style={{ width: filledWidth }}
        />
        {/* Native range input — invisible but interactive */}
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          style={{ touchAction: "manipulation" }}
        />
        {/* Thumb dot — brand-default (mint) */}
        <div
          className="absolute top-0 size-[16px] rounded-full bg-btn-primary shadow-sm pointer-events-none transition-all z-10"
          style={{ left: `calc(${filledWidth} - 8px)` }}
        />
        {/* Mark dots at 25/50/75 */}
        {SLIDER_MARKS.slice(1, 4).map((pct) => (
          <div
            key={pct}
            className="absolute top-[4px] size-[8px] rounded-full pointer-events-none"
            style={{
              left: `calc(${pct}% - 4px)`,
              backgroundColor:
                pct <= value ? "var(--btn-primary-brand-default)" : "var(--fill-slider)",
            }}
          />
        ))}
      </div>

      {/* Percentage labels */}
      <div className="relative h-[18px] text-[12px] leading-[18px] text-tertiary font-normal">
        {SLIDER_MARKS.map((pct) => (
          <span
            key={pct}
            className="absolute -translate-x-1/2 -translate-y-1/2 top-[9px]"
            style={{ left: pct === 0 ? "9px" : pct === 100 ? "calc(100% - 9px)" : `${pct}%` }}
          >
            {pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[14px] leading-[19px] text-secondary font-normal">{label}</span>
      <span className="text-[14px] leading-[19px] text-primary font-medium">{value}</span>
    </div>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

interface BorrowContentProps {
  position: CollateralPosition;
  inputValue: string;
  sliderPct: number;
  isPending: boolean;
  onInputChange: (val: string) => void;
  onSliderChange: (pct: number) => void;
  onMax: () => void;
  onConfirm: () => void;
}

function BorrowContent({
  position,
  inputValue,
  sliderPct,
  isPending,
  onInputChange,
  onSliderChange,
  onMax,
  onConfirm,
}: BorrowContentProps) {
  const t = useTranslations("lending");
  const { format } = useCurrencyDisplay();
  const creditLimit = position.creditLimit ?? 0;
  const earned = mul(String(position.principal), String(position.returnMultiplier));
  const parsedAmount = parseFloat(inputValue) || 0;
  const hasAmount = parsedAmount > 0 && parsedAmount <= creditLimit;
  const usagePct = creditLimit > 0 ? (parsedAmount / creditLimit) * 100 : 0;

  const creditExpires = position.matchDate;

  return (
    <div className="flex flex-col gap-[24px]">
      {/* ── Position info ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-[16px]">
        <div className="flex flex-col gap-[20px]">
          {/* Team + match title */}
          <div className="flex gap-[8px] items-center">
            <TeamAvatarPair
              homeTeamLogo={position.homeTeamLogo}
              awayTeamLogo={position.awayTeamLogo}
              size={36}
            />
            <div className="flex flex-col gap-[2px] flex-1 min-w-0">
              <span className="text-[12px] md:text-[14px] leading-[19px] text-secondary font-normal">
                {t("collateralPosition")}
              </span>
              <span className="text-[14px] md:text-[16px] leading-[24px] text-primary font-bold truncate">
                {position.matchTitle}
              </span>
            </div>
          </div>

          {/* Bet principal + earned */}
          <div className="flex gap-[12px]">
            <div className="flex-1 flex flex-col gap-[4px]">
              <span className="text-[12px] leading-[18px] text-secondary font-normal">
                {t("betPrincipal")}
              </span>
              <span className="text-[14px] leading-[19px] text-primary font-semibold">
                {format(String(position.principal))}
              </span>
            </div>
            <div className="flex-1 flex flex-col gap-[4px]">
              <span className="text-[12px] leading-[18px] text-secondary font-normal">
                {t("earnedSoFar")}
              </span>
              <span className="text-[14px] leading-[19px] text-fn-green font-semibold">
                {format(earned)}
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px" style={{ background: "var(--line-border-secondary)" }} />
      </div>

      {/* ── Borrow amount input ───────────────────────────────────────── */}
      <div className="flex flex-col gap-[12px]">
        <div className="flex items-center">
          <span className="text-[14px] leading-[19px] text-secondary font-normal">
            {t("borrowAmount")}
          </span>
        </div>

        {/* Input row */}
        {/* @figma-hardcoded: #1c1c1f input-bg — pending design token */}
        <div className="flex items-center justify-between h-[48px] px-[12px] rounded-8 bg-[#1c1c1f]">
          <input
            type="number"
            inputMode="decimal"
            value={inputValue}
            placeholder="0"
            onChange={(e) => onInputChange(e.target.value)}
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[14px] leading-[19px] font-medium
                       text-primary placeholder:text-tertiary [appearance:textfield]
                       [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            style={{ touchAction: "manipulation" }}
          />
          <div className="flex gap-[8px] items-center shrink-0">
            <span className="text-[14px] leading-[19px] text-primary font-normal">
              {PLATFORM_TOKEN_DISPLAY}
            </span>
            <button
              onClick={onMax}
              className="text-[14px] leading-[19px] font-normal px-1 flex items-center"
              style={{ touchAction: "manipulation" }}
              aria-label="Set max borrow amount"
            >
              <span className="text-brand-default">MAX</span>
            </button>
          </div>
        </div>

        {/* Slider */}
        <SliderWithMarks value={sliderPct} onChange={onSliderChange} />
      </div>

      {/* ── Info rows ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-[12px]">
        <InfoRow
          label={t("usage")}
          value={`${formatAmount(usagePct, 0)}% (${formatAmount(parsedAmount)} ${PLATFORM_TOKEN_DISPLAY})`}
        />
        <InfoRow label={t("creditExpires")} value={creditExpires} />
        <InfoRow label={t("fee")} value={t("free")} />
        <InfoRow label={t("repayment")} value={t("autoDeducted")} />
      </div>

      {/* ── CTA button — DD-113 认购模式强制 disabled ──────────────── */}
      <button
        onClick={hasAmount && !IS_SUBSCRIPTION_MODE ? onConfirm : undefined}
        disabled={!hasAmount || isPending || IS_SUBSCRIPTION_MODE}
        className="w-full h-[48px] rounded-12 flex items-center justify-center
                   text-[14px] leading-[19px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.1)]
                   transition-opacity
                   bg-btn-primary-white text-static-black
                   disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ touchAction: "manipulation" }}
      >
        {isPending ? t("borrowing") : t("enterAmount")}
      </button>
    </div>
  );
}

// ─── BorrowDrawer ─────────────────────────────────────────────────────────────

export default function BorrowDrawer({ open, onClose, position }: BorrowDrawerProps) {
  const t = useTranslations("lending");
  const mode = useResponsiveMode();
  const queryClient = useQueryClient();

  const [inputValue, setInputValue] = useState("");
  const [sliderPct, setSliderPct] = useState(0);

  const creditLimit = position.creditLimit ?? 0;

  // ── Reset state on open ──
  const prevOpen = useRef(open);
  if (prevOpen.current !== open) {
    prevOpen.current = open;
    if (open) {
      setInputValue("");
      setSliderPct(0);
    }
  }

  // ── Mutation ──
  const borrowMutation = useMutation({
    mutationFn: () => borrowFromPosition(position.id, parseFloat(inputValue)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lending", "positions"] });
      queryClient.invalidateQueries({ queryKey: ["lending", "borrows"] });
      onClose();
    },
    onError: (error) => {
      console.error("[BorrowDrawer] Failed to borrow from position —", error);
    },
  });

  // ── Handlers ──
  const handleInputChange = useCallback(
    (val: string) => {
      setInputValue(val);
      const num = parseFloat(val);
      if (!isNaN(num) && creditLimit > 0) {
        const pct = Math.min(100, Math.max(0, (num / creditLimit) * 100));
        setSliderPct(Math.round(pct));
      } else {
        setSliderPct(0);
      }
    },
    [creditLimit]
  );

  const handleSliderChange = useCallback(
    (pct: number) => {
      setSliderPct(pct);
      if (creditLimit > 0) {
        const amount = mul(String(pct / 100), String(creditLimit));
        setInputValue(formatAmount(amount));
      }
    },
    [creditLimit]
  );

  const handleMax = useCallback(() => {
    setSliderPct(100);
    setInputValue(formatAmount(creditLimit));
  }, [creditLimit]);

  const handleConfirm = useCallback(() => {
    borrowMutation.mutate();
  }, [borrowMutation]);

  // ── Shared content props ──
  const contentProps: BorrowContentProps = {
    position,
    inputValue,
    sliderPct,
    isPending: borrowMutation.isPending,
    onInputChange: handleInputChange,
    onSliderChange: handleSliderChange,
    onMax: handleMax,
    onConfirm: handleConfirm,
  };

  // ── H5: MobileBottomSheet ──
  if (mode === "h5") {
    return (
      <MobileBottomSheet
        open={open}
        onClose={onClose}
        title={t("tabBorrow")}
        showCloseButton
        showHeaderDivider
        zIndex={70}
      >
        <div
          className="px-[16px] mt-[24px]"
          style={{ paddingBottom: "max(40px, env(safe-area-inset-bottom))" }}
        >
          <BorrowContent {...contentProps} />
        </div>
      </MobileBottomSheet>
    );
  }

  // ── PC: Modal ──
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={t("tabBorrow")}
      showCloseButton
      className="md:max-w-[440px]"
    >
      <BorrowContent {...contentProps} />
    </Modal>
  );
}
