"use client";

/**
 * AI 聊天左侧栏（DD-121 · Figma 6814:126173，200px）。
 *
 * 两个分组：
 *   - Feature：New Chat / Search / Basics / Behavior / Notification / Memory / Usage
 *     · New Chat → onNewChat（快照当前会话进 Recents + 重置）
 *     · Search → 占位无效果（用户明确）
 *     · 其余 5 项 → onOpenConfig(tab) 打开配置覆盖层并定位到对应 tab
 *   - Recents：标题右侧复用清理按钮（清空全部记录）；下方会话视觉列表（点击不恢复，仅展示）
 *
 * 所有 Feature 图标均为 Phosphor outlined（设计稿 icons-outlined-phosphoricons），16px。
 * i18n 文案在 Batch 5 接入；本 batch 先用英文字面量（设计稿即英文，PC-only）。
 */

import { useTranslations } from "next-intl";
import {
  BellIcon,
  BrainIcon,
  DatabaseIcon,
  HandTapIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  SlidersHorizontalIcon,
  type Icon,
} from "@phosphor-icons/react";

import { ChatClearIcon } from "@/components/icons/ChatClearIcon";
import { cn } from "@/lib/utils";

import type { ConfigTab } from "./AgentConfigTabs";

export interface RecentEntry {
  id: string;
  title: string;
  /** 相对时间展示文案（如 "5m"）。 */
  timeLabel: string;
}

interface AiChatSidebarProps {
  recents: RecentEntry[];
  onNewChat: () => void;
  onSearch?: () => void;
  onClearRecents: () => void;
  onOpenConfig: (tab: ConfigTab) => void;
  /** 当前激活的 config tab（用于二级导航高亮）。null 表示当前在聊天视图。 */
  activeConfigTab?: ConfigTab | null;
  /** 容器覆写（DD-135 H5 抽屉内复用：w-full + 去右分隔线，宽度随父容器）。 */
  className?: string;
}

type FeatureItem =
  | { id: "new-chat"; labelKey: string; icon: Icon }
  | { id: "search"; labelKey: string; icon: Icon }
  | { id: "config"; labelKey: string; icon: Icon; tab: ConfigTab };

const FEATURE_ITEMS: FeatureItem[] = [
  { id: "new-chat", labelKey: "newChat", icon: NotePencilIcon },
  { id: "search", labelKey: "search", icon: MagnifyingGlassIcon },
  { id: "config", labelKey: "basics", icon: SlidersHorizontalIcon, tab: "basics" },
  { id: "config", labelKey: "behavior", icon: HandTapIcon, tab: "behavior" },
  { id: "config", labelKey: "notification", icon: BellIcon, tab: "notify" },
  { id: "config", labelKey: "memory", icon: BrainIcon, tab: "memory" },
  { id: "config", labelKey: "usage", icon: DatabaseIcon, tab: "usage" },
];

const ROW_BASE =
  "flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[14px] leading-[20px] text-primary transition hover:bg-tertiary";

export function AiChatSidebar({
  recents,
  onNewChat,
  onSearch,
  onClearRecents,
  onOpenConfig,
  activeConfigTab = null,
  className,
}: AiChatSidebarProps) {
  const t = useTranslations("aiChat.sidebar");
  const handleFeature = (item: FeatureItem) => {
    if (item.id === "new-chat") return onNewChat();
    if (item.id === "search") return onSearch?.();
    return onOpenConfig(item.tab);
  };

  return (
    <aside
      // @figma-hardcoded: #212124 line/border-secondary — Figma 6814:126173 borderColor（右分隔线）
      className={cn(
        "flex w-[200px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-solid border-[#212124] bg-primary p-2",
        className
      )}
    >
      {/* Feature 分组 */}
      <div className="flex flex-col">
        <div className="flex h-6 items-center rounded px-2 py-1">
          <span className="text-[14px] leading-[20px] text-tertiary">{t("feature")}</span>
        </div>
        {FEATURE_ITEMS.map((item) => {
          const IconCmp = item.icon;
          const isActive = item.id === "config" && activeConfigTab === item.tab;
          // 选中态：Figma 7664:66832 — bg-tertiary 背景 + 白色文字/图标（无 mint accent）
          const cls = isActive ? `${ROW_BASE} bg-tertiary` : ROW_BASE;
          return (
            <button
              key={item.id === "config" ? item.tab : item.id}
              type="button"
              onClick={() => handleFeature(item)}
              className={cls}
              aria-current={isActive ? "page" : undefined}
            >
              <IconCmp size={16} weight="regular" className="shrink-0 text-primary" />
              <span className="truncate">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* Recents 分组 */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-6 items-center justify-between rounded px-2 py-1">
          <span className="text-[14px] leading-[20px] text-tertiary">{t("recents")}</span>
          {recents.length > 0 && (
            <button
              type="button"
              aria-label="Clear all chat history"
              onClick={onClearRecents}
              className="flex size-5 cursor-pointer items-center justify-center border-0 bg-transparent text-secondary transition hover:text-red"
            >
              <ChatClearIcon size={16} />
            </button>
          )}
        </div>
        <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {recents.map((r) => (
            <li
              key={r.id}
              className="flex h-9 items-center justify-between gap-2 rounded px-2"
              title={r.title}
            >
              <span className="truncate text-[14px] leading-[20px] text-primary">{r.title}</span>
              <span className="shrink-0 text-[14px] leading-[20px] text-tertiary">
                {r.timeLabel}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
