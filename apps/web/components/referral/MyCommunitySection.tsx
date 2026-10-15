import type { FC } from "react";
import { useTranslations } from "next-intl";

export const MyCommunitySection: FC = () => {
  const t = useTranslations("referral");

  return (
    <div className="pt-9 lg:pt-0 lg:mt-9">
      {/* Section title */}
      <h2
        className="font-orbitron font-bold text-primary text-center lg:hidden"
        style={{ fontSize: 20, lineHeight: "32px", letterSpacing: "-0.2px" }}
      >
        {t("myCommunity")}
      </h2>

      {/* Desktop: single card with 3-col row */}
      <div className="hidden lg:block bg-fill-card1 rounded-16 w-full" style={{ padding: "32px" }}>
        <h2
          className="font-orbitron font-bold text-primary"
          style={{ fontSize: 24, letterSpacing: "-0.24px" }}
        >
          {t("myCommunity")}
        </h2>
        <div className="flex mt-8" style={{ gap: "24px" }}>
          {[
            { label: t("communityLevel"), value: "S1" },
            { label: t("directReferrals"), value: "312" },
            { label: t("indirectReferrals"), value: "S1" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border border-divider-light rounded-16 flex-1 flex flex-col"
              style={{ padding: "16px" }}
            >
              <span className="text-secondary" style={{ fontSize: 14 }}>
                {stat.label}
              </span>
              <span className="font-bold text-primary" style={{ fontSize: 20 }}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: 1 full-width + 2 side-by-side */}
      <div className="flex flex-col gap-3 mt-6 lg:hidden">
        {/* Full-width: Community Level */}
        <div className="bg-fill-card1 rounded-16 px-4 py-6">
          <span className="text-secondary" style={{ fontSize: 12, lineHeight: "18px" }}>
            {t("communityLevel")}
          </span>
          <span
            className="block font-bold text-primary mt-2"
            style={{ fontSize: 18, lineHeight: "26px" }}
          >
            S1
          </span>
        </div>

        {/* Side-by-side: Direct + Indirect */}
        <div className="flex gap-3">
          <div className="bg-fill-card1 rounded-16 flex-1 px-4 py-6">
            <span className="text-secondary" style={{ fontSize: 12, lineHeight: "18px" }}>
              {t("directReferrals")}
            </span>
            <span
              className="block font-bold text-primary mt-2"
              style={{ fontSize: 18, lineHeight: "26px" }}
            >
              112
            </span>
          </div>
          <div className="bg-fill-card1 rounded-16 flex-1 px-4 py-6">
            <span className="text-secondary" style={{ fontSize: 12, lineHeight: "18px" }}>
              {t("indirectReferrals")}
            </span>
            <span
              className="block font-bold text-primary mt-2"
              style={{ fontSize: 18, lineHeight: "26px" }}
            >
              S1
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
