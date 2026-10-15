"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { usePathname } from "@/i18n/navigation";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import { useAiChat } from "@/hooks/useAiChat";
import { useNewsFeed } from "@/hooks/useNewsFeed";
import { useAiChatSessionStore } from "@/stores/aiChatSessionStore";
import { useAuthStore } from "@/stores/authStore";
import MobileBottomSheet from "@/components/ui/MobileBottomSheet";
import type { RecentEntry } from "@/components/ai-agent/AiChatSidebar";
import type { ConfigTab } from "@/components/ai-agent/AgentConfigTabs";
import {
  RECENTS_LIMIT,
  type RecentSnapshot,
  deriveSessionTitle,
  compactAge,
} from "@/components/ai-agent/recents";
import { preloadPetSprites } from "@/lib/codex-pets/registry";

import { MobileChatHeader } from "./MobileChatHeader";
import { MobileAgentDrawer } from "./MobileAgentDrawer";
import { MobileAgentSettings } from "./MobileAgentSettings";
import { ChatMessageList } from "../ChatMessageList";
import { ChatComposer } from "../ChatComposer";
import { ChatQuickReplies } from "../ChatQuickReplies";
import { NewsPanel } from "../news/NewsPanel";

/**
 * MobileAiChatSheet — H5（< lg）AI 聊天抽屉（DD-125）。
 *
 * PC 的 AiChatModal 用 dock / float（react-rnd 浮窗）呈现，移动端不适用；
 * 本组件复用同一套 body 子组件（ChatTabs / ChatMessageList / ChatComposer / ChatQuickReplies / NewsPanel）
 * 与同一会话状态（aiChatSessionStore），仅把呈现换成共享基建 `MobileBottomSheet`（高抽屉 + 内容自管滚动）。
 *
 * 互斥渲染：仅在 `responsive === "h5"` 挂载（由 LayoutShell 按断点 gate，PC 不挂载），
 * 因此 useAiChat / useNewsFeed 在 H5 只此一份实例，不与 AiChatModal 重复连接。
 *
 * 登录门控：入口（AIAgentFloatButton）已用 useChatOpener 拦截未登录；
 * 这里再用 isAuthenticated 兜底拒绝渲染（跨 tab 登出 / mode 残留等特殊路径）。
 */
export default function MobileAiChatSheet() {
  const responsive = useResponsiveMode();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const mode = useAiChatSessionStore((s) => s.mode);
  const close = useAiChatSessionStore((s) => s.close);
  const activeTab = useAiChatSessionStore((s) => s.activeTab);
  const setActiveTab = useAiChatSessionStore((s) => s.setActiveTab);
  const sessionHydrated = useAiChatSessionStore((s) => s.hydrated);
  const hydrateSession = useAiChatSessionStore((s) => s.hydrate);
  const clearMessages = useAiChatSessionStore((s) => s.clearMessages);
  const pendingAutoSend = useAiChatSessionStore((s) => s.pendingAutoSend);
  const consumePendingAutoSend = useAiChatSessionStore((s) => s.consumePendingAutoSend);

  useEffect(() => {
    if (!sessionHydrated) hydrateSession();
  }, [sessionHydrated, hydrateSession]);

  const { messages, isLoading, send, abort, retry } = useAiChat();

  const isOpen = mode !== "closed";
  // News 推送：mode !== "closed" 时启用（badge 后台累积，对齐 AiChatModal）
  const newsFeed = useNewsFeed(isOpen);

  // /ai-agent 全屏页由 AiAgentPageView 接管 → 抽屉不渲染、不消费 pendingAutoSend（避免双发）
  const isOnAgentPage = pathname === "/ai-agent" || pathname.startsWith("/ai-agent/");

  // DD-107 ENH-2：消费 pendingAutoSend → 真实触发 send（运行时文案强制英语）
  useEffect(() => {
    if (!pendingAutoSend || isOnAgentPage) return;
    const { intent, matchId, matchLabel } = pendingAutoSend;
    consumePendingAutoSend();
    void send(`Analyze ${matchLabel}`, { intent, matchId });
  }, [pendingAutoSend, isOnAgentPage, send, consumePendingAutoSend]);

  // DD-135：汉堡侧边栏（开关 + Recents 本地快照，与 PC AiChatMainView 同构）
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recents, setRecents] = useState<RecentSnapshot[]>([]);
  // DD-135：二级视图（chat | settings），与 PC 中央列切换同构；关闭设置 = 回到聊天
  const [view, setView] = useState<"chat" | "settings">("chat");
  const [settingsTab, setSettingsTab] = useState<ConfigTab>("basics");

  // sheet 关闭时收起抽屉 + 复位视图，避免下次打开残留
  useEffect(() => {
    if (mode === "closed") {
      setDrawerOpen(false);
      setView("chat");
    }
  }, [mode]);

  // DD-135 验收增强：聊天窗口打开即预热 pets spritesheet（CDN 9 张，幂等），
  // 用户进设置-基础页时八宫格/大头像直接命中缓存，不卡空白态
  useEffect(() => {
    if (isOpen) preloadPetSprites();
  }, [isOpen]);

  // New Chat：快照当前会话进 Recents（超上限淘汰）+ 清空消息 + 回聊天视图（对齐 PC 语义）
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
    setView("chat");
    setDrawerOpen(false);
  };

  // 清空 Recents（sonner 二次确认；运行时文案英语 — code-quality.md，与 PC 同文案）
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

  // 设置项点击：关抽屉 + 进入设置视图并定位对应 tab
  const handleOpenConfig = (tab: ConfigTab) => {
    setSettingsTab(tab);
    setView("settings");
    setDrawerOpen(false);
  };

  const recentEntries: RecentEntry[] = recents.map((r) => ({
    id: r.id,
    title: r.title,
    timeLabel: compactAge(r.ts),
  }));

  // DD-107 ENH：清空聊天记录（sonner 二次确认，防误点；运行时文案英语 — code-quality.md）
  const handleClear = () => {
    const count = messages.length;
    if (count === 0) return;
    toast.warning("Clear current session?", {
      description: `${count} ${count === 1 ? "message" : "messages"} will be removed`,
      action: {
        label: "Clear",
        onClick: () => {
          clearMessages();
          toast.success("Chat history cleared");
        },
      },
      duration: 5000,
    });
  };

  const open = responsive === "h5" && isOpen && isAuthenticated && !isOnAgentPage;

  return (
    <MobileBottomSheet
      open={open}
      onClose={close}
      flushContent
      heightClassName="h-[90vh]"
      zIndex={60}
    >
      <div
        role="dialog"
        aria-label="OddFi AI chat"
        className="relative flex min-h-0 flex-1 flex-col bg-primary"
      >
        {view === "settings" ? (
          /* DD-135：Agent 设置视图（自带标题行/chips/footer，替换聊天 chrome） */
          <MobileAgentSettings
            activeTab={settingsTab}
            onTabChange={setSettingsTab}
            onClose={() => setView("chat")}
          />
        ) : (
          <>
            {/* Header 行（Figma 7286:122760）：absolute 浮层悬在内容流上方，
                消息/新闻滚动时从玻璃按钮背后穿过（液态玻璃 · Figma 7973:127858）。
                内容区用 topInset 在滚动容器内部让位，保证初始内容不被遮挡。 */}
            <div className="absolute inset-x-0 top-0 z-20">
              <MobileChatHeader
                activeTab={activeTab}
                onSelect={setActiveTab}
                unreadCount={newsFeed.unreadCount}
                onClear={handleClear}
                onMenu={() => setDrawerOpen(true)}
              />
            </div>

            {/* Tab 内容：chat（消息 + 空态快捷问句 + 输入）/ news（推送列表） */}
            {activeTab === "news" ? (
              <NewsPanel feed={newsFeed} topInset />
            ) : (
              <>
                <ChatMessageList messages={messages} onRetry={retry} topInset />
                {messages.length === 0 && <ChatQuickReplies onSelect={(text) => void send(text)} />}
                <ChatComposer
                  onSend={send}
                  onAbort={abort}
                  isLoading={isLoading}
                  sendVariant="white"
                />
              </>
            )}
          </>
        )}
      </div>

      {/* DD-135：汉堡侧边栏（portal 到 body，z-70 盖过 sheet） */}
      <MobileAgentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        recents={recentEntries}
        onNewChat={handleNewChat}
        onClearRecents={handleClearRecents}
        onOpenConfig={handleOpenConfig}
        activeConfigTab={view === "settings" ? settingsTab : null}
      />
    </MobileBottomSheet>
  );
}
