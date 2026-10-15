import MobileLandingHeader from "./MobileLandingHeader";
import MobileHero from "./MobileHero";
import MobileHeroVideo from "./MobileHeroVideo";
import MobilePredictionSection from "./MobilePredictionSection";
import MobileStickyConnectCta from "./MobileStickyConnectCta";

/**
 * DD-114 H5 落地页根容器
 *
 * Figma 6937:64255 完整长图（375×1210）
 * 仅在 md:hidden 下渲染（PC 渲染 LandingPage 现有 13 sections）
 *
 * 布局：
 *   - 固定 64px 顶栏 + 80px 吸底 CTA
 *   - 主体 padding-top 64 + padding-bottom 80（含 safe-area）
 *   - section 顺序：Hero 文案 → 视频 → 预测卡
 */
export default function LandingMobile() {
  return (
    <div className="relative w-full bg-primary text-primary">
      <MobileLandingHeader />
      <main className="pt-[64px] pb-[calc(64px+env(safe-area-inset-bottom))]">
        <MobileHero />
        <MobileHeroVideo />
        <MobilePredictionSection />
      </main>
      <MobileStickyConnectCta />
    </div>
  );
}
