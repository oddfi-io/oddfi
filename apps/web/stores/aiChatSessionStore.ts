/**
 * AI Chat 会话状态（DD-106 §3.3 + DD-107 §3.4.2 + DD-108 §3.1）。
 *
 * 持久化策略：
 *   - mode / isOpen / activeTab / pendingMatchId：**不**持久化（刷新后回到默认 closed）
 *   - lastMode：localStorage 持久化（用户偏好，决定 closed → open 时恢复成 dock 还是 float）
 *   - messages：localStorage `oddfi_ai_chat_session_v1`，仅最近 50 条
 *
 * DD-108 状态机：
 *   - mode 为唯一权威，isOpen 仅作为 `mode !== "closed"` 的派生镜像（兼容旧调用方）
 *   - setMode(next) 自动维护 lastMode（next ≠ "closed" 时同步），并把 isOpen 镜像写回
 *   - open() / close() 是 setMode 的语义糖；open() 恢复 lastMode（默认 dock）
 *
 * DD-107 v2 关键扩展：
 *   - `isPlaceholder` 字段：标记前端显示用但**不发给 LLM** 的消息（如 AI Badge 触发的"请分析 X vs Y"占位）
 *   - hydrate 时过滤 isPlaceholder（避免重启后误发给 LLM）
 *   - `pendingMatchId`：并发竞态保护（同 matchId 已有 in-flight → button disable）
 *   - `openWithIntent`：AI Badge 一键唤起入口
 */
import { create } from "zustand";
import { toast } from "sonner";

import type { AnalysisPick } from "@/lib/betting/recommend-selection";

const STORAGE_KEY = "oddfi_ai_chat_session_v1";
const MESSAGES_LIMIT = 50;

/** DD-108：Chat 形态。dock=与 betslip 同列竖排；float=自由浮窗；closed=隐藏。 */
export type ChatMode = "dock" | "float" | "closed";
/** DD-108：closed 之外的最近形态，用于 closed → open 时的恢复。 */
export type LastChatMode = "dock" | "float";

export type ChatTab = "chat" | "news" | "analysis";

export type ChatMessageStatus = "pending" | "ok" | "error";

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  status?: ChatMessageStatus;
  /** 错误码（status=error 时填） */
  errorCode?: string;
  /**
   * DD-107 §3.4.2：标记为 placeholder（仅前端显示，不发给 LLM）。
   * - AI Badge 自动触发的"请分析 X vs Y" → isPlaceholder=true
   * - 刷新页面 hydration 时自动清理（防止 localStorage 残留污染下次会话）
   * - send() 在拼 history 时 filter(m => !m.isPlaceholder)
   */
  isPlaceholder?: boolean;
  /**
   * DD-107 v3 · pending 状态下的 AI 阶段（驱动多文案轮播 ChatBubble）。
   * 由 SSE event=phase 推送，缺省按 "thinking" 处理。done/ok 后字段保留以便回放。
   */
  phase?: "thinking" | "searching";
  /**
   * DD-120：AI Badge match-analysis 触发的消息携带，标记其下方渲染「推荐下注卡片」。
   * 在 send() 创建 pending assistant message 时即盖（retry 复用同对象 → 卡不丢）；
   * 仅 status==="ok" 才渲染卡。卡内 fixture/odds 由 matchId 客户端拉取，不入持久化。
   * 后端版可加宽为 `{ matchId; selection?: BackendPick }`，旧数据无此字段向后兼容。
   *
   * DD-136 W3：`picks` 为流结束后从 oddfi-picks 协议块解析出的三玩法结构化推荐
   * （useAiChat 回填）；缺失 / 解析失败 → 渲染层走纯赔率派生单卡兜底。
   */
  recommendation?: { matchId: string; picks?: AnalysisPick[] };
}

interface PersistedSession {
  messages: ChatMsg[];
  /** DD-108：用户偏好的 closed 之外的最近形态，缺省 'dock'（首次访问 / 老数据兼容）。 */
  lastMode?: LastChatMode;
}

interface LoadedSession {
  messages: ChatMsg[];
  lastMode: LastChatMode;
}

function loadFromStorage(): LoadedSession {
  if (typeof window === "undefined") return { messages: [], lastMode: "dock" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [], lastMode: "dock" };
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    // DD-107 §3.4.2：hydration 清理 placeholder（不持久化到下次 session）
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter((m) => !m.isPlaceholder).slice(-MESSAGES_LIMIT)
      : [];
    // DD-108 migration：旧 storage 无 lastMode 字段 → 默认 dock
    const lastMode: LastChatMode = parsed.lastMode === "float" ? "float" : "dock";
    return { messages, lastMode };
  } catch {
    return { messages: [], lastMode: "dock" };
  }
}

function saveToStorage(messages: ChatMsg[], lastMode: LastChatMode) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ messages: messages.slice(-MESSAGES_LIMIT), lastMode })
    );
  } catch {
    /* quota exceeded — non-critical */
  }
}

interface SessionState {
  /** DD-108：当前形态。closed/dock/float 三态，唯一权威。 */
  mode: ChatMode;
  /** DD-108：closed 之外的最近形态，open() 时恢复用。持久化到 localStorage。 */
  lastMode: LastChatMode;
  /**
   * @deprecated DD-108：保留为 `mode !== "closed"` 的派生镜像，兼容老调用方
   * （AIAgentFloatButton / AiChatModal / ChatHeader / MatchCard / AiAgentPageView / useAiChat 等）。
   * 新代码请读 `mode` / 写 `setMode`、`open`、`close`。
   */
  isOpen: boolean;
  activeTab: ChatTab;
  messages: ChatMsg[];
  hydrated: boolean;
  /** DD-107 §3.4.2：当前 in-flight match-analysis 的 matchId（用于 button disabled） */
  pendingMatchId: string | null;
  /**
   * DD-107 ENH-2 · fire-and-forget 自动触发槽位。
   * openWithIntent 设置 → 挂载中的 AiChatModal / AiAgentPageView useEffect 消费 → 调 useAiChat.send → consume 清空。
   * Store 不能直接调 hook，所以借这个字段做 store→component 单向触发。
   */
  pendingAutoSend: AutoSendPayload | null;
  /**
   * dock 模式下 BetSlipPanel 渲染的 `#ai-chat-dock-slot` DOM 节点引用。
   *
   * 由 BetSlipPanel 通过 ref callback 注册/清理，AiChatModal 订阅此字段决定 portal target。
   * 替换原 `useEffect + rAF + [mode, pathname]` 探测方案——后者无法感知
   * `MarketsPageClient`（dynamic ssr:false）异步挂载、或 React 18 Suspense
   * commit 时序导致 slot 比 effect 晚一帧出现的场景。
   *
   * 非持久化：仅运行时 DOM 引用，刷新后由 BetSlipPanel 重新注册。
   */
  dockSlotEl: HTMLElement | null;
}

export interface AutoSendPayload {
  intent: "match-analysis";
  matchId: string;
  matchLabel: string;
}

export interface OpenWithIntentPayload {
  intent: "match-analysis";
  matchId: string;
  matchLabel: string;
}

interface SessionActions {
  /** DD-108：状态机唯一写入入口。next ≠ "closed" 时同步更新 lastMode（并持久化）。 */
  setMode: (next: ChatMode) => void;
  /** DD-108：恢复到 lastMode（首次访问 / 老数据默认 dock）。 */
  open: () => void;
  /** DD-108：等价 setMode("closed")，不改 lastMode。 */
  close: () => void;
  /** @deprecated DD-108：true → open() / false → close()，仅兼容旧调用方。 */
  setOpen: (open: boolean) => void;
  /** @deprecated DD-108：closed ↔ lastMode 切换，仅兼容旧调用方。 */
  toggle: () => void;
  setActiveTab: (tab: ChatTab) => void;
  appendMessage: (msg: ChatMsg) => void;
  updateMessage: (id: string, patch: Partial<Omit<ChatMsg, "id">>) => void;
  /**
   * DD-107 Step 2 fix · 流式增量更新（**不**写 localStorage）。
   *
   * 为什么需要：流式 SSE 每个 token delta 都调 updateMessage 会触发同步
   * `JSON.stringify(messages) + localStorage.setItem` —— 在 token 流速 ≥ 5/s 时
   * 主线程被 IO 阻塞，浏览器无法 paint，视觉上像"一股脑全到"。
   *
   * 调用约定：rAF 节流的中间态用 streamPatchMessage；流完成（done）后再用
   * updateMessage 写最终内容（含 status:"ok"），保证持久化只发生一次。
   */
  streamPatchMessage: (id: string, content: string) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  hydrate: () => void;
  setPendingMatchId: (matchId: string | null) => void;
  /** DD-107 §3.4.2：AI Badge 一键唤起。实际 send 由 hook 接管（完成后 setPendingMatchId(null)）。 */
  openWithIntent: (payload: OpenWithIntentPayload) => void;
  /** DD-107 ENH-2：component 调 send 之后清空 pendingAutoSend 防重复触发。 */
  consumePendingAutoSend: () => void;
  /** BetSlipPanel 的 dock slot ref callback：mount→注册节点，unmount→传 null 清理。 */
  setDockSlotEl: (el: HTMLElement | null) => void;
}

export type AiChatSessionStore = SessionState & SessionActions;

export const useAiChatSessionStore = create<AiChatSessionStore>((set, get) => ({
  mode: "closed",
  lastMode: "dock",
  isOpen: false,
  activeTab: "chat",
  messages: [],
  hydrated: false,
  pendingMatchId: null,
  pendingAutoSend: null,
  dockSlotEl: null,

  setMode: (next) => {
    if (next === "closed") {
      // 关闭不动 lastMode（保留用户偏好），仅同步 isOpen 镜像
      set({ mode: "closed", isOpen: false });
      return;
    }
    // dock / float 视为最近形态，需要持久化偏好
    const nextLast: LastChatMode = next;
    set({ mode: next, lastMode: nextLast, isOpen: true });
    saveToStorage(get().messages, nextLast);
  },

  open: () => get().setMode(get().lastMode),
  close: () => get().setMode("closed"),

  setOpen: (open) => (open ? get().open() : get().close()),
  toggle: () => (get().mode === "closed" ? get().open() : get().close()),

  setActiveTab: (tab) => set({ activeTab: tab }),

  appendMessage: (msg) => {
    const next = [...get().messages, msg].slice(-MESSAGES_LIMIT);
    saveToStorage(next, get().lastMode);
    set({ messages: next });
  },

  updateMessage: (id, patch) => {
    const next = get().messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
    saveToStorage(next, get().lastMode);
    set({ messages: next });
  },

  streamPatchMessage: (id, content) => {
    // 故意省略 saveToStorage —— 流式中间态不持久化（done 时由 updateMessage 一次性写盘）
    const next = get().messages.map((m) => (m.id === id ? { ...m, content } : m));
    set({ messages: next });
  },

  removeMessage: (id) => {
    const next = get().messages.filter((m) => m.id !== id);
    saveToStorage(next, get().lastMode);
    set({ messages: next });
  },

  clearMessages: () => {
    saveToStorage([], get().lastMode);
    set({ messages: [] });
  },

  hydrate: () => {
    const { messages, lastMode } = loadFromStorage();
    set({
      messages,
      lastMode,
      // mode / isOpen 不持久化（刷新后回到 closed）
      mode: "closed",
      isOpen: false,
      hydrated: true,
      pendingMatchId: null,
      pendingAutoSend: null,
      dockSlotEl: null,
    });
  },

  setPendingMatchId: (matchId) => set({ pendingMatchId: matchId }),

  consumePendingAutoSend: () => set({ pendingAutoSend: null }),

  setDockSlotEl: (el) => {
    // 相等短路：同一节点重复 ref callback 不应触发订阅者重渲染
    if (get().dockSlotEl === el) return;
    set({ dockSlotEl: el });
  },

  openWithIntent: ({ intent, matchId, matchLabel }) => {
    const { messages, lastMode } = get();
    if (messages.length > 0) {
      toast.info(`New analysis session started for ${matchLabel}`);
      saveToStorage([], lastMode);
      set({ messages: [] });
    }
    // DD-108 / REV-DD108-v1 C-1：走 setMode 保证 lastMode 持久化副作用（不再绕过 set({mode}))
    get().setMode(lastMode);
    set({
      activeTab: "chat",
      pendingMatchId: matchId,
      // fire-and-forget：component 内 useEffect 检测此字段后调 useAiChat.send 真实触发
      pendingAutoSend: { intent, matchId, matchLabel },
    });
  },
}));
