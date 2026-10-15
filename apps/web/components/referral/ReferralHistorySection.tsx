import type { FC } from "react";
import { useTranslations } from "next-intl";

const HISTORY_ROWS = [
  {
    address: "0x355...5560k",
    joined: "Oct 22, 2025 · 12:45",
    volume: "$45,665",
    rebate: "$466",
  },
  {
    address: "0x255...2089k",
    joined: "Oct 22, 2025 · 12:45",
    volume: "$45,665",
    rebate: "$466",
  },
  {
    address: "0x455...6988k",
    joined: "Oct 25, 2025 · 12:48",
    volume: "$39,665",
    rebate: "$466",
  },
  {
    address: "0x355...4588k",
    joined: "Oct 22, 2025 · 12:45",
    volume: "$45,665",
    rebate: "$466",
  },
  {
    address: "0x55...5566k",
    joined: "Oct 22, 2025 · 12:45",
    volume: "$45,665",
    rebate: "$466",
  },
];

export const ReferralHistorySection: FC = () => {
  const t = useTranslations("referral");
  const headers = [
    { key: "colAddress", align: "left" as const },
    { key: "colJoined", align: "left" as const },
    { key: "colBettingVolume", align: "left" as const },
    { key: "colRebateEarned", align: "left" as const },
  ];

  return (
    <div className="pt-9 lg:pt-0 lg:mt-9">
      {/* Section title */}
      <h2
        className="font-orbitron font-bold text-primary text-center lg:hidden"
        style={{ fontSize: 20, lineHeight: "32px", letterSpacing: "-0.2px" }}
      >
        {t("historyTitle")}
      </h2>

      {/* Desktop: card with bordered table */}
      <div className="hidden lg:block bg-fill-card1 rounded-16 w-full" style={{ padding: "32px" }}>
        <h2
          className="font-orbitron font-bold text-primary"
          style={{ fontSize: 24, letterSpacing: "-0.24px" }}
        >
          {t("historyTitle")}
        </h2>
        <div
          className="border border-divider-light rounded-16 overflow-hidden"
          style={{ marginTop: "32px" }}
        >
          <div className="flex items-center border-b border-divider-light" style={{ height: 72 }}>
            {headers.map((h, i) => (
              <div
                key={h.key}
                className={`${i === headers.length - 1 ? "shrink-0 w-[200px]" : "flex-1"} text-secondary`}
                style={{ fontSize: 14, padding: "0 16px" }}
              >
                {t(h.key)}
              </div>
            ))}
          </div>
          {HISTORY_ROWS.map((row, index) => (
            <div
              key={index}
              className={`flex items-center${index < HISTORY_ROWS.length - 1 ? " border-b border-divider-light" : ""}`}
              style={{ height: 64 }}
            >
              <div
                className="flex-1 font-medium text-primary"
                style={{ fontSize: 14, padding: "0 16px" }}
              >
                {row.address}
              </div>
              <div
                className="flex-1 font-medium text-primary"
                style={{ fontSize: 14, padding: "0 16px" }}
              >
                {row.joined}
              </div>
              <div
                className="flex-1 font-medium text-primary"
                style={{ fontSize: 14, padding: "0 16px" }}
              >
                {row.volume}
              </div>
              <div
                className="shrink-0 w-[200px] font-medium text-primary"
                style={{ fontSize: 14, padding: "0 16px" }}
              >
                {row.rebate}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: compact table in card */}
      <div className="bg-fill-card1 rounded-16 overflow-hidden mt-6 lg:hidden">
        {/* Header */}
        <div className="flex items-center border-b border-divider-light" style={{ height: 72 }}>
          {headers.map((h, i) => (
            <div
              key={h.key}
              className={`${i === 0 ? "shrink-0 w-[56px] px-2" : "flex-1 px-3"} text-secondary`}
              style={{ fontSize: 11, lineHeight: "16px" }}
            >
              {t(h.key)}
            </div>
          ))}
        </div>

        {/* Rows */}
        {HISTORY_ROWS.map((row, index) => (
          <div
            key={index}
            className={`flex items-center${index < HISTORY_ROWS.length - 1 ? " border-b border-divider-light" : ""}`}
            style={{ height: 64 }}
          >
            <div
              className="shrink-0 w-[56px] text-primary px-2 break-words"
              style={{ fontSize: 12, lineHeight: "18px" }}
            >
              {row.address}
            </div>
            <div className="flex-1 text-primary px-3" style={{ fontSize: 12, lineHeight: "18px" }}>
              {row.joined}
            </div>
            <div className="flex-1 text-primary px-3" style={{ fontSize: 12, lineHeight: "18px" }}>
              {row.volume}
            </div>
            <div className="flex-1 text-primary px-3" style={{ fontSize: 12, lineHeight: "18px" }}>
              {row.rebate}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
