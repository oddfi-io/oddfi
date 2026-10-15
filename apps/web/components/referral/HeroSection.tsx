import Image from "next/image";
import { useTranslations } from "next-intl";

export function HeroSection() {
  const t = useTranslations("referral");
  return (
    <div className="relative w-full overflow-visible">
      {/* Hero gift image — desktop only (H5 removed per Figma 2381:108428) */}
      <div
        className="hidden lg:block lg:absolute lg:right-0 lg:top-[-24px] pointer-events-none"
        style={{ width: 358, height: 358 }}
      >
        <Image
          src="/images/referral/hero-img.png"
          alt="Referral hero"
          width={716}
          height={716}
          sizes="358px"
          quality={100}
          priority
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-5 pt-[32px] lg:pt-10 lg:max-w-[670px]">
        {/* Title */}
        <h1
          className="font-orbitron font-bold text-white text-center lg:text-left"
          style={{
            fontSize: 28,
            lineHeight: "36px",
            letterSpacing: "-0.28px",
          }}
        >
          {t("heroTitle")}
        </h1>

        {/* Subtitle — mobile only */}
        <p
          className="text-secondary text-center lg:hidden"
          style={{ fontSize: 14, lineHeight: "19px" }}
        >
          {t("heroSubtitle")}
        </p>

        {/* Beta Banner — fill-card1 bg, no border */}
        <div
          className="bg-fill-card1 rounded-16 flex flex-col gap-3"
          style={{ padding: "20px 16px" }}
        >
          {/* Top row: BETA tag + event text */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
            {/* @figma-hardcoded: #F68F151A beta-tag-bg — pending design token */}
            <span
              className="font-semibold rounded-full self-start text-warning"
              style={{
                background: "#F68F151A",
                fontSize: 11,
                lineHeight: "16px",
                padding: "3px 8px",
                letterSpacing: "0.5px",
              }}
            >
              {t("betaBadge")}
            </span>
            <span className="text-primary font-medium" style={{ fontSize: 12, lineHeight: "18px" }}>
              {t("bannerTitle")}
            </span>
          </div>

          {/* Perks list — vertical on mobile, horizontal on desktop */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-3 lg:flex-wrap">
            {[t("bannerItem1"), t("bannerItem2"), t("bannerItem3")].map((item) => (
              <div key={item} className="flex items-center gap-1">
                <span
                  className="rounded-full bg-fn-green flex-shrink-0"
                  style={{ width: 5, height: 5 }}
                />
                <span
                  className="text-secondary font-medium"
                  style={{ fontSize: 12, lineHeight: "18px" }}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
