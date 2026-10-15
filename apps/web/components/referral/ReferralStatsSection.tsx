import type { FC } from "react";
import { useTranslations } from "next-intl";

const STATS = [
  { key: "walletsReferred", value: "120" },
  { key: "totalRebates", value: "$355" },
] as const;

export const ReferralStatsSection: FC = () => {
  const t = useTranslations("referral");
  return (
    <div className="pt-9 lg:pt-0 lg:mt-9 lg:shrink-0 lg:w-[379px] lg:self-stretch">
      {/* On desktop: single card with stacked stats. On mobile: title + side-by-side cards */}
      <h2
        className="font-orbitron font-bold text-primary text-center lg:hidden"
        style={{ fontSize: 20, lineHeight: "32px", letterSpacing: "-0.2px" }}
      >
        {t("statsTitle")}
      </h2>

      {/* Mobile: two cards side by side */}
      <div className="flex gap-3 mt-6 lg:hidden">
        {STATS.map((stat) => (
          <div
            key={stat.key}
            className="bg-fill-card1 rounded-16 flex-1 flex flex-col gap-2 px-3 py-6"
          >
            <span className="text-secondary" style={{ fontSize: 12, lineHeight: "18px" }}>
              {t(stat.key)}
            </span>
            <span className="font-bold text-primary" style={{ fontSize: 20, lineHeight: "28px" }}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Desktop: single card with stacked stats */}
      <div
        className="hidden lg:flex lg:flex-col bg-fill-card1 rounded-16 h-full"
        style={{ padding: "32px" }}
      >
        <h2
          className="font-orbitron font-bold text-primary"
          style={{ fontSize: 24, letterSpacing: "-0.24px" }}
        >
          {t("statsTitle")}
        </h2>
        <div className="flex flex-col flex-1 mt-8" style={{ gap: "24px" }}>
          {STATS.map((stat) => (
            <div
              key={stat.key}
              className="border border-divider-light rounded-16 flex flex-col flex-1 justify-center"
              style={{ padding: "8px 16px" }}
            >
              <span className="text-secondary" style={{ fontSize: 14 }}>
                {t(stat.key)}
              </span>
              <span className="font-bold text-primary" style={{ fontSize: 20 }}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
