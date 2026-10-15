"use client";

import { useTranslations } from "next-intl";

interface AiAgentQuickChipsProps {
  onSelect: (text: string) => void;
}

/**
 * AI 聊天主界面 quick chips（DD-121 · Figma 6814:125022，Textbox/Cogni）。
 *
 * 3 个 pill：复用 aiChat.quickReplies.*（文案已自带 emoji 前缀），点击发送。
 * bg fill/input1(#111114) + border line/border-secondary(#212124) + h-40 pill。
 */
const CHIP_KEYS = ["match", "highOdds", "trending"] as const;

export function AiAgentQuickChips({ onSelect }: AiAgentQuickChipsProps) {
  const t = useTranslations("aiChat");

  return (
    <ul className="flex flex-wrap items-start justify-center gap-4">
      {CHIP_KEYS.map((key) => {
        const text = t(`quickReplies.${key}`);
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => onSelect(text)}
              // @figma-hardcoded: #212124 line/border-secondary — Figma 6814:125023 border
              className="flex h-10 cursor-pointer items-center rounded-[100px] border border-solid border-[#212124] bg-fill-card1 px-3 text-[12px] leading-[18px] text-primary transition hover:border-brand-default"
            >
              {text}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
