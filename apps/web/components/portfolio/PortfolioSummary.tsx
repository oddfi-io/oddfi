"use client";

import { memo, useMemo, useState } from "react";
import {
  EyeIcon,
  EyeSlashIcon,
  DownloadSimpleIcon,
  UploadSimpleIcon,
  GiftIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { formatDisplayAmount, convertOdd } from "@/lib/decimal";
// TODO: dailyPnl / won — waiting for backend API fields, currently hardcoded to "0"
import { useDepositSheetStore } from "@/stores/depositSheetStore";
import { useAccountBalance } from "@/hooks/useAccountBalance";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";

const MASKED = "****";

function StatCard({
  label,
  amount,
  sub,
  unit,
  subPrefix,
  hasRate,
  hidden,
  muted,
}: {
  label: string;
  amount: string;
  sub: string;
  unit: string;
  subPrefix: string;
  hasRate: boolean;
  hidden?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[8px] items-start">
      <span
        className={`text-[14px] font-normal leading-[19px] ${muted ? "text-tertiary" : "text-secondary"}`}
      >
        {label}
      </span>
      <div className="flex gap-[4px] items-baseline">
        <span
          className={`text-[18px] font-bold leading-[26px] ${muted ? "text-secondary" : "text-primary"}`}
        >
          {hidden ? MASKED : formatDisplayAmount(amount)}
        </span>
        {!hidden && (
          <span
            className={`text-[12px] font-medium leading-[18px] ${muted ? "text-secondary" : "text-primary"}`}
          >
            {unit}
          </span>
        )}
      </div>
      {hasRate && (
        <span className="text-[14px] font-normal text-tertiary leading-[19px]">
          {hidden ? MASKED : `≈ ${subPrefix} ${formatDisplayAmount(sub)}`}
        </span>
      )}
    </div>
  );
}

function H5StatCard({
  label,
  amount,
  sub,
  unit,
  subPrefix,
  hasRate,
  hidden,
}: {
  label: string;
  amount: string;
  sub: string;
  unit: string;
  subPrefix: string;
  hasRate: boolean;
  hidden?: boolean;
}) {
  return (
    <div className="border border-divider rounded-8 p-[16px] flex flex-col gap-[4px] shrink-0">
      <span className="text-[12px] font-normal text-secondary leading-[18px]">{label}</span>
      <div className="flex gap-[4px] items-baseline">
        <span className="text-[16px] font-bold text-primary leading-[24px]">
          {hidden ? MASKED : formatDisplayAmount(amount)}
        </span>
        {!hidden && (
          <span className="text-[12px] font-medium text-primary leading-[18px]">{unit}</span>
        )}
      </div>
      {hasRate && (
        <span className="text-[12px] font-medium text-tertiary leading-[18px]">
          {hidden ? MASKED : `≈ ${subPrefix} ${formatDisplayAmount(sub)}`}
        </span>
      )}
    </div>
  );
}

interface PortfolioSummaryProps {
  onWithdraw?: () => void;
  onClaim?: () => void;
}

function PortfolioSummary({ onWithdraw, onClaim }: PortfolioSummaryProps) {
  const t = useTranslations("portfolio");
  const openDeposit = useDepositSheetStore((s) => s.open);
  const { data: accountBalance } = useAccountBalance();
  const { canConvert, hasRate, rate } = useCurrencyDisplay();
  // canConvert 决定主展示单位：true → USD，false → ODD（含 rate 未加载降级）
  const showUsd = canConvert;
  const unit = showUsd ? "USD" : PLATFORM_TOKEN_DISPLAY;
  const subPrefix = showUsd ? PLATFORM_TOKEN_DISPLAY : "$";
  // dailyPnl — backend has no field yet, hardcode "0"
  const dailyPnl = "0";
  const dailyPnlPercent = "0";

  const totalOdd = accountBalance?.total_balance ?? "0";
  const cashOdd = accountBalance?.available_balance ?? "0";
  const betOdd = accountBalance?.bet_lock_balance ?? "0";
  const stakeOdd = accountBalance?.stake_lock_balance ?? "0";
  const liqOdd = accountBalance?.liq_lock_balance ?? "0";
  const claimableOdd = accountBalance?.claimable_balance ?? "0";

  // 主/次展示值对：
  // showUsd=true  → main=ODD*rate, sub=ODD 原值
  // showUsd=false → main=ODD 原值, sub=ODD*rate（rate 未加载时降级为 ODD 原值）
  const balanceDisplay = useMemo(() => {
    const toUsd = (odd: string) => convertOdd(odd, rate);
    return {
      totalAssets: showUsd ? toUsd(totalOdd) : totalOdd,
      totalSub: showUsd ? totalOdd : toUsd(totalOdd),
      cashAmount: showUsd ? toUsd(cashOdd) : cashOdd,
      cashSub: showUsd ? cashOdd : toUsd(cashOdd),
      betAmount: showUsd ? toUsd(betOdd) : betOdd,
      betSub: showUsd ? betOdd : toUsd(betOdd),
      stakeAmount: showUsd ? toUsd(stakeOdd) : stakeOdd,
      stakeSub: showUsd ? stakeOdd : toUsd(stakeOdd),
      liqAmount: showUsd ? toUsd(liqOdd) : liqOdd,
      liqSub: showUsd ? liqOdd : toUsd(liqOdd),
      wonAmount: showUsd ? toUsd(claimableOdd) : claimableOdd,
      wonSub: showUsd ? claimableOdd : toUsd(claimableOdd),
    };
  }, [showUsd, rate, totalOdd, cashOdd, betOdd, stakeOdd, liqOdd, claimableOdd]);

  const {
    totalAssets,
    totalSub,
    cashAmount,
    cashSub,
    betAmount,
    betSub,
    stakeAmount,
    stakeSub,
    liqAmount,
    liqSub,
    wonAmount,
    wonSub,
  } = balanceDisplay;

  // 暂时硬编码隐藏「已赢」区域（原逻辑：Number(claimableOdd) > 0）
  const showWon = false;

  const [assetsHidden, setAssetsHidden] = useState(false);
  const mask = (v: string) => (assetsHidden ? MASKED : formatDisplayAmount(v));

  return (
    <div className="flex flex-col gap-[16px] lg:gap-[24px]">
      {/* ══════════════════════ PC Layout ══════════════════════ */}
      <div className="hidden lg:flex flex-col gap-[24px]">
        <div className="relative h-[330px]">
          {/* @figma-hardcoded: #111114 fill/fill/card1 — Subtract shape background */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            src="/images/portfolio-bg.svg"
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
          <div className="absolute right-[32px] top-[36px] flex gap-[24px] items-center z-10">
            <button
              onClick={openDeposit}
              className="flex gap-[8px] items-center justify-center h-[48px] w-[160px] rounded-12 bg-btn-primary shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] min-h-[44px] touch-manipulation"
            >
              <DownloadSimpleIcon size={20} weight="regular" className="text-static-black" />
              <span className="text-[14px] font-medium text-static-black leading-[19px]">
                {t("deposit")}
              </span>
            </button>
            <button
              onClick={onWithdraw}
              className="flex gap-[8px] items-center justify-center h-[48px] w-[160px] rounded-12 bg-tertiary shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] min-h-[44px] touch-manipulation"
            >
              <UploadSimpleIcon size={20} weight="regular" className="text-primary" />
              <span className="text-[14px] font-medium text-primary leading-[19px]">
                {t("withdraw")}
              </span>
            </button>
          </div>
          <div className="absolute left-[32px] top-[32px] right-[32px] flex flex-col gap-[32px]">
            <div className="flex flex-col gap-[12px]">
              <div className="flex gap-[6px] items-center">
                <span className="text-[14px] font-normal text-secondary leading-[19px]">
                  {t("assets")}
                </span>
                <button
                  onClick={() => setAssetsHidden((h) => !h)}
                  className="flex items-center justify-center cursor-pointer"
                >
                  {assetsHidden ? (
                    <EyeSlashIcon size={20} weight="regular" className="text-secondary" />
                  ) : (
                    <EyeIcon size={20} weight="regular" className="text-secondary" />
                  )}
                </button>
              </div>
              <div className="flex flex-col gap-[8px]">
                <div className="flex gap-[8px] items-baseline">
                  <span className="text-[30px] font-bold text-primary leading-normal">
                    {mask(totalAssets)}
                  </span>
                  {!assetsHidden && (
                    <span className="text-[14px] font-normal text-primary leading-[19px]">
                      {unit}
                    </span>
                  )}
                </div>
                {hasRate && (
                  <span className="text-[14px] font-normal text-tertiary leading-[19px]">
                    {assetsHidden ? MASKED : `≈ ${subPrefix} ${formatDisplayAmount(totalSub)}`}
                  </span>
                )}
                <div className="flex gap-[8px] items-start">
                  {/* @figma-hardcoded: #46484a dotted-line — pending design token */}
                  <span className="text-[14px] font-normal text-secondary leading-[19px] border-b border-dashed border-[#46484a]">
                    {t("dailyPnl")}
                  </span>
                  <span className="text-[14px] font-normal text-fn-green leading-[19px]">
                    {assetsHidden
                      ? MASKED
                      : `+$${formatDisplayAmount(dailyPnl)} (${dailyPnlPercent}%)`}
                  </span>
                </div>
              </div>
            </div>
            {/* Stats cards — Cash standalone w-266, right 3 grouped with dividers */}
            <div className="flex gap-[24px]">
              <div className="w-[266px] shrink-0 border border-secondary rounded-16 p-[16px]">
                <StatCard
                  label={t("cash")}
                  amount={cashAmount}
                  sub={cashSub}
                  unit={unit}
                  subPrefix={subPrefix}
                  hasRate={hasRate}
                  hidden={assetsHidden}
                />
              </div>
              <div className="flex-1 border border-secondary rounded-16 flex items-center">
                <div className="flex-1 px-[16px]">
                  <StatCard
                    label={t("bet")}
                    amount={betAmount}
                    sub={betSub}
                    unit={unit}
                    subPrefix={subPrefix}
                    hasRate={hasRate}
                    hidden={assetsHidden}
                    muted
                  />
                </div>
                <div className="w-0 h-[72px] border-l border-divider-light" />
                <div className="flex-1 px-[16px]">
                  <StatCard
                    label={t("stake")}
                    amount={stakeAmount}
                    sub={stakeSub}
                    unit={unit}
                    subPrefix={subPrefix}
                    hasRate={hasRate}
                    hidden={assetsHidden}
                    muted
                  />
                </div>
                <div className="w-0 h-[72px] border-l border-divider-light" />
                <div className="flex-1 px-[16px]">
                  <StatCard
                    label={t("liquidity")}
                    amount={liqAmount}
                    sub={liqSub}
                    unit={unit}
                    subPrefix={subPrefix}
                    hasRate={hasRate}
                    hidden={assetsHidden}
                    muted
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Won section */}
        {showWon && (
          <div className="bg-secondary rounded-16 p-[32px] flex items-center justify-between">
            <div className="flex flex-col gap-[12px]">
              <div className="flex gap-[6px] items-center">
                <span className="text-[14px] font-normal text-secondary leading-[19px]">
                  {t("won")}
                </span>
                <GiftIcon size={20} weight="regular" className="text-secondary" />
              </div>
              <div className="flex flex-col gap-[8px]">
                <div className="flex gap-[8px] items-baseline">
                  <span className="text-[24px] font-bold text-primary">{mask(wonAmount)}</span>
                  {!assetsHidden && (
                    <span className="text-[14px] font-normal text-primary leading-[19px]">
                      {unit}
                    </span>
                  )}
                </div>
                {hasRate && (
                  <span className="text-[14px] font-normal text-secondary leading-[19px]">
                    {assetsHidden ? MASKED : `≈ ${subPrefix} ${formatDisplayAmount(wonSub)}`}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClaim}
              className="flex items-center justify-center h-[48px] w-[160px] rounded-12 bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] min-h-[44px] touch-manipulation"
            >
              {/* @figma-hardcoded: #04060c static-black — pending design token */}
              <span className="text-[14px] font-medium text-[#04060c] leading-[19px]">
                {t("claim")}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════ H5 Layout ══════════════════════ */}
      <div className="flex lg:hidden flex-col gap-[16px]">
        <div className="bg-secondary rounded-16 p-[16px] flex flex-col gap-[16px]">
          <div className="flex flex-col gap-[8px]">
            <div className="flex gap-[6px] items-center">
              <span className="text-[12px] font-normal text-secondary leading-[18px]">
                {t("assets")}
              </span>
              <button
                onClick={() => setAssetsHidden((h) => !h)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
              >
                {assetsHidden ? (
                  <EyeSlashIcon size={20} weight="regular" className="text-secondary" />
                ) : (
                  <EyeIcon size={20} weight="regular" className="text-secondary" />
                )}
              </button>
            </div>
            <div className="flex flex-col gap-[4px]">
              <div className="flex gap-[8px] items-baseline">
                <span className="text-[20px] font-bold text-primary leading-[28px]">
                  {mask(totalAssets)}
                </span>
                {!assetsHidden && (
                  <span className="text-[14px] font-normal text-primary leading-[19px]">
                    {unit}
                  </span>
                )}
              </div>
              {hasRate && (
                <span className="text-[12px] font-medium text-tertiary leading-[18px]">
                  {assetsHidden ? MASKED : `≈ ${subPrefix} ${formatDisplayAmount(totalSub)}`}
                </span>
              )}
              <div className="flex gap-[8px] items-start">
                {/* @figma-hardcoded: #46484a dotted-line — pending design token */}
                <span className="text-[12px] font-normal text-secondary leading-[18px] border-b border-dashed border-[#46484a]">
                  {t("dailyPnl")}
                </span>
                <span className="text-[12px] font-medium text-fn-green leading-[18px]">
                  {assetsHidden
                    ? MASKED
                    : `+$${formatDisplayAmount(dailyPnl)} (${dailyPnlPercent}%)`}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-[8px] w-full">
            <button
              onClick={openDeposit}
              className="flex-1 flex gap-[4px] items-center justify-center min-h-[44px] rounded-8 bg-btn-primary shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] touch-manipulation"
            >
              <DownloadSimpleIcon size={16} weight="regular" className="text-static-black" />
              <span className="text-[12px] font-medium text-static-black leading-[18px]">
                {t("deposit")}
              </span>
            </button>
            <button
              onClick={onWithdraw}
              className="flex-1 flex gap-[4px] items-center justify-center min-h-[44px] rounded-8 bg-tertiary shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] touch-manipulation"
            >
              <UploadSimpleIcon size={16} weight="regular" className="text-primary" />
              <span className="text-[12px] font-medium text-primary leading-[18px]">
                {t("withdraw")}
              </span>
            </button>
          </div>
        </div>
        <div className="bg-secondary rounded-16 p-[16px] flex flex-col gap-[16px] overflow-hidden">
          <span className="text-[16px] font-bold text-primary leading-[24px]">{t("title")}</span>
          <div className="flex gap-[16px] overflow-x-auto scrollbar-hide">
            <H5StatCard
              label={t("cash")}
              amount={cashAmount}
              sub={cashSub}
              unit={unit}
              subPrefix={subPrefix}
              hasRate={hasRate}
              hidden={assetsHidden}
            />
            <H5StatCard
              label={t("bet")}
              amount={betAmount}
              sub={betSub}
              unit={unit}
              subPrefix={subPrefix}
              hasRate={hasRate}
              hidden={assetsHidden}
            />
            <H5StatCard
              label={t("stake")}
              amount={stakeAmount}
              sub={stakeSub}
              unit={unit}
              subPrefix={subPrefix}
              hasRate={hasRate}
              hidden={assetsHidden}
            />
            <H5StatCard
              label={t("liquidity")}
              amount={liqAmount}
              sub={liqSub}
              unit={unit}
              subPrefix={subPrefix}
              hasRate={hasRate}
              hidden={assetsHidden}
            />
          </div>
        </div>
        {showWon && (
          <div className="bg-secondary rounded-16 p-[16px] flex flex-col gap-[8px]">
            <span className="text-[16px] font-bold text-primary leading-[24px]">{t("won")}</span>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-[4px]">
                <div className="flex gap-[8px] items-baseline">
                  <span className="text-[20px] font-semibold text-primary leading-[28px]">
                    {mask(wonAmount)}
                  </span>
                  {!assetsHidden && (
                    <span className="text-[14px] font-normal text-primary leading-[19px]">
                      {unit}
                    </span>
                  )}
                </div>
                {hasRate && (
                  <span className="text-[12px] font-medium text-tertiary leading-[18px]">
                    {assetsHidden ? MASKED : `≈ ${subPrefix} ${formatDisplayAmount(wonSub)}`}
                  </span>
                )}
              </div>
              <button
                onClick={onClaim}
                className="flex items-center justify-center min-h-[44px] touch-manipulation"
              >
                {/* @figma-hardcoded: #04060c static-black — pending design token */}
                <span className="flex items-center justify-center h-[32px] px-[16px] rounded-8 bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]">
                  <span className="text-[12px] font-medium text-[#04060c] leading-[18px]">
                    {t("claim")}
                  </span>
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(PortfolioSummary);
