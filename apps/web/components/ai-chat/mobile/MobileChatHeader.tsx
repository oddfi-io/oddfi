"use client";

import { ListIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import type { ChatTab } from "@/stores/aiChatSessionStore";
import { ChatClearIcon } from "@/components/icons/ChatClearIcon";
import { cn } from "@/lib/utils";

import { NewsSoundToggle } from "../NewsSoundToggle";

interface MobileChatHeaderProps {
  activeTab: ChatTab;
  onSelect: (tab: ChatTab) => void;
  /** 「新闻」未读计数；0 隐藏，> 99 显示 "99+"。 */
  unreadCount?: number;
  /** 清空当前对话（chat tab 下显示清理按钮）。 */
  onClear: () => void;
  /** 汉堡菜单（DD-125 暂为视觉占位，无行为）。 */
  onMenu?: () => void;
}

/**
 * MobileChatHeader — H5 AI 聊天抽屉顶部行（DD-125 · Figma 7286:122760 / 7286:122768）。
 *
 * 与 PC 的 ChatHeader + 全宽 ChatTabs 不同：H5 设计为「左侧 pill 分段控件 + 右侧图标组」。
 *   - 左：136×40 pill（对话 / 新闻 + 灰色未读计数），激活态填 bg-tertiary 胶囊
 *   - 右：随 tab 切换的动作键 + 汉堡菜单（右上角，icon primary）
 *       · chat tab → 清理按钮（镜像公共关闭规范：24px rounded-8 + 16px ClearIcon）
 *       · news tab → 音量开关（NewsSoundToggle，PC/H5 通用，Figma 7235:126604）
 *   - 关闭走 MobileBottomSheet 的下滑手势 / 点遮罩（不再单独放 X）
 *
 * 液态玻璃悬浮（Figma 7973:127858「滑动时液态玻璃效果」· 2026-06-06 验收增强）：
 * 本组件由 MobileAiChatSheet 以 absolute 浮层挂在消息流上方，消息滚动时从按钮背后穿过。
 *   - 根容器 pointer-events-none 放行空白区点击/滚动，仅 pill 与右侧按钮簇 pointer-events-auto
 *   - pill / 汉堡 / 清理按钮用「半透明深底 + backdrop-blur」呈现玻璃（设计稿为透明底 +
 *     Figma background blur，纯透明在 12px 文字上对比度不足，按项目玻璃参数适配，
 *     同 OddInfoCard 的 blur-12 量级）
 *
 * 40px 行高，对齐 Figma 节点尺寸（tab 32px 高，符合 mobile-h5.md「设计稿指定高度优先」例外）。
 */

/* @figma-hardcoded: rgba(4,6,12,0.55) glass-btn-bg（设计稿 7968:127534 为 rgba(0,0,0,0) + blur effect）— pending design token */
const GLASS_SURFACE = "bg-[rgba(4,6,12,0.55)] backdrop-blur-[12px]";
export function MobileChatHeader({
  activeTab,
  onSelect,
  unreadCount = 0,
  onClear,
  onMenu,
}: MobileChatHeaderProps) {
  const t = useTranslations("aiChat");
  const badge = unreadCount === 0 ? undefined : unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div className="pointer-events-none flex h-10 shrink-0 items-center justify-between px-4">
      {/* 左：pill 分段控件（Figma 7286:122768）— 玻璃浮层（7973:127858） */}
      <div
        className={`pointer-events-auto flex items-center rounded-full border border-secondary p-1 ${GLASS_SURFACE}`}
      >
        <PillTab
          label={t("tabs.chat")}
          active={activeTab === "chat"}
          onClick={() => onSelect("chat")}
        />
        <PillTab
          label={t("tabs.news")}
          active={activeTab === "news"}
          badge={badge}
          onClick={() => onSelect("news")}
        />
      </div>

      {/* 右：tab 相关动作键 + 汉堡（右上角，primary） */}
      <div className="pointer-events-auto flex items-center gap-2">
        {activeTab === "news" ? (
          <NewsSoundToggle />
        ) : (
          <button
            type="button"
            aria-label="Clear chat history"
            onClick={onClear}
            style={{ touchAction: "manipulation" }}
            className="flex size-8 shrink-0 items-center justify-center border-0 bg-transparent"
          >
            {/* 镜像 MobileBottomSheet 公共关闭规范：24px rounded-8 + 16px ClearIcon（底色玻璃化与 pill 一致） */}
            <span
              className={`flex size-6 items-center justify-center rounded-8 transition-colors hover:bg-fill-hover ${GLASS_SURFACE}`}
            >
              <ChatClearIcon size={16} className="text-primary" />
            </span>
          </button>
        )}
        <button
          type="button"
          aria-label="Menu"
          onClick={onMenu}
          style={{ touchAction: "manipulation" }}
          className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-primary transition hover:opacity-80 ${GLASS_SURFACE}`}
        >
          <ListIcon size={18} />
        </button>
      </div>
    </div>
  );
}

function PillTab({
  label,
  active,
  badge,
  onClick,
}: {
  label: string;
  active: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ touchAction: "manipulation" }}
      className={cn(
        "flex h-8 min-w-16 items-center justify-center gap-1 rounded-full px-3 text-[12px] font-medium leading-[18px] transition",
        active ? "bg-tertiary text-primary" : "cursor-pointer bg-transparent text-primary"
      )}
    >
      {label}
      {badge && <span className="font-normal text-secondary">{badge}</span>}
    </button>
  );
}
