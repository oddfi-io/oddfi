"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { LightningIcon, CaretDownIcon } from "@phosphor-icons/react";
import { cmp, formatDisplayAmount } from "@/lib/decimal";
import { accountKeys } from "@/lib/query-keys";
import { useAccountBalance } from "@/hooks/useAccountBalance";
import { useRequireWallet } from "@/hooks/useRequireWallet";
import { useTierSaleBuy } from "@/hooks/useTierSaleBuy";
import { TIER_SIZE_ODD } from "../config/tier-sale.config";
import type { UseTierSaleStateResult } from "../hooks/useTierSaleState";

/**
 * DD-146 BuyCard — 立即购买卡片（Figma 连接态 8604:53592 / 未连接态 8604:120052）。
 *
 * 单组件分连接/未连接两态：
 * - 连接态：余额行 + 金额输入(最大/USDT) + 信息面板（当前档位进度/进度条/解锁节奏/单价/预估获得）+「购买」。
 * - 未连接态：同卡 + 按钮上方「邀请码 (选填)」提示行 +「连接钱包并购买」（点击触发连接，连上后自动切连接态）。
 *
 * 数据接线（数据/逻辑层已建好，本组件只接线）：
 * - useTierSaleBuy：estimate（debounce）/ buy（滑点闸→approve→poll→buy→poll）/ phase / isBusy。
 * - useTierSaleState：当前档位 + 本档剩余 + 单价（信息面板）。
 * - useAccountBalance：站内 USDT 余额（usdt_available_balance）。
 * - useRequireWallet：未连接时点击按钮触发连接弹窗。
 *
 * 金额一律字符串/decimal（禁原生 float）；运行时输出英文（code-quality.md）。
 */

/** 购买按钮态：连接性 + estimate + phase 派生 label/disabled（抽出便于单测）。 */
export function buyButtonState(args: {
  isConnected: boolean;
  isBusy: boolean;
  /** estimate.odd_amount，"0" = 售罄/预算太小。 */
  estimateOddAmount: string | undefined;
  /** 是否有正数输入。 */
  hasAmount: boolean;
  soldOut: boolean;
  labels: { connect: string; buy: string; soldOut: string; processing: string };
}): { label: string; disabled: boolean } {
  const { isConnected, isBusy, estimateOddAmount, hasAmount, soldOut, labels } = args;
  if (!isConnected) return { label: labels.connect, disabled: false };
  if (soldOut) return { label: labels.soldOut, disabled: true };
  if (isBusy) return { label: labels.processing, disabled: true };
  // 已连接：无有效输入或 estimate 为售罄(0) → 禁用
  const estimateUnfillable = estimateOddAmount != null && !(Number(estimateOddAmount) > 0);
  return { label: labels.buy, disabled: !hasAmount || estimateUnfillable };
}

export default function BuyCard({ saleState }: { saleState: UseTierSaleStateResult["saleState"] }) {
  const t = useTranslations("token");
  const { isConnected, address } = useAccount();
  const { requireWallet } = useRequireWallet();
  const queryClient = useQueryClient();
  const { data: balance } = useAccountBalance();

  // 购买成功 → invalidate 余额（双账本 ~10s 索引延迟，靠 useAccountBalance 的 10s 轮询追平）
  const onBuySuccess = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: accountKeys.balance(address) });
  }, [queryClient, address]);
  const { estimate, isBusy, phase, errorMessage, buyTxHash, setUsdtAmount, buy } =
    useTierSaleBuy(onBuySuccess);

  const [amount, setAmount] = useState("");

  const usdtBalance = balance?.usdt_available_balance ?? "0";
  const soldOut = saleState?.soldOut ?? false;
  // M2：超额（输入 > 可用 USDT）→ 引导先充值，不放行 approve→buy 链上 revert 浪费 gas
  const overBalance = Number(amount) > 0 && cmp(amount, usdtBalance) > 0;

  const onAmountChange = (raw: string) => {
    // 仅允许数字 + 单个小数点（系统边界防御：用户输入）
    const cleaned = raw.replace(/[^0-9.]/g, "").replace(/(\..*?)\..*/g, "$1");
    setAmount(cleaned);
    setUsdtAmount(cleaned);
  };

  const onMax = () => onAmountChange(usdtBalance);

  const onPrimary = () => {
    if (!isConnected) {
      // 触发连接；连上后自动续购买（M3：DD §8.3「未连接→连接→恢复」）。用户取消静默。
      void requireWallet()
        .then(() => buy())
        .catch(() => {});
      return;
    }
    buy();
  };

  const { label, disabled } = buyButtonState({
    isConnected,
    isBusy,
    estimateOddAmount: estimate?.odd_amount,
    hasAmount: Number(amount) > 0 && !overBalance,
    soldOut,
    labels: {
      connect: t("buy.connectAndBuy"),
      buy: t("buy.buy"),
      soldOut: t("buy.soldOut"),
      processing: t("buy.processing"),
    },
  });

  // 信息面板数值（来自 useTierSaleState 链上派生；无则占位）
  const currentTier = saleState?.currentTier;
  const tierRemaining = saleState
    ? formatDisplayAmount(saleState.currentTierRemainingOdd, 0)
    : "--";
  const tierSize = saleState ? formatDisplayAmount(String(TIER_SIZE_ODD), 0) : "--";
  const priceUsd = saleState?.currentTierPriceUsd;
  // 本档进度条：本档已售 / 单档容量(3,000,000)
  const tierFillPct = useMemo(() => {
    if (!saleState) return 0;
    const sold = Number(saleState.currentTierSoldOdd);
    const pct = (sold / TIER_SIZE_ODD) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [saleState]);

  // 预估获得：estimate.odd_amount（人类可读串）→ 千分位
  const estimatedOdd =
    estimate?.odd_amount != null && Number(estimate.odd_amount) > 0
      ? `${formatDisplayAmount(estimate.odd_amount, 2)} ODD`
      : t("buy.estimatePlaceholder");

  return (
    <div
      data-figma-pc={isConnected ? "8604:53592" : "8604:120052"}
      className="panel-gradient-border flex w-full flex-col gap-6 rounded-3xl p-6 md:w-[600px] md:rounded-[32px] md:p-12"
    >
      {/* 标题 */}
      <h3 className="text-center text-[20px] font-bold leading-7 text-primary">{t("buy.title")}</h3>

      {/* 黄色信息提示（即买即玩） */}
      <div className="flex w-full items-center gap-2 rounded-8 bg-tag-yellow p-3">
        <LightningIcon weight="fill" className="size-5 shrink-0 text-fn-yellow" />
        <p className="flex-1 text-[14px] font-medium leading-[18px] text-fn-yellow">
          {t("buy.notice")}
        </p>
      </div>

      {/* 金额输入区 */}
      <div className="flex w-full flex-col gap-4">
        <div className="flex w-full items-center justify-between text-[14px]">
          <span className="font-bold text-primary">{t("buy.inputLabel")}</span>
          <span className="flex items-center gap-1 text-secondary">
            {t("buy.balance")}
            <span className="font-bold text-primary">
              {formatDisplayAmount(usdtBalance, 2)} USDT
            </span>
            <span>(-- BSC)</span>
          </span>
        </div>

        {/* @figma-hardcoded: rgba(0,0,0,0.25) input drop-shadow — pending design token */}
        <div className="flex h-[72px] w-full items-center justify-between rounded-16 bg-fill-input-modal py-3 pl-4 pr-3 shadow-[0px_4px_2px_rgba(0,0,0,0.25)]">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
            aria-label={t("buy.inputLabel")}
            className="min-w-0 flex-1 bg-transparent text-right text-[28px] font-bold tracking-[-0.28px] text-primary placeholder:text-secondary focus:outline-none"
          />
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={onMax}
              style={{ touchAction: "manipulation" }}
              className="text-[16px] leading-6 text-brand-default hover:text-brand-hover"
            >
              {t("buy.max")}
            </button>
            <span className="h-5 w-px bg-divider" aria-hidden />
            <span className="flex items-center gap-1">
              <span className="text-[16px] leading-6 text-primary">USDT</span>
              <CaretDownIcon className="size-4 text-secondary" aria-hidden />
            </span>
          </div>
        </div>
      </div>

      {/* 信息面板：当前档位进度 / 进度条 / 解锁节奏 / 单价 / 预估获得 */}
      {/* @figma-hardcoded: rgba(255,255,255,0.08) info-panel-border — pending design token */}
      <div className="flex w-full flex-col gap-3 rounded-12 border border-[rgba(255,255,255,0.08)] px-4 py-6">
        <div className="flex w-full items-center justify-between text-[14px] text-secondary">
          <p>
            {t("buy.currentTierProgress")}
            <span className="text-primary">
              {" "}
              {currentTier != null ? t("buy.tierN", { n: currentTier }) : ""}
            </span>
          </p>
          <p>{t("buy.tierRemaining", { remaining: tierRemaining, size: tierSize })}</p>
        </div>

        <div className="h-[5px] w-full overflow-hidden rounded-[100px] bg-tertiary">
          <div
            className="h-full rounded-[100px] bg-fn-brand transition-[width] duration-300"
            style={{ width: `${tierFillPct}%` }}
          />
        </div>

        <Row label={t("buy.unlockCadence")} value={t("buy.unlockCadenceValue")} />
        <Row label={t("buy.unitPrice")} value={priceUsd != null ? `$${priceUsd}` : "--"} />
        <div className="flex w-full items-center justify-between text-[14px]">
          <span className="text-secondary">{t("buy.estimateGet")}</span>
          <span className="font-medium text-brand-default">{estimatedOdd}</span>
        </div>
      </div>

      {/* 未连接态：邀请码 (选填) 提示行（占位，绑定逻辑由后续 referral batch 接入） */}
      {!isConnected && (
        <div className="flex items-center gap-1">
          <span className="text-[14px] font-bold leading-[18px] text-primary">
            {t("buy.inviteCodeOptional")}
          </span>
        </div>
      )}

      {/* 状态反馈区（C1：购买写链路防线最后一环——让用户看到失败/成功/对账态，杜绝重复购买） */}
      {overBalance && phase !== "reconciling" && (
        <p className="text-[13px] leading-[18px] text-fn-red">{t("buy.insufficientBalance")}</p>
      )}
      {phase === "reconciling" && (
        // tx 可能已上链、USDT 可能已扣 → 醒目橙色 + 「勿重复购买」（防双买 TOCTOU）
        <div className="flex flex-col gap-1 rounded-12 bg-tag-orange p-3">
          <p className="text-[13px] font-medium leading-[18px] text-fn-orange">{errorMessage}</p>
          <p className="text-[13px] leading-[18px] text-fn-orange">{t("buy.reconcileHint")}</p>
        </div>
      )}
      {phase === "failed" && errorMessage && (
        <p className="text-[13px] leading-[18px] text-fn-red">{errorMessage}</p>
      )}
      {phase === "success" && (
        <p className="text-[13px] leading-[18px] text-fn-green">
          {t("buy.successMsg")}
          {buyTxHash ? ` (${buyTxHash.slice(0, 10)}…)` : ""}
        </p>
      )}

      {/* 主按钮 */}
      <button
        type="button"
        onClick={onPrimary}
        disabled={disabled}
        style={{ touchAction: "manipulation" }}
        className="flex h-[56px] w-full items-center justify-center gap-2 rounded-12 bg-white px-4 py-2 text-[18px] font-medium leading-[26px] text-static-black transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isBusy && <Spinner />}
        {label}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-full items-center justify-between text-[14px]">
      <span className="text-secondary">{label}</span>
      <span className="text-right font-medium text-primary">{value}</span>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-static-black/30 border-t-static-black"
    />
  );
}
