"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import PartnersSection from "@/components/landing/PartnersSection";
import StartPredictionButton from "@/components/landing/markets/StartPredictionButton";
import TokenHero from "./components/TokenHero";
import BuySection from "./components/BuySection";
import ReferralSection from "./components/ReferralSection";
import MyPurchaseSection from "./components/MyPurchaseSection";
import RecordsSection from "./components/RecordsSection";
import TokenMetrics from "./components/TokenMetrics";
import TokenDistribution from "./components/TokenDistribution";
import TierPricingTable from "./components/TierPricingTable";
import UnlockSchedule from "./components/UnlockSchedule";
import FinalCtaSection from "./components/FinalCtaSection";

/**
 * Token 页（DD-146）— 编排层
 *
 * DD-146 B11：编排重写为 TierSale 经济模型新结构（旧 SaleSection / FlywheelSection / TokenCtaSection
 *           + useLivePresaleMachine / buildSaleRounds 全部移除，下线于 B15）。
 *           section 顺序按 Figma 整页 8604:53551（H5 8754:94103）自上而下排列。
 *
 * 凸起机制（复用线上 invest 认购页 InvestContent）：PC sticky Hero + 内容区 -mt z-20 咬入 Hero，
 *           「立即购买」CTA 居中落在凸起下边缘，云朵浮层复用 invest subscribe-bg-glow.svg。
 *           cloudSvg 由 server 端 page.tsx fs 读 raw 字符串 inline 注入（backdrop-filter / feTurbulence 需 inline 才生效）。
 */
export default function OddPresaleContent({ cloudSvg }: { cloudSvg: string }) {
  const t = useTranslations("token");

  const scrollToBuy = useCallback(() => {
    if (typeof document === "undefined") return;
    document.getElementById("tiersale-buy")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="w-full overflow-x-clip bg-primary">
      {/* 滚动区（复用 invest InvestContent：sticky Hero + 内容 -mt z-20）：relative 限定 sticky 作用域，
          TokenHero 钉顶，下方内容区随滚动整体向上盖住 Hero。滚出后 sticky 解除。 */}
      <div className="relative">
        {/* Hero banner（DD-146 B5）。H5 的「立即购买」在 Hero 内；PC 的落在下方凸起边缘 */}
        <TokenHero />

        {/* 内容区凸起：--invest-protrusion = 凸起高度，单一真值（云朵 -mt 咬入量 + 不透明底起点）。
            H5 归零（无云朵 / 无咬入 / 非 sticky，TokenHero 内已自带视频横幅 + 立即购买）；PC 维持 108px。 */}
        <div className="relative z-20 -mt-[var(--invest-protrusion)] [--invest-protrusion:0px] md:[--invest-protrusion:108px]">
          {/* 不透明底：仅 PC sticky 场景需要（盖住 z-0 Hero 防视频漏出）。H5 无 sticky → hidden。 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 top-[var(--invest-protrusion)] hidden bg-primary md:block"
          />
          {/* 凸起背景云朵：PC 专属（咬入 Hero 的绿边凹槽浮层，复用 invest subscribe-bg-glow.svg）。H5 不展示 → hidden md:block。
              @figma-hardcoded: 绿边渐变 + noise — pending design token */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 hidden aspect-[1440/1053] w-full select-none md:block md:aspect-auto md:h-[1053px]"
            dangerouslySetInnerHTML={{ __html: cloudSvg }}
          />

          {/* PC「立即购买」CTA：居中落在凸起下边缘（与线上 invest 同位），点击滚动到购买区。
              H5 的 CTA 已在 TokenHero 内 → 此处 hidden md:block。 */}
          <StartPredictionButton
            onClick={scrollToBuy}
            label={t("hero.cta")}
            size="lg"
            className="absolute left-1/2 top-[10px] z-10 hidden max-w-[calc(100%-40px)] -translate-x-1/2 md:block md:top-[27px]"
          />

          {/* 内容（relative z-[1] 浮于云朵之上）。md:pt-[112px] 补偿 -108 凸起，让首屏购买区落到接缝下方。 */}
          <div className="relative z-[1] md:pt-[112px]">
            {/* TierSale 购买闭环（DD-146 核心，#tiersale-buy 锚点供 Hero CTA / FinalCta 滚动） */}
            <BuySection />

            {/* 邀请返佣（DD-146 B8） */}
            <ReferralSection />

            {/* 我的购买（DD-146 B9） */}
            <MyPurchaseSection />

            {/* 记录（DD-146 B10） */}
            <RecordsSection />

            {/* 代币核心指标 KPI（DD-146 B7a） */}
            <TokenMetrics />

            {/* 代币分配 donut（DD-146 B7a） */}
            <TokenDistribution />

            {/* 阶梯定价表（DD-146 B6） */}
            <TierPricingTable />

            {/* 释放曲线 + 逐日释放表（DD-146 B7b） */}
            <UnlockSchedule />

            {/* Final CTA（DD-146 B11，按钮锚定购买区） */}
            <FinalCtaSection />

            {/* 底部：合作伙伴 marquee + 响应式 Footer/MobileFooter（复用 PartnersSection，含 Figma 8649:64267 marquee + 8604:53746 Footer，两者在本仓融合于该组件，置于页尾） */}
            <PartnersSection />
          </div>
        </div>
      </div>
    </div>
  );
}
