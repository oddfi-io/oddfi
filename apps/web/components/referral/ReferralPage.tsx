import { HeroSection } from "./HeroSection";
import { MyRewardsSection } from "./MyRewardsSection";
import { MyReferralSection } from "./MyReferralSection";
import { FirstDepositBonusSection } from "./FirstDepositBonusSection";
import { ReferralStatsSection } from "./ReferralStatsSection";
import { MyLevelSection } from "./MyLevelSection";
import { MyCommunitySection } from "./MyCommunitySection";
import { MyPerformanceSection } from "./MyPerformanceSection";
import { ReferralHistorySection } from "./ReferralHistorySection";

export function ReferralPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-16">
      {/* Hero: Title + Beta Banner + Gift Image */}
      <div className="relative z-10">
        <HeroSection />
      </div>

      {/* My Referral — on mobile appears right after hero, on desktop inside rewards row */}
      <div className="lg:hidden">
        <MyReferralSection />
      </div>

      {/* Two-column on desktop: My Rewards (left) + My Referral (right) — with Subtract bg */}
      <div className="relative mt-5 lg:mt-5">
        {/* Background decorative shape (Subtract) — desktop only */}
        <div
          className="absolute inset-0 pointer-events-none hidden lg:block"
          style={{
            backgroundImage: "url('/images/referral/bg-shape.svg')",
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div className="relative z-10 lg:flex lg:gap-12 lg:p-8">
          <div className="flex-1 min-w-0">
            <MyRewardsSection />
          </div>
          <div className="hidden lg:block w-[432px] shrink-0 pt-[120px]">
            <MyReferralSection />
          </div>
        </div>
      </div>

      {/* First Deposit Bonus + Referral Stats — stacked on mobile, side-by-side on desktop */}
      <div className="lg:flex lg:gap-8">
        <FirstDepositBonusSection />
        <ReferralStatsSection />
      </div>

      {/* Full-width sections */}
      <MyLevelSection />
      <MyCommunitySection />
      <MyPerformanceSection />
      <ReferralHistorySection />
    </div>
  );
}
