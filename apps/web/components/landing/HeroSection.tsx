import { useLocale, useTranslations } from "next-intl";
import HeroSloganCarousel from "./hero/HeroSloganCarousel";
import HeroVideo from "./hero/HeroVideo";

/**
 * §1 Hero Section
 * Figma 节点: 5864:3826 (ZH, 1440×810) / 5950:6579 (EN, 1440×810)
 *
 * 背景：viewport 撑满（蓝紫径向渐变 + 黑遮罩），1440 内层居中放女人抠图 + 文字。
 * 人物：jimeng-2026-04-25-4622 抠图 PNG (863×863, scale-x-100 翻转, 锚定内层 left=537/top=-53)
 *
 * 内容栏：48px 翻页轮播口号 + 20px gap + H1
 *   - ZH: 64px black / leading-84 / 512px 容器，line2 brand-default 强调
 *   - EN: 48px semibold / leading-68 / 680px 容器，双行均白色（Figma 5950:6582）
 */
export default function HeroSection() {
  const t = useTranslations("landing.hero");
  const locale = useLocale();
  const isZh = locale === "zh";
  return (
    <section
      data-section="hero"
      data-figma-node="4227:195077"
      className="sticky top-0 z-0 w-full overflow-clip rounded-bl-[36px] rounded-br-[36px]"
      style={{
        // @figma-hardcoded: rgb(14,13,18) hero-base-bg — pending design token
        backgroundColor: "rgb(14, 13, 18)",
        // @figma-hardcoded: 蓝紫双层渐变（蓝色主导）— pending design token
        // stops 沿对角线整体后移 5%，与下移后的视频光晕位置同步
        backgroundImage:
          "linear-gradient(90deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.2) 100%), linear-gradient(161.226deg, rgb(12,12,15) 60.865%, rgb(47,0,255) 77.892%, rgb(151,0,255) 93.317%)",
        height: 810,
      }}
    >
      {/* 内层固定 1440 居中，作为人物图 + 文字的锚定参照（不限制背景宽度） */}
      <div className="relative mx-auto h-full w-[1440px]">
        {/* 人物视频：1502×863 槽位（视频原生 16:9，避免 object-cover 硬切右侧），
            人像中心 x≈968 与原静态图保持一致；右侧溢出由 hero section overflow-clip 自然裁切，
            视频自带深色渐变背景与 hero 同色系融合，不需要额外 mask；
            top=70 让女人头顶完整露出 topnav（topnav 高 64/80px） */}
        <div className="pointer-events-none absolute left-[217px] top-[70px] h-[863px] w-[1502px]">
          <HeroVideo />
        </div>

        {/* 内容栏：翻页口号 + H1 */}
        <div
          data-figma-node={isZh ? "5864:3826" : "5950:6582"}
          className={`absolute left-[141px] flex -translate-y-1/2 flex-col items-start gap-[20px] ${
            isZh ? "w-[512px]" : "w-[680px]"
          }`}
          style={{ top: "calc(50% - 48.5px)" }}
        >
          <HeroSloganCarousel />

          {isZh ? (
            <h1
              data-figma-node="5864:3839"
              className="font-noto-sc text-[64px] font-black leading-[84px] tracking-[-2px] text-white"
            >
              <span className="block">{t("titleLine1")}</span>
              <span className="block text-white">{t("titleLine2")}</span>
            </h1>
          ) : (
            <h1
              data-figma-node="5950:6584"
              className="font-noto-sc text-[48px] font-semibold leading-[68px] text-white"
            >
              <span className="block whitespace-nowrap">{t("titleLine1")}</span>
              <span className="block whitespace-nowrap">{t("titleLine2")}</span>
            </h1>
          )}
        </div>
      </div>
    </section>
  );
}
