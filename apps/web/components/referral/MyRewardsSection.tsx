import { useTranslations } from "next-intl";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";

const SUMMARY_STATS = [
  { key: "todaysEarnings", value: "245", unit: PLATFORM_TOKEN_DISPLAY, sub: "≈ $24.50" },
  { key: "monthlyTotal", value: "3,128", unit: PLATFORM_TOKEN_DISPLAY, sub: "≈ $312.80" },
  { key: "indirectClaimable", value: "75", unit: PLATFORM_TOKEN_DISPLAY, sub: "≈ $7.50" },
] as const;

const REWARD_CARDS = [
  { key: "directRebate", value: "245", sub: "≈ $24.50" },
  { key: "indirectRebate", value: "3,550", sub: "≈ $355" },
  { key: "firstDeposit", value: "3,550", sub: "≈ $355" },
  { key: "communityReward", value: "1,200", sub: "≈ $355" },
] as const;

export function MyRewardsSection() {
  const t = useTranslations("referral");
  return (
    <div className="pt-9 lg:pt-0 flex flex-col gap-5 lg:gap-6">
      {/* Section title */}
      <h2
        className="font-orbitron font-bold text-white text-center lg:text-left"
        style={{ fontSize: 20, lineHeight: "32px", letterSpacing: "-0.2px" }}
      >
        {t("myRewards")}
      </h2>

      {/* Part A: Summary — horizontal scroll on mobile, row bar on desktop */}
      {/* Mobile: scrollable cards */}
      <div className="flex gap-4 overflow-x-auto lg:hidden -mx-4 px-4 scrollbar-hide">
        {SUMMARY_STATS.map((stat) => (
          <div
            key={stat.key}
            className="bg-fill-card1 rounded-16 shrink-0 flex flex-col gap-2 justify-center px-4 py-5"
            style={{ width: 240 }}
          >
            <span
              className="text-secondary font-medium"
              style={{ fontSize: 12, lineHeight: "18px" }}
            >
              {t(stat.key)}
            </span>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-1">
                <span
                  className="font-bold text-primary"
                  style={{ fontSize: 20, lineHeight: "28px" }}
                >
                  {stat.value}
                </span>
                <span
                  className="font-medium text-primary"
                  style={{ fontSize: 12, lineHeight: "18px" }}
                >
                  {stat.unit}
                </span>
              </div>
              <span className="text-tertiary" style={{ fontSize: 12, lineHeight: "18px" }}>
                {stat.sub}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: row bar */}
      <div className="hidden lg:flex bg-fill-card2 rounded-16 flex-row" style={{ height: 128 }}>
        {SUMMARY_STATS.map((stat, i) => (
          <div key={stat.key} className="flex-1 flex items-center">
            <div className="flex-1 flex flex-col justify-center px-6 gap-1">
              <span className="text-secondary font-medium" style={{ fontSize: 12 }}>
                {t(stat.key)}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-primary" style={{ fontSize: 18 }}>
                  {stat.value}
                </span>
                <span className="font-medium text-primary" style={{ fontSize: 12 }}>
                  {stat.unit}
                </span>
              </div>
              <span className="text-tertiary" style={{ fontSize: 12 }}>
                {stat.sub}
              </span>
            </div>
            {i < SUMMARY_STATS.length - 1 && (
              <div className="border-l border-divider self-stretch my-7" />
            )}
          </div>
        ))}
      </div>

      {/* Divider between summary and reward cards — desktop only */}
      <div className="hidden lg:block h-px w-full bg-divider" />

      {/* Part B: Reward Cards — vertical list on mobile, 2×2 grid on desktop */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-6">
        {REWARD_CARDS.map((card) => (
          <div
            key={card.key}
            className="bg-fill-card1 lg:bg-transparent lg:border lg:border-divider-light rounded-16 flex flex-row justify-between items-center"
            style={{ padding: "8px 16px" }}
          >
            {/* Left: label + value + sub */}
            <div className="flex flex-col gap-2 py-4">
              <span className="text-secondary" style={{ fontSize: 14, lineHeight: "19px" }}>
                {t(card.key)}
              </span>
              <div className="flex items-baseline gap-1">
                <span
                  className="font-bold text-primary"
                  style={{ fontSize: 18, lineHeight: "26px" }}
                >
                  {card.value}
                </span>
                <span
                  className="font-medium text-primary"
                  style={{ fontSize: 12, lineHeight: "18px" }}
                >
                  {PLATFORM_TOKEN_DISPLAY}
                </span>
              </div>
              <span className="text-tertiary" style={{ fontSize: 12, lineHeight: "18px" }}>
                {card.sub}
              </span>
            </div>

            {/* Right: Claim button */}
            <button
              className="bg-fill-card2 lg:bg-fill-card2 rounded-8 text-primary font-medium min-h-[44px] lg:min-h-0"
              style={{ height: 32, width: 80, fontSize: 12 }}
            >
              {t("claim")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
