"use client";

import { useTranslations } from "next-intl";

interface ChatQuickRepliesProps {
  onSelect: (text: string) => void;
}

/**
 * AI 聊天快捷回复条（Figma 6613:54772）。
 * 无消息时显示在消息区域底部，水平滚动排列。
 */
export function ChatQuickReplies({ onSelect }: ChatQuickRepliesProps) {
  const t = useTranslations("aiChat");
  const items = [t("quickReplies.match"), t("quickReplies.highOdds"), t("quickReplies.trending")];

  return (
    <div className="flex shrink-0 gap-[10px] overflow-x-auto px-4 py-2 [&::-webkit-scrollbar]:hidden">
      {items.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => onSelect(text)}
          className="flex h-10 shrink-0 cursor-pointer items-center rounded-full border border-[#212124] bg-transparent px-3 text-[12px] leading-[18px] text-primary whitespace-nowrap transition hover:border-brand-default"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
