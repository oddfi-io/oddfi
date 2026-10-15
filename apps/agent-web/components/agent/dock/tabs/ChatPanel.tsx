"use client";

import { useEffect, useRef, useState } from "react";
import { type ChatMessage } from "@/lib/agent/dockMockData";

const QUICK_QUESTIONS = [
  "热门推荐",
  "今天有什么比赛？",
  "今天高赔率比赛有哪些？",
  "这场比赛你怎么看？",
];

interface ChatPanelProps {
  messages: ChatMessage[];
  typing: boolean;
  onQuickQuestion: (q: string) => void;
}

export function ChatPanel({ messages, typing, onQuickQuestion }: ChatPanelProps) {
  const [scope, setScope] = useState<"today" | "all">("today");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  return (
    <div className="h-full flex flex-col px-4 pb-2">
      <div className="inline-flex self-start border border-[#212124] p-1 rounded-full mb-3 flex-shrink-0 mt-1">
        <button
          onClick={() => setScope("today")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
            scope === "today"
              ? "bg-brand-fade text-brand"
              : "text-ink-2 hover:text-white"
          }`}
        >
          今日
        </button>
        <button
          onClick={() => setScope("all")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
            scope === "all"
              ? "bg-brand-fade text-brand"
              : "text-ink-2 hover:text-white"
          }`}
        >
          全部
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 min-h-0 -mx-1 px-1"
      >
        {messages.map((m, i) => {
          const isUser = m.from === "user";
          return (
            <div key={i} className={`flex gap-2 ${isUser ? "justify-end" : ""}`}>
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-dock-2 border border-dock-edge flex items-center justify-center text-sm flex-shrink-0">
                  🌿
                </div>
              )}
              <div
                className={`rounded-2xl px-3 py-2 text-sm max-w-[260px] leading-relaxed ${
                  isUser ? "bg-info text-white" : "bg-dock-2 text-white"
                }`}
              >
                <div>{m.text}</div>
                <div
                  className={`text-[10px] mt-1 ${
                    isUser ? "text-white/60" : "text-ink-3"
                  }`}
                >
                  {m.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-dock-2 border border-dock-edge flex items-center justify-center text-sm flex-shrink-0">
              🌿
            </div>
            <div className="rounded-2xl px-3 py-2 bg-dock-2">
              <span className="inline-flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 pt-3">
        <div className="text-[10px] text-ink-3 mb-1.5 tracking-wider">
          快速提问
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onQuickQuestion(q)}
              disabled={typing}
              className="text-[11px] text-ink-2 bg-dock-2 border border-dock-edge rounded-full px-2.5 py-1 hover:border-brand hover:text-brand transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
