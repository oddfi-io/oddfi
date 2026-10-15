import dynamic from "next/dynamic";
import { cookies } from "next/headers";
import HeroSection from "./HeroSection";
import HotMarketsSection from "./HotMarketsSection";
import MatchesGlassWall from "./MatchesGlassWall";
import BrandMarquee from "./BrandMarquee";
import LandingComingSoonMobile from "./LandingComingSoonMobile";
import LandingMobile from "./mobile/LandingMobile";
import {
  IS_EARLY_BIRD_MODE,
  EB_BYPASS_COOKIE,
  isEarlyBirdBypassValid,
} from "@/lib/early-bird-mode";
// Server Components — 静态导入（SSR 直接渲染，不走 dynamic）
import OddTokenSection from "./OddTokenSection";
import AiAgentSection from "./AiAgentSection";
import RoadmapSection from "./RoadmapSection";
import CtaSection from "./CtaSection";
import PartnersSection from "./PartnersSection";

// Client Components ("use client") — dynamic() 拆分为独立 JS chunk，降低首屏解析量
const TradeShowcaseSection = dynamic(() => import("./TradeShowcaseSection"), {
  loading: () => <div className="w-full bg-primary" style={{ height: 700 }} />,
});
const StatsSection = dynamic(() => import("./StatsSection"), {
  loading: () => <div className="w-full bg-primary" style={{ height: 400 }} />,
});
const AdvantagesSection = dynamic(() => import("./AdvantagesSection"), {
  loading: () => <div className="w-full bg-primary" style={{ height: 600 }} />,
});
const FaqSection = dynamic(() => import("./FaqSection"), {
  loading: () => <div className="w-full bg-primary" style={{ height: 700 }} />,
});

export default async function LandingPage() {
  // DD-103 续：bypass cookie（值=INVITE_CODE）匹配 → 渲染完整 landing，不走 Coming Soon
  const bypass = IS_EARLY_BIRD_MODE
    ? isEarlyBirdBypassValid((await cookies()).get(EB_BYPASS_COOKIE)?.value)
    : false;
  const earlyBirdActive = IS_EARLY_BIRD_MODE && !bypass;

  return (
    <main className="bg-primary text-primary md:-mt-[64px] lg:-mt-[80px] overflow-x-clip">
      {/* DD-114: H5 不再跳 /markets；按早鸟模式分支渲染 Mobile 内容。
          - 早鸟模式（IS_EARLY_BIRD_MODE，testnet 邀请码场景）→ LandingComingSoonMobile 占位
          - 非早鸟模式（主线认购模式）→ LandingMobile 新落地页 */}
      <div className="md:hidden">
        {earlyBirdActive ? <LandingComingSoonMobile /> : <LandingMobile />}
      </div>
      {/* PC sections — 始终 hidden md:block，独立于早鸟分支 */}
      <div className="hidden md:block">
        {/* sticky 父级范围 = Hero + HotMarkets + GlassWall — Hero sticky top-0 在该范围内固定，
            HotMarkets 用 -mt-100 z-20 咬入 Hero（cloud + 按钮 + carousel 合并为单一图层），
            滚出 GlassWall 后 sticky 解除（被 BrandMarquee 等后续 section 顶替） */}
        <div className="relative">
          <HeroSection />
          <HotMarketsSection />
          <MatchesGlassWall />
        </div>
        <BrandMarquee />
        <TradeShowcaseSection />
        <StatsSection />
        <OddTokenSection />
        <AdvantagesSection />
        <AiAgentSection />
        <RoadmapSection />
        <FaqSection />
        <CtaSection />
        <PartnersSection />
      </div>
    </main>
  );
}
