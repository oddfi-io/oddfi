"use client";

import { useEffect, useState } from "react";
import { ChatPanel } from "./tabs/ChatPanel";
import { PushPanel } from "./tabs/PushPanel";
import { AnalysisPanel } from "./tabs/AnalysisPanel";
import {
  MOCK_CHAT_MESSAGES,
  type ChatMessage,
  type DockPush,
} from "@/lib/agent/dockMockData";
import { chat, listPush } from "@/lib/agent/backend";
import { getAvatar } from "@/lib/agent/avatars";
import { useAgentProfile } from "@/lib/agent/profile";
import { useWatchlist, buildWatchMatcher } from "@/lib/agent/watchlist";

type DockTab = "chat" | "push" | "analysis";
type PushFilter = "watched" | "all";

const TAB_LABELS: Record<DockTab, string> = {
  chat: "对话",
  push: "推送",
  analysis: "分析",
};

function nowTimestamp(): string {
  const t = new Date();
  return `${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}`;
}

export function AgentDock() {
  const [profile] = useAgentProfile();
  const avatar = getAvatar(profile.avatarId);
  const [watchlist] = useWatchlist();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<DockTab>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT_MESSAGES);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [pushItems, setPushItems] = useState<DockPush[]>([]);
  const [pushFilter, setPushFilter] = useState<PushFilter>("watched");

  const isWatched = buildWatchMatcher(watchlist);
  const visiblePush =
    pushFilter === "all" ? pushItems : pushItems.filter(isWatched);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const items = await listPush(20);
        if (!cancelled) setPushItems(items);
      } catch (e) {
        console.warn("listPush failed:", e);
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    if (tab !== "chat") setTab("chat");

    const userMsg: ChatMessage = {
      from: "user",
      text: trimmed,
      timestamp: nowTimestamp(),
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setTyping(true);

    try {
      const history = nextMessages.map((m) => ({
        role: m.from === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      }));
      const reply = await chat(history);
      setMessages((prev) => [
        ...prev,
        { from: "agent", text: reply, timestamp: nowTimestamp() },
      ]);
    } catch (e) {
      console.error("chat error:", e);
      setMessages((prev) => [
        ...prev,
        {
          from: "agent",
          text: "（连不上后端，请确认 http://localhost:8080 已启动）",
          timestamp: nowTimestamp(),
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  const UNREAD_COUNT: Record<DockTab, number> = {
    chat: 0,
    push: visiblePush.length,
    analysis: 1,
  };
  const totalUnread = Object.values(UNREAD_COUNT).reduce((a, b) => a + b, 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed right-6 bottom-6 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-dock-2 border border-dock-edge text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:border-brand transition-all duration-200 ${
          open
            ? "opacity-0 scale-90 translate-y-2 pointer-events-none"
            : "opacity-100 scale-100 translate-y-0"
        }`}
        aria-label="打开 AI Agent 对话坞"
      >
        <span className="text-base leading-none">{avatar.emoji}</span>
        <span>{profile.nickname}</span>
        {totalUnread > 0 && (
          <span className="bg-brand text-black text-[11px] font-bold px-2 py-0.5 rounded-full">
            {totalUnread}
          </span>
        )}
      </button>

      <div
        className={`fixed right-6 bottom-6 z-50 w-[380px] h-[640px] max-h-[calc(100vh-48px)] bg-dock rounded-2xl border-4 border-dock-edge shadow-2xl flex flex-col transition-all duration-300 ${
          open
            ? "opacity-100 translate-x-0"
            : "opacity-0 translate-x-5 pointer-events-none"
        }`}
      >
        {/* Header 第一层：avatar + nickname + 设置 + 关闭 */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
          <button
            type="button"
            className="flex items-center gap-2.5 group cursor-pointer"
            aria-label="切换 AI Agent"
            onClick={() => alert("切换 AI Agent — 待实现")}
          >
            <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center text-lg shadow-sm">
              {avatar.emoji}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white font-bold text-base group-hover:text-brand transition-colors">
                {profile.nickname}
              </span>
              <span className="text-ink-3 text-xs">▾</span>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => alert("AI Agent 设置 — 待实现（已有设置页：滚动到上方查看）")}
              className="text-ink-2 hover:text-white text-base cursor-pointer transition-colors"
              aria-label="设置"
            >
              ⚙
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-ink-2 hover:text-white text-base cursor-pointer transition-colors"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Header 第二层：Tabs */}
        <div className="flex items-baseline gap-6 px-4 pb-3 flex-shrink-0">
          {(["chat", "push", "analysis"] as DockTab[]).map((t) => {
            const isActive = tab === t;
            const unread = UNREAD_COUNT[t];
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative text-[18px] leading-[26px] cursor-pointer transition-colors ${
                  isActive
                    ? "text-white font-bold"
                    : "text-ink-2 font-semibold hover:text-white"
                }`}
              >
                {TAB_LABELS[t]}
                {unread > 0 && (
                  <span className="absolute -top-1 -right-3 bg-brand text-black text-[10px] font-bold px-1.5 py-0 leading-tight rounded-full">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0">
          {tab === "chat" && (
            <ChatPanel
              messages={messages}
              typing={typing}
              onQuickQuestion={sendMessage}
            />
          )}
          {tab === "push" && (
            <PushPanel
              items={visiblePush}
              totalCount={pushItems.length}
              filterMode={pushFilter}
              onFilterChange={setPushFilter}
            />
          )}
          {tab === "analysis" && <AnalysisPanel />}
        </div>

        <div className="flex-shrink-0 px-4 pt-2 pb-3 border-t border-dock-edge bg-dock">
          <div className="flex items-center gap-2 bg-dock-2 border border-dock-edge rounded-2xl px-3 py-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder={
                tab === "chat"
                  ? "问我点什么..."
                  : "在这里发消息（自动切到对话）"
              }
              disabled={typing}
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-ink-3 disabled:opacity-50 text-white"
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || typing}
              className="text-brand font-semibold text-xs disabled:opacity-30 disabled:cursor-not-allowed"
            >
              发送
            </button>
          </div>
          <p className="text-[10px] text-ink-3 text-center mt-1.5">
            非投资建议 · 参考用途 · 用户自负盈亏
          </p>
        </div>
      </div>
    </>
  );
}
