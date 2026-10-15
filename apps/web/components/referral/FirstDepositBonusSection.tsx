import Image from "next/image";
import { useTranslations } from "next-intl";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";

const BONUS_TIERS = [
  { amount: "50", bonus: "+10", inviterAmount: "5" },
  { amount: "200", bonus: "+50", inviterAmount: "25" },
  { amount: "500", bonus: "+150", inviterAmount: "75" },
  { amount: "1,000", bonus: "+350", inviterAmount: "175" },
] as const;

export function FirstDepositBonusSection() {
  const t = useTranslations("referral");
  return (
    <div className="pt-9 lg:pt-0 lg:mt-9 lg:flex-1">
      {/* On desktop: wrapped in card. On mobile: no outer card */}
      <div className="lg:bg-fill-card1 lg:rounded-16 lg:p-8 flex flex-col">
        {/* Title */}
        <h2
          className="font-orbitron font-bold text-white text-center lg:text-left"
          style={{ fontSize: 20, lineHeight: "32px", letterSpacing: "-0.2px" }}
        >
          {t("firstDepositTitle")}
        </h2>

        {/* Bonus tier grid 2×2 */}
        <div className="grid grid-cols-2 gap-3 lg:gap-6 mt-6 lg:mt-8">
          {BONUS_TIERS.map((tier) => (
            <div
              key={tier.amount}
              className="bg-fill-card1 lg:bg-fill-card2 lg:border lg:border-divider-light rounded-16 flex flex-row justify-between items-center relative overflow-hidden"
              style={{ padding: "20px 12px" }}
            >
              {/* Left: requirement + bonus + inviter */}
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <span
                  className="text-primary font-medium"
                  style={{ fontSize: 12, lineHeight: "18px" }}
                >
                  {t("firstDepositThreshold", { amount: tier.amount })}
                </span>
                <div className="flex items-baseline gap-1">
                  <span
                    className="font-bold text-green"
                    style={{ fontSize: 20, lineHeight: "28px" }}
                  >
                    {tier.bonus}
                  </span>
                  <span
                    className="text-green font-medium"
                    style={{ fontSize: 12, lineHeight: "18px" }}
                  >
                    {PLATFORM_TOKEN_DISPLAY}
                  </span>
                </div>
                <span className="text-secondary" style={{ fontSize: 12, lineHeight: "18px" }}>
                  {t("inviterBonus", { amount: tier.inviterAmount })}
                </span>
              </div>

              {/* Right: coin image — on H5 absolute as background decoration, on desktop inline */}
              <Image
                src="/images/referral/coin.svg"
                alt="coin"
                width={65}
                height={49}
                sizes="65px"
                className="shrink-0 absolute right-2 bottom-2 lg:relative lg:right-auto lg:bottom-auto"
              />
            </div>
          ))}
        </div>

        {/* Beta notice — desktop only */}
        <div className="hidden lg:flex items-center gap-1 mt-6">
          <Image
            src="/images/referral/info-icon.svg"
            alt="info"
            width={16}
            height={16}
            sizes="16px"
            className="shrink-0"
          />
          <span className="text-orange" style={{ fontSize: 11 }}>
            {t("firstDepositNote")}
          </span>
        </div>
      </div>
    </div>
  );
}
