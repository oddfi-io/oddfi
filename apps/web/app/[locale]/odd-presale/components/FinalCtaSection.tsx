"use client";

import { useCallback } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * DD-146 B11 Final CTA —— Figma PC 8604:119419 / H5 8754:108411。
 *
 * 替代旧 TokenCtaSection。「现在参与，锁定最低档价格」+ 3 容器（第1档$0.01 / 售罄上DEX / 建池后29天）
 * + button（锚定购买区，scrollIntoView 到 BuySection #tiersale-buy）。
 *
 * 背景：Figma 8604:119469 币放射光底图（opacity-10 mix-blend-difference 淡纹理，源图压至 1920w/jpg）
 *   + 上下渐隐带（Rectangle 133/134，与页面底色衔接）。3 容器为毛玻璃（白 10% 描边 + 微白底 + backdrop-blur）。
 * Token：bg-btn-primary（按钮）· text-static-black（按钮文字）· text-primary。
 */
export default function FinalCtaSection() {
  const t = useTranslations("token");

  const scrollToBuy = useCallback(() => {
    if (typeof document === "undefined") return;
    document.getElementById("tiersale-buy")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const cards: { title: string; desc: string }[] = [
    { title: t("finalCta.card1Title"), desc: t("finalCta.card1Desc") },
    { title: t("finalCta.card2Title"), desc: t("finalCta.card2Desc") },
    { title: t("finalCta.card3Title"), desc: t("finalCta.card3Desc") },
  ];

  return (
    <section
      data-figma-pc="8604:119419"
      data-figma-h5="8754:108411"
      className="relative w-full overflow-hidden"
    >
      {/* 背景：币放射光底图（Figma 8604:119469，opacity-10 mix-blend-difference 淡纹理） */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-10 mix-blend-difference"
      >
        <Image
          src="/images/token/final-cta-bg.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
      </div>
      {/* 上下渐隐带（Figma Rectangle 133/134）：与页面底色衔接 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[58px] bg-gradient-to-b from-primary to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[58px] bg-gradient-to-t from-primary to-transparent"
      />

      <div className="relative mx-auto flex w-full max-w-[1200px] flex-col items-center gap-8 px-4 py-14 text-center md:gap-10 md:px-[120px] md:py-24">
        <div className="flex flex-col items-center gap-4 md:gap-6">
          <h2 className="font-orbitron text-[28px] font-bold leading-9 tracking-[-0.28px] text-primary md:text-[52px] md:leading-[68px] md:tracking-[-1.56px]">
            {t("finalCta.title")}
          </h2>
          <p className="max-w-[558px] font-noto-sc text-[14px] font-normal leading-6 text-primary md:text-[16px]">
            {t("finalCta.subtitle")}
          </p>
        </div>

        {/* 3 容器 */}
        <div className="flex w-full flex-col gap-4 md:flex-row md:gap-6">
          {cards.map((c) => (
            <div
              key={c.title}
              className="flex flex-1 flex-col gap-1 rounded-[12px] border border-white/10 bg-white/[0.04] px-[27px] py-6 backdrop-blur-md"
            >
              <span className="font-noto-sc text-[15px] font-semibold leading-normal text-primary">
                {c.title}
              </span>
              <span className="font-noto-sc text-[13px] font-normal leading-normal text-white/70">
                {c.desc}
              </span>
            </div>
          ))}
        </div>

        {/* CTA：锚定购买区 */}
        <button
          type="button"
          onClick={scrollToBuy}
          style={{ touchAction: "manipulation" }}
          className="flex h-12 w-full max-w-[240px] items-center justify-center gap-2 rounded-[12px] bg-btn-primary px-4 py-2 font-noto-sc text-[14px] font-medium leading-[18px] text-static-black transition-opacity hover:opacity-90"
        >
          {t("finalCta.cta")}
        </button>
      </div>
    </section>
  );
}
