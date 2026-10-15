"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import WorldCupTrophyIcon from "@/components/icons/WorldCupTrophyIcon";
import StartPredictionButton from "@/components/landing/markets/StartPredictionButton";

/**
 * DD-146 TokenHero — 公开发售 banner（Figma 8604:53552 PC / 8754:94106 H5）。
 *
 * 背景为硬币放射动画视频（复用 `public/videos/invest-hero.mp4`，正是 DD §B5 占位注释所指的
 * 「jimeng 硬币放射动图」资源）：PC `object-cover` 全幅铺底被 section 圆角裁切；H5 顶部 375×219
 * 内嵌视频横幅 + 径向暗角 + 底部渐隐到 bg（沿用原认购页 InvestHero 处理，自上而下排文案）。
 *
 * 内容：世界杯 badge + 主标题 + 当前档位提示 + 「立即购买」CTA（StartPredictionButton 薄荷渐变药丸，
 * 点击平滑滚动到购买区 BuySection `#tiersale-buy`）。无 props（文案静态 / 视频自播）。
 */
export default function TokenHero() {
  const t = useTranslations("token");

  const scrollToBuy = useCallback(() => {
    if (typeof document === "undefined") return;
    document.getElementById("tiersale-buy")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    // PC：md:sticky top-0 z-0 钉顶 —— 下方内容区（OddPresaleContent 凸起 -mt z-20 + 云朵）随滚动整体上移盖住 Hero。
    // H5：relative 普通流（凸起在 OddPresaleContent 那侧 md: 才生效），CTA 已在 Hero 内。
    <section
      data-figma-pc="8604:53552"
      data-figma-h5="8754:94106"
      // @figma-hardcoded: #0c0c0e hero-bg — pending design token
      className="relative w-full overflow-clip bg-[#0c0c0e] md:sticky md:top-0 md:z-0"
    >
      {/* PC 背景：硬币放射动画视频 object-cover 铺满，被 section 圆角裁切 */}
      <video
        aria-hidden
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="pointer-events-none absolute inset-0 hidden size-full object-cover md:block"
      >
        <source src="/videos/invest-hero.mp4" type="video/mp4" />
      </video>

      {/* PC 左侧暗角径向渐变（Figma 8604:53555：让左侧文案在视频上可读） */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden md:block"
        style={{
          // @figma-hardcoded: radial dark vignette 8604:53555 — pending design token
          backgroundImage:
            "radial-gradient(75% 185% at 61% 50%, rgba(12,12,15,0) 0%, rgba(12,12,15,0.5) 34%, rgba(12,12,14,1) 100%)",
        }}
      />

      {/* H5 视频横幅：顶部 375×219（等比缩放）+ 径向暗角 + 底部 61px 渐隐到 bg */}
      <div className="relative aspect-[375/219] w-full overflow-clip md:hidden">
        <video
          aria-hidden
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          // 源视频硬币盘偏右(~61%)：H5 撑满高度裁两侧时，object-position-x 87% 把硬币盘移回画面中央
          className="pointer-events-none absolute inset-0 size-full object-cover object-[87%_50%]"
        >
          <source src="/videos/invest-hero.mp4" type="video/mp4" />
        </video>
        {/* @figma-hardcoded: 径向暗角 rgba(12,12,15,0)→rgba(12,12,15,0.7) — pending design token */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 81% 84% at 50% 47%, rgba(12,12,15,0) 0%, rgba(12,12,15,0.7) 100%)",
          }}
        />
        {/* @figma-hardcoded: 底部渐隐 rgba(12,12,15,0)→#0c0c0e（11.475% 起）— pending design token */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[61px]"
          style={{
            background: "linear-gradient(to bottom, rgba(12,12,15,0) 11.475%, #0c0c0e 100%)",
          }}
        />
      </div>

      {/* 内容块：H5 在视频横幅下方常规排布；PC 叠加在全幅视频之上（左对齐 + 上下大留白） */}
      <div className="relative mx-auto flex max-w-[1440px] flex-col items-start gap-6 px-4 pb-12 pt-3 md:px-[150px] md:py-[120px]">
        {/* 世界杯 badge 行：复用顶部导航的大力神杯图标（components/icons/WorldCupTrophyIcon，固定金色） */}
        <div className="flex items-center gap-2">
          <WorldCupTrophyIcon className="h-9 w-auto shrink-0 md:h-11" />
          <p className="text-[16px] font-medium text-primary md:text-[24px]">{t("hero.badge")}</p>
        </div>

        {/* 主标题 */}
        <h1 className="text-[36px] font-bold leading-tight text-primary md:text-[56px] md:leading-[72px]">
          <span className="block">{t("hero.titleLine1")}</span>
          <span className="block">{t("hero.titleLine2")}</span>
        </h1>

        {/* 当前档位提示：透明玻璃底（复用旧 TGE 倒计时格 glass 样式） */}
        {/* @figma-hardcoded: glass（rgba 白描边 white/10 + 半透明白填充 white/5）— pending design token */}
        <div className="flex max-w-[560px] rounded-16 border border-white/10 bg-white/[0.05] p-4">
          <p className="text-[14px] font-normal leading-6 text-primary">
            {t.rich("hero.tierHint", {
              mint: (chunks) => <span className="text-brand-default">{chunks}</span>,
            })}
          </p>
        </div>

        {/* 立即购买 CTA：H5 内联（260×48 薄荷渐变药丸），滚动到购买区。
            PC 的 CTA 落在 OddPresaleContent 凸起下边缘居中（与线上 invest 同位）→ 此处仅 H5。 */}
        <StartPredictionButton
          onClick={scrollToBuy}
          label={t("hero.cta")}
          size="h5"
          className="mt-2 md:hidden"
        />
      </div>
    </section>
  );
}
