import Image from "next/image";
import type { FC } from "react";
import { useTranslations } from "next-intl";

const LEVEL_ROWS = [
  {
    level: "S0",
    teamVolume: "< $10,000",
    indirectBonus: "Direct rebate 5% only",
    oddBoost: "--",
    avatar: "/images/referral/level-s0.png",
    avatarBg: "/images/referral/level-s0-bg.svg",
  },
  {
    level: "S1",
    teamVolume: "≥ $10,000",
    indirectBonus: "+4%",
    oddBoost: "×1.2",
    avatar: "/images/referral/level-s1.png",
    avatarBg: "/images/referral/level-s1-bg.svg",
  },
  {
    level: "S2",
    teamVolume: "≥ $50,000",
    indirectBonus: "+8%",
    oddBoost: "×1.5",
    avatar: "/images/referral/level-s2.png",
    avatarBg: "/images/referral/level-s2-bg.svg",
  },
  {
    level: "S3",
    teamVolume: "≥ $100,000",
    indirectBonus: "+12%",
    oddBoost: "×2.0",
    avatar: "/images/referral/level-s3.png",
    avatarBg: "/images/referral/level-s3-bg.svg",
  },
  {
    level: "S4",
    teamVolume: "≥ $500,000",
    indirectBonus: "+16%",
    oddBoost: "×2.5",
    avatar: "/images/referral/level-s4.png",
    avatarBg: "/images/referral/level-s4-bg.svg",
  },
  {
    level: "S5",
    teamVolume: "≥ $1,000,000",
    indirectBonus: "+20%",
    oddBoost: "×3.0 + KOL Perks",
    avatar: "/images/referral/level-s5.png",
    avatarBg: "/images/referral/level-s5-bg.svg",
  },
];

/** Multi-colored progress hint — matches Figma spec */
function ProgressHint({ size }: { size: "sm" | "md" }) {
  const fs = size === "sm" ? 12 : 14;
  const lh = size === "sm" ? "18px" : "19px";
  return (
    <p style={{ fontSize: fs, lineHeight: lh }}>
      {/* @figma-hardcoded: multi-color progress hint — pending design token */}
      <span className="font-semibold text-white">$11,580</span>
      <span style={{ color: "#8b8d93" }}> more to reach </span>
      <span className="font-semibold text-white">S2</span>
      <span style={{ color: "#8b8d93" }}> — unlock </span>
      <span className="font-semibold" style={{ color: "#f4d03a" }}>
        +8% indirect bonus
      </span>
    </p>
  );
}

export const MyLevelSection: FC = () => {
  const t = useTranslations("referral");

  return (
    <div className="pt-9 lg:pt-0 lg:mt-9">
      {/* Section title — mobile */}
      <h2
        className="font-orbitron font-bold text-primary text-center lg:hidden"
        style={{ fontSize: 20, lineHeight: "32px", letterSpacing: "-0.2px" }}
      >
        {t("myLevel")}
      </h2>

      {/* Desktop: everything in one card. Mobile: separate cards */}
      <div className="lg:bg-fill-card1 lg:rounded-16 lg:w-full lg:p-8">
        {/* Desktop title */}
        <h2
          className="hidden lg:block font-orbitron font-bold text-primary"
          style={{ fontSize: 24, letterSpacing: "-0.24px" }}
        >
          {t("myLevel")}
        </h2>

        {/* ===== User Profile Bar ===== */}
        <div
          className="bg-fill-card1 lg:bg-fill-card2 rounded-16 flex flex-col lg:flex-row items-center mt-6 lg:mt-8"
          style={{ padding: "24px 16px" }}
        >
          {/* --- Mobile layout --- */}
          {/* Avatar + Name row */}
          <div className="flex items-center gap-3 w-full lg:hidden">
            <div className="relative shrink-0 w-[72px] h-[72px] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/referral/level-s1-bg.svg"
                alt=""
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              <Image
                src="/images/referral/avatar-level.png"
                alt="User avatar"
                width={72}
                height={72}
                sizes="72px"
                className="relative w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span
                className="font-orbitron font-bold shrink-0 flex items-center justify-center rounded-4 self-start"
                style={{
                  // @figma-hardcoded: #ffbe95 level-badge-bg — pending design token
                  background: "#ffbe95",
                  color: "#04060c",
                  width: 46,
                  height: 24,
                  fontSize: 18,
                  lineHeight: "32px",
                  padding: "2px 8px",
                  letterSpacing: "-0.18px",
                }}
              >
                S1
              </span>
              <span
                className="font-orbitron font-bold text-white"
                style={{ fontSize: 18, lineHeight: "32px", letterSpacing: "-0.18px" }}
              >
                Smith.eth
              </span>
            </div>
          </div>

          {/* Mobile: tags + progress */}
          <div className="flex flex-col gap-4 w-full mt-4 lg:hidden">
            <div className="flex items-center gap-1 flex-wrap">
              <span
                className="flex items-center rounded-8"
                style={{
                  fontSize: 10,
                  lineHeight: "14px",
                  padding: "2px 8px",
                  height: 24,
                  background: "rgba(246,143,21,0.1)",
                  color: "#f68f15",
                }}
              >
                {t("tagDirectRebate")}
              </span>
              <span
                className="bg-tag-green text-fn-green flex items-center rounded-8"
                style={{ fontSize: 10, lineHeight: "14px", padding: "2px 8px", height: 24 }}
              >
                {t("tagIndirectBonus")}
              </span>
              <span
                className="flex items-center rounded-8"
                style={{
                  fontSize: 10,
                  lineHeight: "14px",
                  padding: "2px 8px",
                  height: 24,
                  background: "rgba(244,208,58,0.1)",
                  color: "#f4d03a",
                }}
              >
                {t("tagOddBoost")}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-primary" style={{ fontSize: 12, lineHeight: "18px" }}>
                {t("progressTo", { level: "S2" })}
              </span>
              {/* @figma-hardcoded: #e5e7eb progress-value-text — pending design token */}
              <span style={{ fontSize: 12, lineHeight: "18px", color: "#e5e7eb" }}>
                $38,420 / $50,000
              </span>
            </div>

            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 8, background: "rgba(148,163,184,0.2)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: "77%",
                  // @figma-hardcoded: progress gradient — pending design token
                  background: "linear-gradient(to right, #ffbd99, #ff72b6)",
                }}
              />
            </div>

            <ProgressHint size="sm" />
          </div>

          {/* --- Desktop layout --- */}
          <div
            className="hidden lg:flex items-center w-full"
            style={{ gap: 32, padding: "4px 16px" }}
          >
            <div className="relative shrink-0 w-[140px] h-[140px] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/referral/level-s1-bg.svg"
                alt=""
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              <Image
                src="/images/referral/avatar-level.png"
                alt="User avatar"
                width={140}
                height={140}
                sizes="140px"
                className="relative w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 flex flex-col" style={{ gap: 12 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center" style={{ gap: 8 }}>
                  <span
                    className="font-orbitron font-bold shrink-0 flex items-center justify-center rounded-4"
                    style={{
                      // @figma-hardcoded: #ffbe95 level-badge-bg — pending design token
                      background: "#ffbe95",
                      color: "#04060c",
                      width: 46,
                      height: 24,
                      fontSize: 18,
                      lineHeight: "32px",
                      padding: "2px 8px",
                      letterSpacing: "-0.18px",
                    }}
                  >
                    S1
                  </span>
                  <span
                    className="font-orbitron font-bold text-primary"
                    style={{ fontSize: 24, letterSpacing: "-0.24px" }}
                  >
                    Smith.eth
                  </span>
                </div>
                <div className="flex items-center" style={{ gap: 4 }}>
                  {/* @figma-hardcoded: rgba(246,143,21,0.1) tag-orange-bg, #f68f15 tag-orange-text — pending design token */}
                  <span
                    className="font-medium flex items-center rounded-8"
                    style={{
                      fontSize: 11,
                      lineHeight: "16px",
                      padding: "2px 8px",
                      height: 24,
                      background: "rgba(246,143,21,0.1)",
                      color: "#f68f15",
                    }}
                  >
                    {t("tagDirectRebate")}
                  </span>
                  <span
                    className="bg-tag-green font-medium text-fn-green flex items-center rounded-8"
                    style={{ fontSize: 11, lineHeight: "16px", padding: "2px 8px", height: 24 }}
                  >
                    {t("tagIndirectBonus")}
                  </span>
                  {/* @figma-hardcoded: rgba(244,208,58,0.1) tag-yellow-bg, #f4d03a tag-yellow-text — pending design token */}
                  <span
                    className="font-medium flex items-center rounded-8"
                    style={{
                      fontSize: 11,
                      lineHeight: "16px",
                      padding: "2px 8px",
                      height: 24,
                      background: "rgba(244,208,58,0.1)",
                      color: "#f4d03a",
                    }}
                  >
                    {t("tagOddBoost")}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span
                  className="text-primary font-medium"
                  style={{ fontSize: 14, lineHeight: "19px" }}
                >
                  {t("progressTo", { level: "S2" })}
                </span>
                {/* @figma-hardcoded: #e5e7eb progress-value-text — pending design token */}
                <span style={{ fontSize: 14, lineHeight: "19px", color: "#e5e7eb" }}>
                  $38,420 / $50,000
                </span>
              </div>

              <div
                className="w-full rounded-full overflow-hidden"
                style={{ height: 12, background: "rgba(148,163,184,0.2)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: "77%",
                    // @figma-hardcoded: progress gradient — pending design token
                    background: "linear-gradient(to right, #ffbd99, #ff72b6)",
                  }}
                />
              </div>

              <ProgressHint size="md" />
            </div>
          </div>
        </div>

        {/* ===== Level Table ===== */}
        <div className="bg-fill-card1 lg:bg-transparent lg:border lg:border-divider-light rounded-16 overflow-hidden mt-4 lg:mt-8">
          {/* Header row */}
          <div className="flex items-center border-b border-divider-light" style={{ height: 72 }}>
            <div
              className="flex-1 text-secondary px-3 lg:pl-8 lg:pr-4"
              style={{ fontSize: 11, lineHeight: "16px" }}
            >
              <span className="lg:hidden">{t("colLevel")}</span>
              <span className="hidden lg:inline" style={{ fontSize: 14, lineHeight: "19px" }}>
                {t("colLevel")}
              </span>
            </div>
            {[t("colTeamVolume"), t("colIndirectBonusOdd"), t("colOddBoost")].map((header) => (
              <div
                key={header}
                className="flex-1 text-secondary px-3 lg:px-4"
                style={{ fontSize: 11, lineHeight: "16px" }}
              >
                <span className="lg:hidden">{header}</span>
                <span className="hidden lg:inline" style={{ fontSize: 14, lineHeight: "19px" }}>
                  {header}
                </span>
              </div>
            ))}
          </div>

          {/* Data rows */}
          {LEVEL_ROWS.map((row, index) => (
            <div
              key={index}
              className={`flex items-center${index < LEVEL_ROWS.length - 1 ? " border-b border-divider-light" : ""}`}
              style={{ height: 80 }}
            >
              {/* Level column */}
              <div className="flex-1 flex items-center gap-2 px-3 lg:pl-8 lg:pr-4">
                <div className="relative shrink-0 w-6 h-6 lg:w-[48px] lg:h-[48px] overflow-hidden">
                  {/* Background glow */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={row.avatarBg}
                    alt=""
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />
                  <Image
                    src={row.avatar}
                    alt={`Level ${row.level}`}
                    width={48}
                    height={48}
                    className="relative w-full h-full object-contain"
                  />
                </div>
                <span className="text-primary" style={{ fontSize: 12, lineHeight: "18px" }}>
                  <span className="lg:hidden">{row.level}</span>
                  <span
                    className="hidden lg:inline font-orbitron font-bold"
                    style={{ fontSize: 20, lineHeight: "32px", letterSpacing: "-0.2px" }}
                  >
                    {row.level}
                  </span>
                </span>
              </div>

              <div
                className="flex-1 text-primary px-3 lg:px-4"
                style={{ fontSize: 12, lineHeight: "18px" }}
              >
                <span className="lg:hidden">{row.teamVolume}</span>
                <span
                  className="hidden lg:inline font-medium"
                  style={{ fontSize: 14, lineHeight: "19px" }}
                >
                  {row.teamVolume}
                </span>
              </div>
              <div
                className="flex-1 text-primary px-3 lg:px-4"
                style={{ fontSize: 12, lineHeight: "18px" }}
              >
                <span className="lg:hidden">{row.indirectBonus}</span>
                <span
                  className="hidden lg:inline font-medium"
                  style={{ fontSize: 14, lineHeight: "19px" }}
                >
                  {row.indirectBonus}
                </span>
              </div>
              <div
                className="flex-1 text-primary px-3 lg:px-4"
                style={{ fontSize: 12, lineHeight: "18px" }}
              >
                <span className="lg:hidden">{row.oddBoost}</span>
                <span
                  className="hidden lg:inline font-medium"
                  style={{ fontSize: 14, lineHeight: "19px" }}
                >
                  {row.oddBoost}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
