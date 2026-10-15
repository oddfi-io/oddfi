"use client";

// ASSETS.md 已查（关键词 PoolMatchDepositModal / matchDepositModal）：无替代品。
// 新建理由：match pool 无 plan 选择（unlockAt 由比赛时间决定），与 PoolDepositModal
// （含 30/60/90d plan 选择 + APY 展示）UI 结构差异较大，复用难度大于复制。

import { useState, useEffect } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { formatUnits, parseUnits } from "viem";
import Modal from "@/components/ui/Modal";
import TeamAvatarPair from "@/components/common/TeamAvatarPair";
import { formatDisplayAmount, formatAmount } from "@/lib/decimal";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { useLiquidityPoolStats } from "@/hooks/useLiquidityPoolStats";
import { useDepositMatchTx } from "@/hooks/useDepositMatchTx";
import { useAccountBalance } from "@/hooks/useAccountBalance";
import { toastWarning } from "@/lib/toast";
import { IS_SUBSCRIPTION_MODE } from "@/lib/subscription-mode";
import type { LpMatchPoolData } from "@/hooks/useLiquidityFeaturedPools";

const HOME_MOCK = "/images/mocks/teams/home.png";
const AWAY_MOCK = "/images/mocks/teams/away.png";

interface PoolMatchDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  pool: LpMatchPoolData | null;
}

function useCountdown(unlockAt: bigint | undefined) {
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0, expired: false });

  useEffect(() => {
    if (!unlockAt) return;
    const compute = () => {
      const diff = Number(unlockAt) - Math.floor(Date.now() / 1000);
      if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true };
      return {
        d: Math.floor(diff / 86400),
        h: Math.floor((diff % 86400) / 3600),
        m: Math.floor((diff % 3600) / 60),
        s: diff % 60,
        expired: false,
      };
    };
    setCountdown(compute());
    const timer = setInterval(() => setCountdown(compute()), 1000);
    return () => clearInterval(timer);
  }, [unlockAt]);

  return countdown;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function PoolMatchDepositModal({
  isOpen,
  onClose,
  pool,
}: PoolMatchDepositModalProps) {
  const t = useTranslations("pools");
  const [amount, setAmount] = useState("");

  const { minDeposit, isPaused } = useLiquidityPoolStats();
  const deposit = useDepositMatchTx(onClose);
  const countdown = useCountdown(pool?.unlockAt);

  // DD-130：可加流动性余额改用账户/代理钱包 available_balance（十进制 ODD 串），不再读钱包 balanceOf
  const { data: balanceInfo } = useAccountBalance();
  const availableBalance = balanceInfo?.available_balance ?? "0";
  const balanceRaw = (() => {
    try {
      return parseUnits(availableBalance, 18);
    } catch {
      return 0n;
    }
  })();

  const minDepositDisplay = minDeposit === 0n ? "—" : formatAmount(formatUnits(minDeposit, 18));

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      deposit.reset();
      setAmount("");
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pool) return null;

  const homeLogo = pool.homeTeamLogo || HOME_MOCK;
  const awayLogo = pool.awayTeamLogo || AWAY_MOCK;

  const handleMax = () => setAmount(availableBalance);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setAmount(val);
    }
  };

  const isProcessing = deposit.phase !== "idle" && deposit.phase !== "failed";
  const isDepositClosed = !pool.canDeposit;

  const handleConfirm = () => {
    // DD-113: 认购模式短路兜底
    if (IS_SUBSCRIPTION_MODE) return;
    if (!amount || isProcessing || isDepositClosed) return;
    const amountBigInt = parseUnits(amount, 18);
    if (minDeposit > 0n && amountBigInt < minDeposit) {
      toastWarning(
        t("minimumDepositDynamic", { amount: minDepositDisplay, symbol: PLATFORM_TOKEN_DISPLAY })
      );
      return;
    }
    deposit.execute(amount, pool.matchId, isPaused, minDeposit, balanceRaw);
  };

  const ctaLabel = (() => {
    switch (deposit.phase) {
      case "checking_allowance":
      case "approving":
        return t("approvingCta");
      case "confirming_approve":
        return t("confirmingApproveCta");
      case "depositing":
        return t("depositingCta");
      case "confirming_deposit":
        return t("confirmingCta");
      default:
        return t("confirmDeposit");
    }
  })();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("addLiquidity")}>
      <div className="flex flex-col gap-[24px]">
        {/* Team badge + match info (Figma 5092:6062) */}
        <div className="flex gap-[8px] items-center">
          <TeamAvatarPair homeTeamLogo={homeLogo} awayTeamLogo={awayLogo} size={36} />
          <div className="flex flex-col gap-[2px] min-w-0">
            <p className="text-primary text-[16px] font-bold leading-[24px] truncate">
              {pool.match}
            </p>
            <p className="text-secondary text-[14px] leading-[19px]">{pool.matchDate}</p>
          </div>
        </div>

        {/* Amount Input */}
        <div className="flex flex-col gap-[12px]">
          <div className="flex items-center justify-between">
            <span className="text-secondary text-[14px]">{t("amount")}</span>
            <span className="text-[12px] text-secondary">
              {t("availableWithAmount", {
                amount: formatDisplayAmount(availableBalance),
                symbol: PLATFORM_TOKEN_DISPLAY,
              })}
            </span>
          </div>
          <div className="bg-fill-input-modal rounded-8 h-[48px] px-[12px] flex items-center justify-between">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={handleAmountChange}
              style={{ touchAction: "manipulation" }}
              className="flex-1 bg-transparent text-primary text-[14px] font-medium outline-none placeholder:text-tertiary min-w-0"
            />
            <div className="flex items-center gap-[8px] shrink-0">
              <span className="text-primary text-[14px]">{PLATFORM_TOKEN_DISPLAY}</span>
              <button
                onClick={handleMax}
                style={{ touchAction: "manipulation" }}
                className="text-brand-default text-[14px] cursor-pointer"
              >
                {t("maxBtn")}
              </button>
            </div>
          </div>
        </div>

        {/* Time until match ends — countdown (Figma 5092:5514) */}
        <div className="flex flex-col gap-[12px]">
          <p className="text-secondary text-[14px]">{t("timeUntilMatchEnd")}</p>
          {countdown.expired ? (
            <p className="text-fn-red text-[14px]">{t("matchEnded")}</p>
          ) : (
            <div className="border border-divider-light rounded-8 py-[20px] flex gap-[8px] items-center justify-center">
              {/* @figma-hardcoded: #212124 bg-tertiary countdown-pill — pending design token */}
              {countdown.d > 0 && (
                <>
                  <div className="bg-[#212124] rounded-4 px-[8px] py-[2px] flex items-center justify-center">
                    <span className="text-primary text-[18px] font-medium leading-[1.8]">
                      {pad(countdown.d)}D
                    </span>
                  </div>
                  <span className="text-secondary text-[14px]">:</span>
                </>
              )}
              <div className="bg-[#212124] rounded-4 px-[8px] py-[2px] flex items-center justify-center">
                <span className="text-primary text-[18px] font-medium leading-[1.8]">
                  {pad(countdown.h)}H
                </span>
              </div>
              <span className="text-secondary text-[14px]">:</span>
              <div className="bg-[#212124] rounded-4 px-[8px] py-[2px] flex items-center justify-center">
                <span className="text-primary text-[18px] font-medium leading-[1.8]">
                  {pad(countdown.m)}M
                </span>
              </div>
              <span className="text-secondary text-[14px]">:</span>
              <div className="bg-[#212124] rounded-4 px-[8px] py-[2px] flex items-center justify-center">
                <span className="text-primary text-[18px] font-medium leading-[1.8]">
                  {pad(countdown.s)}S
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Risk notice */}
        <div className="bg-tag-yellow rounded-8 p-[12px] flex gap-[8px]">
          <WarningCircleIcon size={20} className="text-fn-yellow shrink-0" />
          <p className="text-fn-yellow text-[12px] leading-[18px]">{t("matchPoolRiskNotice")}</p>
        </div>

        {/* 池子已过期友好提示 */}
        {isDepositClosed && (
          <div className="flex items-center gap-[8px]">
            <WarningCircleIcon size={16} className="text-fn-red shrink-0" />
            <p className="text-fn-red text-[12px]">{t("depositWindowClosed")}</p>
          </div>
        )}

        {/* Error */}
        {deposit.phase === "failed" && deposit.errorMessage && (
          <div className="flex items-center gap-[8px]">
            <WarningCircleIcon size={16} className="text-fn-red shrink-0" />
            <p className="text-fn-red text-[12px]">{deposit.errorMessage}</p>
          </div>
        )}

        {/* DD-113: 认购模式强制 disabled */}
        <button
          onClick={handleConfirm}
          disabled={!amount || isProcessing || isDepositClosed || IS_SUBSCRIPTION_MODE}
          style={{ touchAction: "manipulation" }}
          className="bg-btn-primary-white text-static-black rounded-12 h-[48px] w-full text-[14px] font-medium shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] disabled:opacity-40 transition-opacity"
        >
          {ctaLabel}
        </button>
      </div>
    </Modal>
  );
}
