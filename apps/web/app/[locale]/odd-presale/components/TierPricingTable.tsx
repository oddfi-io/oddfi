"use client";

import { useTranslations, useLocale } from "next-intl";
import { TIERS } from "../config/tier-sale.config";
import { useTierSaleState } from "../hooks/useTierSaleState";

/**
 * DD-146 B6 阶梯定价表 —— Figma PC 8604:118267 / H5 8754:107792。
 *
 * 视图：标题 + 3 个 stat 卡（即买即玩 / 价格区间 / DEX 开盘价）+ 10 行表 + 脚注。
 * 数据：10 行来自 `TIERS`（镜像合约 TierSale.sol：10 档 × 3,000,000 ODD，第 N 档单价 N×$0.01）。
 *   「累积售出」列结合 `useTierSaleState().saleState.currentTier` 高亮当前进行档（链上 totalSold 派生）。
 *   售出/募资为该档静态上限，当前档行整行高亮。
 * 表格列：档位 / 单价 / 本档数量 / 累积售出 / 累计募资 / 开盘收益（PC）；H5 精简为前 4 列。
 *
 * Token：bg-tertiary（表头）· border-secondary（行分隔）· text-primary/secondary · text-brand-default。
 * stat 卡 bg/border 为 Figma 硬编码 rgba（无对应 Token，见 @figma-hardcoded）。
 */

/** DEX 开盘价（USD）—— Figma 8604:118688 标注 $0.165，用于「开盘收益」涨幅计算。 */
const DEX_OPEN_PRICE_USD = 0.165;

/** ODD 整数串 → 本地化大额单位：zh「N 万」(÷1e4)，其余英文「NM」(÷1e6)。3,000,000 → zh "300 万" / en "3M"。 */
function fmtTokenAmount(oddStr: string, locale: string): string {
  const n = Number(oddStr);
  if (locale === "zh") return `${(n / 10_000).toLocaleString("en-US")} 万`;
  return `${(n / 1_000_000).toLocaleString("en-US")}M`;
}

/** USD 整数串格式化为「$30,000」（千分位）。 */
function toUsd(usdStr: string): string {
  return `$${Math.round(Number(usdStr)).toLocaleString("en-US")}`;
}

/** 开盘收益 = (DEX 开盘价 − 该档买入价) / 买入价 × 100，整数百分数串（"+1,550%"）。 */
function openGainPct(priceUsd: string): string {
  const price = Number(priceUsd);
  if (price <= 0) return "—";
  const pct = Math.round(((DEX_OPEN_PRICE_USD - price) / price) * 100);
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toLocaleString("en-US")}%`;
}

interface StatCard {
  value: string;
  desc: string;
}

export default function TierPricingTable() {
  // 文案走 i18n token.tier.*（zh 中文 / 其余英文）；万/M 单位按 locale 切换。
  const t = useTranslations("token");
  const locale = useLocale();
  const stats = t.raw("tier.stats") as StatCard[];
  const footnote = t("tier.footnote");
  const { saleState } = useTierSaleState();
  const currentTier = saleState?.currentTier ?? 0;

  const rows = TIERS.map((row) => ({
    tier: row.tier,
    price: `$${row.priceUsd}`,
    amount: fmtTokenAmount(row.amountOdd, locale),
    cumulativeSold: fmtTokenAmount(row.cumulativeSoldOdd, locale),
    cumulativeRaised: toUsd(row.cumulativeRaisedUsd),
    openGain: openGainPct(row.priceUsd),
    isCurrent: row.tier === currentTier,
  }));

  return (
    <section data-figma-pc="8604:118267" data-figma-h5="8754:107792" className="w-full">
      {/* ───────── H5（< md）：标题 + 3 卡纵列 + 4 列表 ───────── */}
      <div className="flex flex-col gap-6 px-4 py-10 md:hidden">
        <h2 className="font-noto-sc text-[26px] font-bold leading-[39px] text-primary">
          {t("tier.title")}
        </h2>

        <div className="flex flex-col gap-4">
          {stats.map((c) => (
            <StatCardView key={c.value} {...c} />
          ))}
        </div>

        <div className="overflow-clip rounded-[12px] border border-white/10">
          <div className="flex h-12 items-center bg-tertiary px-4 font-noto-sc text-[12px] font-medium leading-[18px] text-secondary">
            <span className="flex-1">{t("tier.colTier")}</span>
            <span className="flex-1">{t("tier.colPrice")}</span>
            <span className="flex-[1.2]">{t("tier.colAmount")}</span>
            <span className="flex-1">{t("tier.colSold")}</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.tier}
              className={`flex h-12 items-center border-t border-secondary px-4 font-noto-sc text-[13px] font-semibold leading-[18px] ${
                r.isCurrent ? "bg-white/[0.04]" : ""
              }`}
            >
              <span className="flex-1 text-primary">{t("tier.rowTier", { n: r.tier })}</span>
              <span className="flex-1 text-primary">{r.price}</span>
              <span className="flex-[1.2] text-primary">{r.amount}</span>
              <span className={`flex-1 ${r.isCurrent ? "text-brand-default" : "text-primary"}`}>
                {r.cumulativeSold}
              </span>
            </div>
          ))}
        </div>

        <p className="font-noto-sc text-[12px] font-normal leading-[18px] text-secondary">
          {footnote}
        </p>
      </div>

      {/* ───────── PC（md+）：标题 + 3 卡横排 + 6 列表 ───────── */}
      <div className="mx-auto hidden w-full max-w-[1440px] px-[120px] py-[80px] md:block">
        <h2 className="font-orbitron text-[48px] font-bold leading-[64px] tracking-[-1.44px] text-primary">
          {t("tier.title")}
        </h2>

        <div className="mt-10 flex gap-6">
          {stats.map((c) => (
            <StatCardView key={c.value} {...c} className="flex-1" />
          ))}
        </div>

        <div className="mt-10 overflow-clip rounded-[12px] border border-white/10">
          <div className="flex h-12 items-center bg-tertiary px-6 font-noto-sc text-[12px] font-medium leading-[18px] text-secondary">
            <span className="flex-1">{t("tier.colTier")}</span>
            <span className="flex-1">{t("tier.colPrice")}</span>
            <span className="flex-1">{t("tier.colAmount")}</span>
            <span className="flex-1">{t("tier.colSold")}</span>
            <span className="flex-1">{t("tier.colRaised")}</span>
            <span className="w-16 text-right">{t("tier.colGain")}</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.tier}
              className={`flex h-14 items-center border-t border-secondary px-6 font-noto-sc text-[14px] font-semibold leading-[18px] ${
                r.isCurrent ? "bg-white/[0.04]" : ""
              }`}
            >
              <span className="flex-1 text-primary">{t("tier.rowTier", { n: r.tier })}</span>
              <span className="flex-1 text-primary">{r.price}</span>
              <span className="flex-1 text-primary">{r.amount}</span>
              <span className={`flex-1 ${r.isCurrent ? "text-brand-default" : "text-primary"}`}>
                {r.cumulativeSold}
              </span>
              <span className="flex-1 text-primary">{r.cumulativeRaised}</span>
              <span className="w-16 text-right text-brand-default">{r.openGain}</span>
            </div>
          ))}
        </div>

        <p className="mt-10 max-w-[1191px] font-noto-sc text-[14px] font-normal leading-6 text-secondary">
          {footnote}
        </p>
      </div>
    </section>
  );
}

/** stat 卡：顶部 2px 薄荷线 + 标题 + 描述。bg/border 为 Figma 硬编码。 */
function StatCardView({ value, desc, className }: StatCard & { className?: string }) {
  return (
    <div
      // @figma-hardcoded: bg rgba(255,255,255,0.04) / border rgba(255,255,255,0.1) stat-card — pending design token
      className={`relative flex flex-col items-center gap-3 overflow-clip rounded-[12px] border border-white/10 bg-white/[0.04] p-8 ${className ?? ""}`}
    >
      <span
        aria-hidden
        className="absolute left-1/2 top-0 h-[2px] w-[92%] -translate-x-1/2 bg-brand-default"
      />
      <span className="font-noto-sc text-[20px] font-bold leading-7 text-primary">{value}</span>
      <span className="font-noto-sc text-[14px] font-normal leading-[18px] text-secondary">
        {desc}
      </span>
    </div>
  );
}
