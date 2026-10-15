"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEarlyBird } from "./EarlyBirdProvider";

interface Step2SocialFollowProps {
  onDone: () => void;
}

const SOCIAL_URLS = {
  x: "https://x.com/oddfilabs",
  telegram: "https://t.me/OddFi_Official",
} as const;

/**
 * Step2SocialFollow (DD-103)
 *
 * 早鸟登记成功后引导关注社媒。两个外跳行（X / Telegram）+ 「I Know」关闭按钮。
 * 无 OAuth 绑定，仅外跳官方主页；按 Figma 6088:3455 实现。
 */
export default function Step2SocialFollow({ onDone }: Step2SocialFollowProps) {
  const t = useTranslations("earlyBird.step2");
  const { rank } = useEarlyBird();

  return (
    <div className="flex flex-col gap-6 w-full">
      {rank !== null && (
        <div className="flex items-center justify-center rounded-8 bg-fill-input-modal px-3 py-2">
          <p className="text-[14px] leading-[18px] font-medium text-brand-default">
            {t("rankBadge", { rank })}
          </p>
        </div>
      )}

      {/* Follow intro — 14/regular secondary */}
      <p className="text-[14px] leading-[18px] text-secondary">{t("followIntro")}</p>

      {/* Social rows */}
      <div className="flex flex-col gap-3">
        <SocialRow
          href={SOCIAL_URLS.x}
          iconSrc="/images/early-bird/x-white.svg"
          label={t("xHandle")}
          cta={t("followCta")}
        />
        <SocialRow
          href={SOCIAL_URLS.telegram}
          iconSrc="/images/footer/social-telegram.svg"
          label={t("tgHandle")}
          cta={t("joinCta")}
        />
      </div>

      {/* Done — Figma: 48h, btn-tertiary bg, text-primary */}
      <button
        type="button"
        onClick={onDone}
        className="mt-2 inline-flex h-[48px] w-full items-center justify-center rounded-12 bg-btn-tertiary px-4 text-[14px] leading-[18px] font-medium text-primary transition-colors hover:bg-btn-tertiary-hover touch-manipulation"
        style={{ touchAction: "manipulation" }}
      >
        {t("doneCta")}
      </button>
    </div>
  );
}

interface SocialRowProps {
  href: string;
  iconSrc: string;
  label: string;
  cta: string;
}

function SocialRow({ href, iconSrc, label, cta }: SocialRowProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="flex h-[44px] w-full items-center justify-between rounded-8 border px-4 transition-colors hover:bg-fill-input-modal touch-manipulation"
      style={{ borderColor: "#212124" }}
      /* @figma-hardcoded: #212124 social-row-border — token 同色但语义不同，保留裸值 */
    >
      <span className="flex items-center gap-2">
        <span className="relative size-[20px] shrink-0">
          <Image src={iconSrc} alt="" fill sizes="20px" />
        </span>
        <span className="text-[12px] leading-[18px] font-medium text-primary">{label}</span>
      </span>
      <span className="text-[12px] leading-[18px] font-medium text-brand-default">{cta}</span>
    </a>
  );
}
