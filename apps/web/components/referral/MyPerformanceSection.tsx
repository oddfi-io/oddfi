import type { FC } from "react";
import { useTranslations } from "next-intl";

export const MyPerformanceSection: FC = () => {
  const t = useTranslations("referral");
  const allStats = [
    { label: t("totalVolume"), value: "$38,420" },
    { label: t("personalVolume"), value: "$5,200" },
    { label: t("directVolume"), value: "$12,800" },
    { label: t("indirectVolume"), value: "$38,420" },
    { label: t("teamVolume"), value: "$20,600" },
  ];

  return (
    <div className="pt-9 lg:pt-0 lg:mt-9">
      {/* Section title */}
      <h2
        className="font-orbitron font-bold text-primary text-center lg:hidden"
        style={{ fontSize: 20, lineHeight: "32px", letterSpacing: "-0.2px" }}
      >
        {t("myPerformance")}
      </h2>

      {/* Desktop: single card with 5-col row */}
      <div className="hidden lg:block bg-fill-card1 rounded-16 w-full" style={{ padding: "32px" }}>
        <h2
          className="font-orbitron font-bold text-primary"
          style={{ fontSize: 24, letterSpacing: "-0.24px" }}
        >
          {t("myPerformance")}
        </h2>
        <div className="flex mt-8" style={{ gap: "24px" }}>
          {allStats.map((stat) => (
            <div
              key={stat.label}
              className="border border-divider-light rounded-16 flex-1 flex flex-col gap-2"
              style={{ padding: "24px 16px" }}
            >
              <span className="text-secondary" style={{ fontSize: 14, lineHeight: "19px" }}>
                {stat.label}
              </span>
              <span className="font-bold text-primary" style={{ fontSize: 18, lineHeight: "26px" }}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: 1 full-width + 2×2 grid */}
      <div className="flex flex-col gap-3 mt-6 lg:hidden">
        {/* Full-width: Total Volume */}
        <div className="bg-fill-card1 rounded-16 px-4 py-6">
          <span className="text-secondary" style={{ fontSize: 12, lineHeight: "18px" }}>
            {allStats[0].label}
          </span>
          <span
            className="block font-bold text-primary mt-2"
            style={{ fontSize: 18, lineHeight: "26px" }}
          >
            {allStats[0].value}
          </span>
        </div>

        {/* 2×2 grid */}
        {[allStats.slice(1, 3), allStats.slice(3, 5)].map((pair, rowIdx) => (
          <div key={rowIdx} className="flex gap-3">
            {pair.map((stat) => (
              <div key={stat.label} className="bg-fill-card1 rounded-16 flex-1 px-4 py-6">
                <span className="text-secondary" style={{ fontSize: 12, lineHeight: "18px" }}>
                  {stat.label}
                </span>
                <span
                  className="block font-bold text-primary mt-2"
                  style={{ fontSize: 18, lineHeight: "26px" }}
                >
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
