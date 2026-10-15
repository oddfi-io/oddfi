"use client";

import { useEffect, useState } from "react";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import type { ChatMsg } from "@/stores/aiChatSessionStore";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ChatRecommendationCard } from "./ChatRecommendationCard";

/**
 * DD-107 v3 · pending 态文案池（B 方案）。
 * - thinking：默认推理 / 搜索完毕回到推理
 * - searching：xAI web_search_call.* 期间
 * 借鉴 Claude Code thinking animation（blog.alexbeals.com）：sparkle 字符切帧 + 词池轮播。
 */
const THINKING_LABELS = [
  "Thinking",
  "Pondering",
  "Reasoning",
  "Crunching odds",
  "Reading the board",
  "Connecting dots",
  "Sifting signals",
  "Weighing scenarios",
  "Lining things up",
  "Looking deeper",
] as const;

const SEARCHING_LABELS = [
  "Searching the web",
  "Reading sources",
  "Browsing references",
  "Cross-checking",
  "Sniffing the wire",
  "Pulling fresh data",
] as const;

const SPARKLE_GLYPHS = ["·", "✢", "✳", "✶", "✻", "✽"] as const;

function SparkleGlyph() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % SPARKLE_GLYPHS.length), 120);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      className="chat-sparkle inline-block w-[14px] text-center text-[14px] leading-none"
      aria-hidden="true"
    >
      {SPARKLE_GLYPHS[idx]}
    </span>
  );
}

function PendingLabel({ phase }: { phase: "thinking" | "searching" }) {
  const pool = phase === "searching" ? SEARCHING_LABELS : THINKING_LABELS;
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setIdx(0);
    setVisible(true);
    const id = setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIdx((i) => (i + 1) % pool.length);
        setVisible(true);
      }, 200);
    }, 2500);
    return () => clearInterval(id);
  }, [pool]);
  return (
    <span
      className="font-medium italic transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {pool[idx]}
    </span>
  );
}

interface ChatBubbleProps {
  message: ChatMsg;
  onRetry?: (id: string) => void;
}

/**
 * 单条聊天气泡（DD-122 v2 · Figma 7229:103387 AI / 7229:103388 User）。
 *
 * - AI 气泡（左）：bg `#212124`（fill/input2）+ tl 尖角（rounded-tr/bl/br 16）+ 白色 14px 文字
 *   外 padding：pl-16 / pr-72 / py-8（右侧大留白让气泡天然靠左，无需 max-w）
 * - 用户气泡（右）：同 bg `#212124` + 白色文字 + br 尖角（rotate-180 结构反推）
 *   外 padding：px-16 py-8 + items-end 右对齐
 * - pending / error 状态沿用 AI 气泡形态（bg 同上）
 * - 字号 14/20：人类 UX 升级（3d3fca08）保留，覆盖 Figma 原稿 12/18
 */
export function ChatBubble({ message, onRetry }: ChatBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-2">
        <div
          // Figma 7229:103388 经 rotate-180 等效：tl/tr/bl=16, br=0（tail 在右下）
          // 颜色用 bg-fill-input-modal (#212124) 与 AI 气泡一致；文字 text-primary 白色
          // 字号 14/20 保留人类 UX 升级（3d3fca08），覆盖 Figma 原稿 12/18
          className="max-w-[78%] rounded-[16px] rounded-br-none bg-fill-input-modal p-3 text-[14px] leading-[20px] text-primary"
        >
          {message.content}
        </div>
      </div>
    );
  }

  // AI 气泡通用 className：tl 尖角（tail 在左上）+ bg-fill-input-modal
  // 字号 14/20 保留人类 UX 升级（3d3fca08），覆盖 Figma 原稿 12/18
  const aiBubbleBase = "rounded-[16px] rounded-tl-none p-3 text-[14px] leading-[20px]";

  // AI 外 padding：右侧 72px 强制气泡靠左 + 留白（Figma pl-16 pr-72 py-8）
  const aiWrapBase = "flex flex-col items-start pl-4 pr-[72px] py-2";

  if (message.status === "pending") {
    return (
      <div className={aiWrapBase}>
        {/*
          打字态：sparkle 字符切帧 + 整体 opacity 呼吸，属"无状态生命周期"动画
          （animation.md 例外），inline keyframe 避免污染 tailwind.config。
        */}
        <style>{`
          @keyframes chatSparkleBreath {
            0%, 100% { opacity: 0.6; }
            50%      { opacity: 1; }
          }
          .chat-sparkle {
            animation: chatSparkleBreath 2s ease-in-out infinite;
          }
        `}</style>
        <div
          // min-w 兜住最长文案宽度，避免轮播切短词时气泡宽度抖动
          className={`${aiBubbleBase} flex min-w-[180px] items-center gap-2 bg-fill-input-modal text-brand-default`}
          aria-live="polite"
          aria-label="AI is thinking"
        >
          <SparkleGlyph />
          <PendingLabel phase={message.phase ?? "thinking"} />
        </div>
      </div>
    );
  }

  if (message.status === "error") {
    return (
      <div className={aiWrapBase}>
        <div
          className={`${aiBubbleBase} flex items-center gap-2 border border-dt-error bg-tag-red text-red`}
        >
          <span>{message.content || "AI service unavailable."}</span>
          {onRetry && (
            <button
              type="button"
              onClick={() => onRetry(message.id)}
              aria-label="Retry"
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-red transition hover:opacity-80"
            >
              <ArrowClockwiseIcon size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={aiWrapBase}>
      <div className={`${aiBubbleBase} bg-fill-input-modal text-primary`}>
        <MarkdownRenderer content={message.content} />
      </div>
      {/* DD-120：分析正文下方渲染推荐下注卡（matchId 客户端拉取，无 odds/派生失败则静默不渲染）。
          显式守 status==="ok"：当前 return 仅 ok 可达，防未来新增 status 分支误落到此处。 */}
      {message.recommendation && message.status === "ok" && (
        <div className="w-full">
          {/* DD-136：picks 存在 → 三玩法多卡（置信度排序）；缺失 → DD-120 单卡兜底 */}
          <ChatRecommendationCard
            matchId={message.recommendation.matchId}
            picks={message.recommendation.picks}
          />
        </div>
      )}
    </div>
  );
}
