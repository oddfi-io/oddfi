"use client";

import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { useAccountBalance } from "@/hooks/useAccountBalance";
import { formatAdaptiveAmount } from "@/lib/decimal";

/**
 * DD-146 B9 我的购买 —— Figma PC 8604:53648 / H5 8754:94254。
 *
 * 5 容器：①总持仓（购买/邀请奖励拆分）②累计投入（今日价值）③锁定均价（今日单价）
 *        ④领取（已领取/待领取）⑤待释放总额（未释放/即将释放）。
 *
 * 数据派生：
 *   - 总持仓 ODD：连接后取 `getAccountBalance().total_balance`（DB 账本 ODD 串），未连接占位 "--"。
 *   - 累计投入 / 今日价值 / 锁定均价 / claim / vesting：暂无数据源 → 占位 "--"。
 *     （TODO DD-146 B10：投入汇总 + claim/vesting 待 records / positions 数据源接入。）
 *   - 解锁进度：静态文案（建池起 29 天阶梯，TGE 后逐日释放），后续接真实 vesting。
 *
 * 未连接态：连接钱包引导 + 所有数值占位 "--"。
 * Token：panel-gradient-border（卡片渐变描边，含 #111114 填充）· text-brand-default（数值）· text-secondary（标签）。
 */

const DASH = "--";

export default function MyPurchaseSection() {
  const t = useTranslations("token");
  const { isConnected } = useAccount();
  const { data: balance } = useAccountBalance();

  // TODO DD-146 B10: 投入汇总 / claim / vesting 待 records / positions 数据源接入（当前占位 "--"）。
  // 总持仓 ODD：连接后取 DB 账本 total_balance；未连接 / 无数据占位。
  const holdingsOdd =
    isConnected && balance?.total_balance != null
      ? formatAdaptiveAmount(balance.total_balance)
      : DASH;

  return (
    <section data-figma-pc="8604:53648" data-figma-h5="8754:94254" className="w-full">
      {/* ───────── H5（< md）：标题居中 + 5 卡纵列 ───────── */}
      <div className="flex flex-col gap-6 px-4 py-10 md:hidden">
        <Header t={t} />
        {!isConnected && (
          <p className="text-center font-noto-sc text-[13px] text-tertiary">
            {t("purchase.connectHint")}
          </p>
        )}
        <div className="flex flex-col gap-4">
          <HoldingsCard t={t} holdingsOdd={holdingsOdd} />
          <MetricCard
            label={t("purchase.totalInvested")}
            value={`${DASH} USDT`}
            subLabel={t("purchase.todayValue")}
            subValue={`${DASH} ODD`}
          />
          <MetricCard
            label={t("purchase.lockedAvg")}
            value={`${DASH} USDT`}
            subLabel={t("purchase.todayPrice")}
            subValue={`${DASH} USDT`}
          />
          <DualCard
            title={t("purchase.claimTitle")}
            leftLabel={t("purchase.claimed")}
            rightLabel={t("purchase.claimable")}
          />
          <DualCard
            title={t("purchase.vestingTitle")}
            leftLabel={t("purchase.notReleased")}
            rightLabel={t("purchase.upcomingRelease")}
            rightFootnote={t("purchase.releaseBreakdown", { p: DASH, r: DASH })}
          />
        </div>
      </div>

      {/* ───────── PC（md+）：标题 + 上排 3 卡 + 下排 2 卡 ───────── */}
      <div className="mx-auto hidden w-full max-w-[1440px] flex-col gap-10 px-[120px] py-20 md:flex">
        <Header t={t} />
        {!isConnected && (
          <p className="font-noto-sc text-[14px] text-tertiary">{t("purchase.connectHint")}</p>
        )}
        <div className="flex flex-col gap-6">
          {/* 上排 3 卡 */}
          <div className="flex gap-6">
            <HoldingsCard t={t} holdingsOdd={holdingsOdd} className="flex-1" />
            <MetricCard
              className="flex-1"
              label={t("purchase.totalInvested")}
              value={`${DASH} USDT`}
              subLabel={t("purchase.todayValue")}
              subValue={`${DASH} ODD`}
            />
            <MetricCard
              className="flex-1"
              label={t("purchase.lockedAvg")}
              value={`${DASH} USDT`}
              subLabel={t("purchase.todayPrice")}
              subValue={`${DASH} USDT`}
            />
          </div>
          {/* 下排 2 卡 */}
          <div className="flex gap-6">
            <DualCard
              className="flex-1"
              title={t("purchase.claimTitle")}
              leftLabel={t("purchase.claimed")}
              rightLabel={t("purchase.claimable")}
            />
            <DualCard
              className="flex-1"
              title={t("purchase.vestingTitle")}
              leftLabel={t("purchase.notReleased")}
              rightLabel={t("purchase.upcomingRelease")}
              rightFootnote={t("purchase.releaseBreakdown", { p: DASH, r: DASH })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** 标题：ODD 币图标 + 「我的购买」+ 副标题。 */
function Header({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col gap-3 md:gap-6">
      <div className="flex items-center justify-center gap-3 md:justify-start md:gap-6">
        {/* ODD 币矢量（复用 tokens/odd.svg：薄荷圆底 + ODD swoosh） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/tokens/odd.svg"
          alt=""
          aria-hidden
          className="size-6 shrink-0 rounded-full md:size-[37px]"
        />
        <h2 className="font-orbitron text-[24px] font-bold leading-8 tracking-[-0.24px] text-primary md:text-[48px] md:leading-[64px] md:tracking-[-1.44px]">
          {t("purchase.title")}
        </h2>
      </div>
      <p className="text-center font-noto-sc text-[12px] font-medium leading-[18px] text-secondary md:text-left md:text-[18px] md:leading-[26px]">
        {t("purchase.subtitle")}
      </p>
    </div>
  );
}

/** 总持仓卡：ODD 主值 + 购买/邀请奖励拆分。 */
function HoldingsCard({
  t,
  holdingsOdd,
  className,
}: {
  t: ReturnType<typeof useTranslations>;
  holdingsOdd: string;
  className?: string;
}) {
  return (
    <div
      className={`panel-gradient-border flex flex-col gap-4 rounded-[16px] p-6 ${className ?? ""}`}
    >
      <div className="flex flex-col gap-2">
        <span className="font-noto-sc text-[14px] font-normal leading-[18px] text-secondary">
          {t("purchase.totalHoldings")}
        </span>
        <span className="font-noto-sc text-[20px] font-bold leading-7 text-brand-default">
          {holdingsOdd} ODD
        </span>
        <span className="font-noto-sc text-[14px] font-normal leading-[18px] text-secondary">
          ≈ $—
        </span>
      </div>
      <div className="flex w-[200px] max-w-full flex-col gap-2 font-noto-sc text-[14px] font-normal leading-[18px] text-secondary">
        <div className="flex items-center justify-between">
          <span>{t("purchase.sourcePurchase")}</span>
          <span>{DASH} ODD</span>
        </div>
        <div className="flex items-center justify-between">
          <span>{t("purchase.sourceReferral")}</span>
          <span>{DASH} ODD</span>
        </div>
      </div>
    </div>
  );
}

/** 通用指标卡：主值 + 单行 subLabel/subValue。 */
function MetricCard({
  label,
  value,
  subLabel,
  subValue,
  className,
}: {
  label: string;
  value: string;
  subLabel: string;
  subValue: string;
  className?: string;
}) {
  return (
    <div
      className={`panel-gradient-border flex flex-col gap-4 rounded-[16px] p-6 ${className ?? ""}`}
    >
      <div className="flex flex-col gap-2">
        <span className="font-noto-sc text-[14px] font-normal leading-[18px] text-secondary">
          {label}
        </span>
        <span className="font-noto-sc text-[20px] font-bold leading-7 text-brand-default">
          {value}
        </span>
      </div>
      <div className="flex w-[200px] max-w-full items-center justify-between font-noto-sc text-[14px] font-normal leading-[18px] text-secondary">
        <span>{subLabel}</span>
        <span>{subValue}</span>
      </div>
    </div>
  );
}

/** 双栏卡（领取 / 待释放总额）：标题 + 左右两组（标签 + ODD 值 + ≈$—）。 */
function DualCard({
  title,
  leftLabel,
  rightLabel,
  rightFootnote,
  className,
}: {
  title: string;
  leftLabel: string;
  rightLabel: string;
  rightFootnote?: string;
  className?: string;
}) {
  return (
    <div
      className={`panel-gradient-border flex flex-col gap-4 rounded-[16px] p-6 ${className ?? ""}`}
    >
      <span className="font-noto-sc text-[16px] font-bold leading-6 text-primary">{title}</span>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-noto-sc text-[14px] font-normal leading-[18px] text-secondary">
            {leftLabel}
          </span>
          <span className="font-noto-sc text-[20px] font-bold leading-7 text-brand-default">
            {DASH} ODD
          </span>
          <span className="font-noto-sc text-[14px] font-normal leading-[18px] text-secondary">
            ≈ $—
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-noto-sc text-[14px] font-normal leading-[18px] text-secondary">
            {rightLabel}
          </span>
          <span className="font-noto-sc text-[20px] font-bold leading-7 text-brand-default">
            {DASH} ODD
          </span>
          <span className="font-noto-sc text-[14px] font-normal leading-[18px] text-secondary">
            {rightFootnote ?? "≈ $—"}
          </span>
        </div>
      </div>
    </div>
  );
}
