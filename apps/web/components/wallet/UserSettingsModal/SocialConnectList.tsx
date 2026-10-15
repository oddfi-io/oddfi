"use client";

import { useTranslations } from "next-intl";
import TwitterConnectRow from "./TwitterConnectRow";

const TELEGRAM_ICON = "/images/footer/social-telegram.svg";

/**
 * Telegram 行 —— 后端未就绪，静态置灰 disabled 占位（不可点击、无 toast）。
 * 待 Telegram 后端落地后镜像 TwitterConnectRow，改成 binding 驱动的可连接行。
 */
function TelegramRow() {
  const t = useTranslations("userSettings");

  return (
    // @figma-hardcoded: #212124 social-row-border — same hex as fill/fill/input2 used here as border, no token yet
    <button
      type="button"
      disabled
      style={{ touchAction: "manipulation" }}
      className="flex items-center justify-between h-11 px-4 rounded-8 border border-[#212124] bg-transparent w-full opacity-50 cursor-not-allowed"
      aria-label="Telegram: coming soon"
    >
      <span className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={TELEGRAM_ICON} alt="Telegram" width={20} height={20} />
        <span className="text-[12px] leading-[18px] font-medium text-primary">Telegram</span>
      </span>
      <span className="text-[12px] leading-[18px] font-medium text-secondary">{t("connect")}</span>
    </button>
  );
}

/**
 * Connect Social Media 区块。X 行后端 binding 驱动（TwitterConnectRow 自管状态，不吃外部 props）；
 * Telegram 行后端未就绪，静态置灰 disabled。两者均无须父级传 socials，故不再接收该 prop。
 */
export default function SocialConnectList() {
  const t = useTranslations("userSettings");

  return (
    <div className="flex flex-col gap-3 w-full">
      <span className="text-[14px] leading-[18px] text-secondary">{t("connectSocialMedia")}</span>
      <div className="flex flex-col gap-3 w-full">
        {/* DD-148：X 行后端 binding 驱动（与 localStorage 假 profile 解耦） */}
        <TwitterConnectRow />
        {/* Telegram 后端未就绪：静态置灰，不可点击 */}
        <TelegramRow />
      </div>
    </div>
  );
}
