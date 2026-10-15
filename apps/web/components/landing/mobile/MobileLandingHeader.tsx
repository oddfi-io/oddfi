import Link from "next/link";
import { XIcon } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

/**
 * Figma 6937:64305 — H5 落地页顶部 header（375×64）
 *
 * 与 TopNav 关系：TopNav 在 isLanding 时 `max-md:hidden`，H5 由本组件接管。
 */
export default function MobileLandingHeader() {
  const t = useTranslations("landing.mobile");
  return (
    <header
      data-figma-node="6937:64305"
      className="fixed top-0 left-0 right-0 z-40 h-[64px] bg-primary flex items-center justify-between px-[16px]"
    >
      <Link
        href="/markets"
        data-figma-node="6937:64306"
        className="relative shrink-0 flex items-center gap-[6.154px]"
        aria-label="OddFi"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo-icon-mint.svg" alt="" className="w-[24.615px] h-[18.462px]" />
        <span className="font-orbitron font-bold text-primary text-[23.85px] leading-normal">
          oddfi
        </span>
      </Link>

      <Link
        href="/markets"
        aria-label={t("headerClose")}
        className="flex items-center justify-center h-[44px] w-[44px] -mr-[10px]"
        style={{ touchAction: "manipulation" }}
      >
        {/* @figma-hardcoded: #212124 fill/fill/input2 — pending design token */}
        <span className="flex items-center justify-center size-[24px] rounded-[6px] bg-[#212124]">
          <XIcon size={16} weight="bold" className="text-primary" />
        </span>
      </Link>
    </header>
  );
}
