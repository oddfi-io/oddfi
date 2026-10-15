"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Rnd } from "react-rnd";
import { DotsSixIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { usePathname, useRouter } from "@/i18n/navigation";

import { useResizableModal, DRAG_HANDLE_CLASSNAME } from "@/hooks/useResizableModal";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import { useAiChat } from "@/hooks/useAiChat";
import { useAiChatSessionStore } from "@/stores/aiChatSessionStore";
import { useAiChatLayoutStore } from "@/stores/aiChatLayoutStore";
import { useAuthStore } from "@/stores/authStore";
import type { Rect } from "@/lib/geometry";

import { ChatHeader } from "./ChatHeader";
import { ChatTabs } from "./ChatTabs";
import { ChatMessageList } from "./ChatMessageList";
import { ChatComposer } from "./ChatComposer";
import { ChatQuickReplies } from "./ChatQuickReplies";
import { NewsPanel } from "./news/NewsPanel";
import { useNewsFeed } from "@/hooks/useNewsFeed";

/** DD-108 §3.4：dock 6-dot 拖出阈值（pointer 位移 ≥ 8px 切 float） */
const DOCK_DETACH_THRESHOLD_PX = 8;
/**
 * DD-108 §3.5：float 拖回 right rail 归位阈值 — 浮窗与 column 的水平重叠占浮窗宽的比例。
 * 60% 让"拖到右边缘"基本必中（不要求垂直重叠，避免浮窗在 viewport 下半段误判）。
 */
const FLOAT_REDOCK_HORIZONTAL_RATIO = 0.6;
/**
 * 浮窗右边距 viewport 右缘 ≤ 阈值 → 触发"侧边栏吸附"，松手切 dock。
 * 与 column 重叠归位 OR 关系：边缘吸附条件更宽松，让"贴右边"成为更直觉的侧边栏触发路径。
 * 24px 比默认 inset (32) 略小，用户主动把浮窗推过默认 inset 才触发，避免初始位置就误吸附。
 */
const FLOAT_EDGE_SNAP_THRESHOLD_PX = 24;

/**
 * 浮窗右边缘是否进入 viewport 右缘吸附区。
 * 纯函数，导出供单测使用。`viewportWidth <= 0` 异常态判定不命中。
 */
export function isEdgeSnap(
  rndRight: number,
  viewportWidth: number,
  threshold = FLOAT_EDGE_SNAP_THRESHOLD_PX
): boolean {
  return viewportWidth > 0 && rndRight >= viewportWidth - threshold;
}

export interface DockIntent {
  /** 浮窗右边缘吸附区命中（不依赖 column 是否存在）*/
  edgeSnap: boolean;
  /** 浮窗与 column 水平重叠 ≥ 60% + 垂直有重叠（column 不存在时恒 false）*/
  columnHit: boolean;
  /** 综合判定 = edgeSnap || columnHit，松手时据此 setMode('dock') */
  shouldDock: boolean;
}

/**
 * 计算浮窗 → dock 触发意图（纯函数，TDD 核心）。
 *
 * 关键设计：edgeSnap 与 column 是否存在解耦——
 *   - column 在用户首次拖右边时不一定存在（hasRightColumn = hasBetslip || isChatDocked，
 *     全 false 时不渲染）→ 老 `if (!target) return` 直接跳过 edge snap，导致触发失败。
 *   - 现版本：edgeSnap 仅看 rndRect.right vs viewport.width。命中后 setMode('dock')
 *     会让 isChatDocked=true → MarketsPageClient 重渲 → column 出现 → BetSlipPanel mount
 *     → slot 注册 → AI 自动 portal 进 dock。
 *
 * columnHit 仍然要求 column 存在（无 column 无从计算 overlap）。
 */
export function computeDockIntent(
  rndRect: Rect,
  viewportWidth: number,
  column: Rect | null,
  floatWidth: number
): DockIntent {
  const edgeSnap = isEdgeSnap(rndRect.right, viewportWidth);
  let columnHit = false;
  if (column && floatWidth > 0) {
    const horizontalOverlap = Math.max(
      0,
      Math.min(rndRect.right, column.right) - Math.max(rndRect.left, column.left)
    );
    const verticalOverlap = Math.max(
      0,
      Math.min(rndRect.bottom, column.bottom) - Math.max(rndRect.top, column.top)
    );
    columnHit =
      horizontalOverlap / floatWidth >= FLOAT_REDOCK_HORIZONTAL_RATIO && verticalOverlap > 0;
  }
  return { edgeSnap, columnHit, shouldDock: edgeSnap || columnHit };
}

// Rect / rectOverlapArea / rectArea 已抽到 lib/geometry.ts（REV-DD108-v1 C-2）

/**
 * 拿浮窗归位的"目标矩形" = MarketsPageClient 右栏整个 column。
 *
 * **为什么不用 slot rect**：
 *   - dock 时 slot 是 dock 卡位置（合理但区域小，用户得垂直对齐才能命中）
 *   - float 时 slot 是 `hidden`（display:none），rect 全 0 → 归位失效（v1 bug）
 *   - 即便 slot h-0，rect.top 落在 BetSlipPanel 底部，virtual rect 向下扩展会出 viewport
 *
 * 用整个 column 当 target：用户从浮窗拖到右边缘任意垂直位置 → overlap > 50% column 面积 → 触发归位。
 * column 在 mode!=='dock' 时仍 visible（容纳 BetSlip），rect 总是有效。
 * column 不存在（非 markets 路由 / hasBetslip=false）→ null 跳过归位。
 */
function getDockTargetRect(): Rect | null {
  const column = document.getElementById("ai-chat-dock-column");
  if (!column) return null;
  const r = column.getBoundingClientRect();
  // column 在 display:none 父容器中 / 实际未渲染 → rect 全 0 跳过
  if (r.width <= 0 || r.height <= 0) return null;
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

/**
 * AI Chat 浮窗（DD-106 Batch 5 · DD-108 三态机）。
 *
 * 三形态（mode 状态机）：
 *   - closed：完全不渲染
 *   - dock：createPortal 挂到 BetSlipPanel 内 `#ai-chat-dock-slot`，与 betslip 同列竖排
 *   - float：保留原 react-rnd 全局浮窗
 *
 * 切形态时本组件不重 mount，useAiChat hook 实例与 SSE in-flight 流不丢；
 * 通过 createPortal 把 body 投放到不同 host 节点，达到 dock ↔ float 平滑切换。
 *
 * Dock → Float（§3.4）：ChatHeader 6-dot pointerdown → 阈值 8px → setMode('float') + 浮窗初始位置=释放点
 * Float → Dock（§3.5）：onDragStop 检测浮窗矩形 vs slot 目标矩形重叠 > 50% → setMode('dock')
 */
export default function AiChatModal() {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated: layoutHydrated, rndProps } = useResizableModal();

  const responsive = useResponsiveMode();
  // 未登录直接拒绝渲染（兜底所有特殊路径：登出后 mode 残留 / AI Badge openWithIntent 越权 / 跨 tab 登出）
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // DD-108 §3.9：H5（< lg）无 right rail，dock slot 不存在，强制 float（fallback 不写 store，保留桌面偏好）
  const storeMode = useAiChatSessionStore((s) => s.mode);
  const mode = responsive === "h5" && storeMode === "dock" ? ("float" as const) : storeMode;
  const setMode = useAiChatSessionStore((s) => s.setMode);
  const activeTab = useAiChatSessionStore((s) => s.activeTab);
  const setActiveTab = useAiChatSessionStore((s) => s.setActiveTab);
  const close = useAiChatSessionStore((s) => s.close);
  const sessionHydrated = useAiChatSessionStore((s) => s.hydrated);
  const hydrateSession = useAiChatSessionStore((s) => s.hydrate);
  const clearMessages = useAiChatSessionStore((s) => s.clearMessages);
  const pendingAutoSend = useAiChatSessionStore((s) => s.pendingAutoSend);
  const consumePendingAutoSend = useAiChatSessionStore((s) => s.consumePendingAutoSend);

  useEffect(() => {
    if (!sessionHydrated) hydrateSession();
  }, [sessionHydrated, hydrateSession]);

  // Escape 关闭（a11y）— 仅在屏上时绑定
  useEffect(() => {
    if (mode === "closed") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, close]);

  const { messages, isLoading, send, abort, retry } = useAiChat();

  // DD-110 §3.3 — News 推送 hook 顶层单实例。enabled = mode !== "closed"（让 badge 后台累积）。
  const newsFeed = useNewsFeed(mode !== "closed");

  const isOnAgentPage = pathname === "/ai-agent" || pathname.startsWith("/ai-agent/");

  // DD-107 ENH-2：消费 pendingAutoSend → 真实触发 send。全屏页由 AiAgentPageView 消费，避免双发。
  useEffect(() => {
    if (!pendingAutoSend || isOnAgentPage) return;
    const { intent, matchId, matchLabel } = pendingAutoSend;
    consumePendingAutoSend();
    // REV-DD108-v1 C-1：运行时 send 内容强制英语（code-quality.md）
    void send(`Analyze ${matchLabel}`, { intent, matchId });
  }, [pendingAutoSend, isOnAgentPage, send, consumePendingAutoSend]);

  // dock slot DOM 节点订阅：由 BetSlipPanel 通过 ref callback 注册到 aiChatSessionStore。
  //
  // 替代上一版 `[mode, pathname]` + rAF 查询的方案——后者在以下场景失活：
  // MarketsPageClient 是 `dynamic({ ssr: false })` 异步加载，从其他路由切回 /markets 时
  // rAF 在 chunk 加载完成前就执行，getElementById 拿到 null → setDockSlot(null) →
  // 之后 slot 异步挂载，但 [mode, pathname] 没再变 → effect 不重跑 → 永久卡 null。
  //
  // ref callback 直接由 React commit 阶段触发，与 slot DOM 出现/消失同步，
  // 无 rAF 时序赌博、无 [mode, pathname] 依赖追踪。
  const dockSlot = useAiChatSessionStore((s) => s.dockSlotEl);

  // float 模式下拖拽期间的状态：
  //   - isDragging：浮窗自身加 opacity-60 视觉提示"正在拖拽"
  //   - willRedock：右栏 column 加 mint outline 视觉预知"松手会归位"
  const [isDragging, setIsDragging] = useState(false);
  const [willRedock, setWillRedock] = useState(false);
  // 边缘吸附独立标记：用于 viewport 右缘 mint 竖条预览（与 column outline 区分指示器）
  const [edgeSnapping, setEdgeSnapping] = useState(false);
  useEffect(() => {
    const column = document.getElementById("ai-chat-dock-column");
    if (!column) return;
    if (willRedock && mode === "float") {
      // @figma-hardcoded: #28F4D2 fn-brand outline — 拖拽视觉预知"松手会归位"
      column.style.outline = "2px dashed #28F4D2";
      column.style.outlineOffset = "-2px";
    } else {
      column.style.outline = "";
      column.style.outlineOffset = "";
    }
    return () => {
      column.style.outline = "";
      column.style.outlineOffset = "";
    };
  }, [willRedock, mode]);

  // dock → float 拖出：保存 pointer 起始位置 + 阈值检测后 setMode('float')，浮窗初始位置 = 释放点
  const detachStateRef = useRef<{ startX: number; startY: number } | null>(null);
  const handleDockDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (mode !== "dock") return;
    detachStateRef.current = { startX: e.clientX, startY: e.clientY };

    const onMove = (ev: PointerEvent) => {
      const start = detachStateRef.current;
      if (!start) return;
      const dx = ev.clientX - start.startX;
      const dy = ev.clientY - start.startY;
      if (Math.hypot(dx, dy) < DOCK_DETACH_THRESHOLD_PX) return;

      // 阈值达成 → 切 float，浮窗初始位置以释放点为锚（让用户拖拽手感连续）
      const { size } = useAiChatLayoutStore.getState();
      const position = {
        x: Math.max(8, ev.clientX - size.width / 2),
        y: Math.max(8, ev.clientY - 24),
      };
      useAiChatLayoutStore.getState().setLayout({ position, size });
      setMode("float");
      cleanup();
    };

    const cleanup = () => {
      detachStateRef.current = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", cleanup);
      document.removeEventListener("pointercancel", cleanup);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", cleanup);
    document.addEventListener("pointercancel", cleanup);
  };

  // float onDragStart：进入拖拽态 → 浮窗半透明
  const handleFloatDragStart = () => {
    setIsDragging(true);
  };

  // float onDrag：实时算命中 → 控 column outline / 右缘 mint bar 高亮预知
  // 关键：edge snap 不依赖 column 存在（dock 触发后 column 会自动出现）
  const handleFloatDrag = (_e: unknown, data: { x: number; y: number }) => {
    // H5 无 dock 形态可达，跳过所有吸附（沿用顶部 mode 强制 float 的语义）
    if (responsive === "h5") {
      if (willRedock) setWillRedock(false);
      if (edgeSnapping) setEdgeSnapping(false);
      return;
    }
    const { size } = useAiChatLayoutStore.getState();
    const rndRect: Rect = {
      left: data.x,
      top: data.y,
      right: data.x + size.width,
      bottom: data.y + size.height,
    };
    const intent = computeDockIntent(rndRect, window.innerWidth, getDockTargetRect(), size.width);
    if (intent.shouldDock !== willRedock) setWillRedock(intent.shouldDock);
    if (intent.edgeSnap !== edgeSnapping) setEdgeSnapping(intent.edgeSnap);
  };

  // float onDragStop：原 useResizableModal 持久化 + DD-108 hit 检测归位（含右缘吸附）
  const handleFloatDragStop = (e: unknown, data: { x: number; y: number }) => {
    rndProps.onDragStop?.(e, data);
    setIsDragging(false);
    setWillRedock(false);
    setEdgeSnapping(false);

    if (responsive === "h5") return;
    const { size } = useAiChatLayoutStore.getState();
    const rndRect: Rect = {
      left: data.x,
      top: data.y,
      right: data.x + size.width,
      bottom: data.y + size.height,
    };
    const intent = computeDockIntent(rndRect, window.innerWidth, getDockTargetRect(), size.width);
    if (intent.shouldDock) setMode("dock");
  };

  if (mode === "closed" || !isAuthenticated || !layoutHydrated || isOnAgentPage) return null;

  // DD-107 ENH：清空聊天记录（带 sonner 二次确认 action，防误点）
  // REV-DD108-v1 C-3：toast 运行时输出强制英语（code-quality.md）
  const handleClear = () => {
    const count = messages.length;
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

  // DD-122：最大化 — 同 tab 跳 /ai-agent 全屏页。
  // 不主动 close()：pathname 切到 /ai-agent 后顶部 isOnAgentPage 守卫会自动让浮窗返回 null，
  // 避免"先空白再跳转"的 HMR 闪烁；且 mode 保持 float/dock，用户返回其他页时浮窗自动恢复。
  const handleMaximize = () => {
    router.push("/ai-agent");
  };

  // DD-122：新窗口打开 — 浮窗保留 + 新 tab 打开
  const handleOpenNewWindow = () => {
    window.open("/ai-agent", "_blank", "noopener,noreferrer");
  };

  // DD-110 §3.3 — body 内 tab 内容拆 switch；chat 切走时 ChatMessageList 卸载（滚动位置丢，V2 处理）
  const tabContent =
    activeTab === "news" ? (
      <NewsPanel feed={newsFeed} />
    ) : (
      <>
        <ChatMessageList messages={messages} onRetry={retry} />
        {messages.length === 0 && <ChatQuickReplies onSelect={(text) => void send(text)} />}
        <ChatComposer onSend={send} onAbort={abort} isLoading={isLoading} />
      </>
    );

  // DD-122：顶部居中 6-dot 拖拽锚点，dock + float 都渲染在同一位置（视觉与交互统一）。
  //   - dock 模式：onPointerDown 接 handleDockDragStart（阈值 8px → setMode('float')）
  //   - float 模式：挂 DRAG_HANDLE_CLASSNAME 让 Rnd 识别为 drag handle
  // 同一 DOM 节点切模式时仅 props 切换，无 mount/unmount。
  const isDock = mode === "dock";
  const grip = (
    <div
      role="button"
      tabIndex={0}
      aria-label={isDock ? "Drag chat out of dock" : "Drag chat window"}
      title={isDock ? "Drag to detach" : "Drag"}
      onPointerDown={isDock ? handleDockDragStart : undefined}
      onKeyDown={
        isDock
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setMode("float");
              }
            }
          : undefined
      }
      className={`${isDock ? "" : DRAG_HANDLE_CLASSNAME} absolute left-1/2 top-1 z-10 flex h-4 w-8 -translate-x-1/2 ${isDock ? "cursor-grab active:cursor-grabbing" : "cursor-move"} touch-none items-center justify-center text-tertiary transition hover:text-secondary`}
    >
      <DotsSixIcon size={16} weight="bold" />
    </div>
  );

  // 共享 body：dock / float 形态切换时不重 mount,保 SSE in-flight 流连续
  const body = (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="OddFi AI chat"
      // @figma-hardcoded: #212124 line/border-secondary — Figma 6417:119057 borderColor
      className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border-2 border-[#212124] bg-primary"
    >
      {grip}
      <ChatHeader
        onClose={close}
        onClear={handleClear}
        hasMessages={messages.length > 0}
        onMaximize={handleMaximize}
        onOpenNewWindow={handleOpenNewWindow}
      />
      <ChatTabs activeTab={activeTab} onSelect={setActiveTab} unreadCount={newsFeed.unreadCount} />
      {tabContent}
    </div>
  );

  if (mode === "dock") {
    // 非 markets 路由 / 路由切换中 slot 不存在 → dock 形态本帧不可见
    if (!dockSlot) return null;
    return createPortal(
      // 高度约束由父 slot 控制（BetSlipPanel.slotClassName 三态切换）。
      <div className="h-full w-full">{body}</div>,
      dockSlot
    );
  }

  // mode === "float" — 包装 rndProps 注入 onDragStart/onDrag/onDragStop（保留原持久化逻辑）
  return (
    <>
      {/* viewport 右缘吸附指示器：edgeSnap 命中时显示 mint 竖条 + 内辉光，暗示"松手贴右边变侧边栏" */}
      {edgeSnapping && (
        <div
          aria-hidden
          className="pointer-events-none fixed bottom-0 right-0 top-16 z-40 w-1.5"
          // @figma-hardcoded: #28F4D2 fn-brand — 边缘吸附预知指示（无 token，纯交互态视觉反馈）
          style={{
            background: "linear-gradient(90deg, rgba(40,244,210,0) 0%, #28F4D2 100%)",
            boxShadow: "-6px 0 18px rgba(40,244,210,0.55)",
          }}
        />
      )}
      <Rnd
        {...rndProps}
        onDragStart={handleFloatDragStart}
        onDrag={handleFloatDrag}
        onDragStop={handleFloatDragStop}
        className="fixed z-50"
        style={{ display: "flex" }}
      >
        {/* 拖拽中浮窗半透明（opacity 0.6）— 纯 CSS transition，属 animation.md 例外（非生命周期动画） */}
        <div
          className={`relative h-full w-full transition-opacity duration-150 ${isDragging ? "opacity-60" : "opacity-100"}`}
        >
          {body}
        </div>
      </Rnd>
    </>
  );
}
