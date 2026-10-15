"use client";

/**
 * AI 聊天主界面编排（DD-121）。
 *
 * 4 列 grid 布局（PC-only，H5 已被 page.tsx 拦截到 ComingSoon）：
 *   `LeagueSidebar(50/200) | AiChatSidebar(200) | 中央(1fr) | BetSlip(440·条件)`
 *   - LeagueSidebar：复用 markets 全局栏 + marketsLayoutStore 折叠状态（与 markets 页表现一致）
 *   - AiChatSidebar：Feature + Recents（DD-121 新建）
 *   - 中央：AiAgentPageView（吉祥物/输入框/消息流）
 *   - 右栏：BetSlipPanel — 点击聊天推荐卡 onBet 后 betSlipStore 有选择即出现；同时承载 chat dock slot
 *
 * 配置覆盖层：点左侧栏 5 个 config tab（或中央右上齿轮）→ 全屏覆盖 AgentConfigTabs。
 * 会话模型（DD-121 决策）：单会话生效，Recents 仅前端视觉，New Chat 快照（超 20 淘汰）。
 * Codex pet sprite 预加载：进 /ai-agent 时预热 9 张 spritesheet，避免进 Basics tab 后等加载。
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";

import LeagueSidebar from "@/components/game-markets/LeagueSidebar";
import BetSlipPanel from "@/app/[locale]/markets/BetSlipPanel";
import { useAiChatSessionStore } from "@/stores/aiChatSessionStore";
import {
  useMarketsLayoutStore,
  useLayoutState,
  selectSidebarCollapsed,
} from "@/stores/marketsLayoutStore";
import { buildSpriteUrl, CODEX_PETS } from "@/lib/codex-pets/registry";
import { AiAgentPageView } from "./AiAgentPageView";
import { AgentConfigTabs, type ConfigTab } from "./AgentConfigTabs";
import { AiChatSidebar, type RecentEntry } from "./AiChatSidebar";
import { RECENTS_LIMIT, type RecentSnapshot, deriveSessionTitle, compactAge } from "./recents";

type ViewMode = "chat" | ConfigTab;

export function AiChatMainView() {
  const messages = useAiChatSessionStore((s) => s.messages);
  const clearMessages = useAiChatSessionStore((s) => s.clearMessages);

  // LeagueSidebar 折叠态（与 markets 页共享 marketsLayoutStore）
  const sidebarCollapsed = useMarketsLayoutStore(selectSidebarCollapsed);
  const toggleSidebar = useMarketsLayoutStore((s) => s.toggleSidebar);

  // 右栏（Betslip + chat dock slot）— 与 MarketsPageClient 同源判定
  const layoutState = useLayoutState();
  const hasBetslip = layoutState === "betslip" || layoutState === "betslip-only";
  const isChatDocked = useAiChatSessionStore((s) => s.mode === "dock");
  const hasRightColumn = hasBetslip || isChatDocked;

  // DD-121 优化：viewMode = 'chat' 渲染聊天主视图；其余 5 值渲染对应 config tab（内联，非覆盖层）。
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  // 点击 sidebar config tab：若已激活同一 tab 则返回聊天视图（toggle），否则切到该 tab。
  // 这是唯一在不清空消息的前提下从 config 返回聊天的路径。
  const handleOpenConfig = (tab: ConfigTab) => {
    setViewMode((prev) => (prev === tab ? "chat" : tab));
  };
  // Recents 视觉列表（非持久化 · 单会话约束下仅展示）
  const [recents, setRecents] = useState<RecentSnapshot[]>([]);

  // 预热 9 张 codex pet spritesheet（验收 #5：避免进 Basics 后等加载出骨架）
  useEffect(() => {
    if (typeof window === "undefined") return;
    for (const pet of CODEX_PETS) {
      const img = new window.Image();
      img.src = buildSpriteUrl(pet);
    }
  }, []);

  const handleNewChat = () => {
    if (messages.length > 0) {
      const firstUser = messages.find((m) => m.role === "user")?.content;
      const entry: RecentSnapshot = {
        id: `recent-${Date.now()}`,
        title: deriveSessionTitle(firstUser),
        ts: Date.now(),
      };
      setRecents((prev) => [entry, ...prev].slice(0, RECENTS_LIMIT));
    }
    clearMessages();
    setViewMode("chat");
  };

  // 复用清空交互（sonner 二次确认，防误点）；运行时输出英语（code-quality.md）
  const handleClearRecents = () => {
    const count = recents.length;
    toast.warning("Clear all chat history?", {
      description: `${count} ${count === 1 ? "record" : "records"} will be removed`,
      action: {
        label: "Clear",
        onClick: () => {
          setRecents([]);
          clearMessages();
          toast.success("Chat history cleared");
        },
      },
      duration: 5000,
    });
  };

  const recentEntries: RecentEntry[] = recents.map((r) => ({
    id: r.id,
    title: r.title,
    timeLabel: compactAge(r.ts),
  }));

  const leagueColWidth = sidebarCollapsed ? "50px" : "200px";
  const gridCols = hasRightColumn
    ? `${leagueColWidth} 200px minmax(0,1fr) 440px`
    : `${leagueColWidth} 200px minmax(0,1fr)`;

  return (
    <>
      <div
        className="grid h-[calc(100vh-64px)] w-full overflow-clip bg-primary transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ gridTemplateColumns: gridCols }}
      >
        {/* Column 1: 全局 LeagueSidebar — 与 markets 页共享折叠态 */}
        <div className="overflow-hidden">
          <LeagueSidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        </div>

        {/* Column 2: AI 聊天侧栏（兼二级导航：5 config tab 高亮当前视图） */}
        <AiChatSidebar
          recents={recentEntries}
          onNewChat={handleNewChat}
          onClearRecents={handleClearRecents}
          onOpenConfig={handleOpenConfig}
          activeConfigTab={viewMode === "chat" ? null : viewMode}
        />

        {/* Column 3: 中央内容区（聊天 or 配置 tab 内联切换） */}
        <div className="min-w-0 overflow-y-auto">
          {viewMode === "chat" ? <AiAgentPageView /> : <AgentConfigTabs activeTab={viewMode} />}
        </div>

        {/* Column 4: 右栏 Betslip + chat dock slot（条件渲染） */}
        {hasRightColumn && (
          <div
            id="ai-chat-dock-column"
            className="flex h-full min-h-0 min-w-0 flex-col gap-6 overflow-hidden py-6 pr-6"
          >
            <BetSlipPanel />
          </div>
        )}
      </div>
    </>
  );
}
