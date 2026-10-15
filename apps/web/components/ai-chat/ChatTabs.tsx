"use client";

import type { ChatTab } from "@/stores/aiChatSessionStore";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ChatTabsProps {
  activeTab: ChatTab;
  onSelect: (tab: ChatTab) => void;
  /** DD-110 — 「新闻」未读计数；0 隐藏，> 99 显示 "99+"。 */
  unreadCount?: number;
}

/**
 * 浮窗 Tabs（DD-106 · Figma 6417:119068 · DD-110 接入 news tab）。
 *
 * 44px 高，3 等分；激活态：`bg-secondary` + 底部 2px mint border + text-brand-default。
 * 「新闻」badge 改为动态未读计数（DD-110 D7），首次激活 tab 清零。
 */
export function ChatTabs({ activeTab, onSelect, unreadCount = 0 }: ChatTabsProps) {
  const t = useTranslations("aiChat");
  const badge = unreadCount === 0 ? undefined : unreadCount > 99 ? "99+" : String(unreadCount);
  return (
    <div
      className="flex h-11 shrink-0 items-center border-b border-solid"
      // @figma-hardcoded: #1f2832 tabs-bottom-divider — pending design token
      style={{ borderBottomColor: "#1f2832" }}
    >
      <TabButton
        label={t("tabs.chat")}
        active={activeTab === "chat"}
        onClick={() => onSelect("chat")}
      />
      <TabButton
        label={t("tabs.news")}
        active={activeTab === "news"}
        badge={badge}
        onClick={() => onSelect("news")}
      />
    </div>
  );
}

function TabButton({
  label,
  active,
  disabled,
  badge,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      title={disabled ? "Coming soon" : undefined}
      className={cn(
        "relative flex h-[43.586px] flex-1 items-center justify-center gap-2 border-x-0 border-t-0 border-b-2 border-solid bg-transparent text-[12.5px] leading-[18.75px] transition",
        active
          ? // @figma-hardcoded: active tab bg-secondary + bottom mint border
            "cursor-pointer border-b-fn-brand bg-secondary font-semibold text-brand-default"
          : "border-b-transparent font-medium text-[#6b7785]",
        // @figma-hardcoded: #6b7785 inactive tab text — pending design token
        disabled ? "cursor-not-allowed" : !active && "cursor-pointer hover:text-primary"
      )}
    >
      {label}
      {badge && (
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-fn-yellow px-1 font-['JetBrains_Mono',monospace] text-[10px] font-bold leading-[15px] text-static-black">
          {badge}
        </span>
      )}
    </button>
  );
}
