/**
 * @vitest-environment jsdom
 *
 * DD-125 Batch 2 — MobileAiChatSheet gating 矩阵。
 * 重点：仅 h5 + open + 已登录 + 非 /ai-agent 才渲染抽屉；任一不满足返回空。
 * 子组件 / 重依赖 hook 全 mock，只验证本组件自有的渲染门控与 tab 分支。
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MobileAiChatSheet from "./MobileAiChatSheet";

// ── 可变 mock 状态 ──
let mockResponsive = "h5";
let mockAuthed = true;
let mockPathname = "/markets";
const sessionState = {
  mode: "float" as "float" | "closed",
  activeTab: "chat" as "chat" | "news",
  hydrated: true,
  pendingAutoSend: null,
  close: vi.fn(),
  setActiveTab: vi.fn(),
  hydrate: vi.fn(),
  clearMessages: vi.fn(),
  consumePendingAutoSend: vi.fn(),
};

vi.mock("@/hooks/useResponsiveMode", () => ({
  useResponsiveMode: () => mockResponsive,
}));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => mockPathname,
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) =>
    sel({ isAuthenticated: mockAuthed }),
}));
vi.mock("@/stores/aiChatSessionStore", () => ({
  useAiChatSessionStore: (sel: (s: typeof sessionState) => unknown) => sel(sessionState),
}));
vi.mock("@/hooks/useAiChat", () => ({
  useAiChat: () => ({
    messages: [],
    isLoading: false,
    send: vi.fn(),
    abort: vi.fn(),
    retry: vi.fn(),
  }),
}));
vi.mock("@/hooks/useNewsFeed", () => ({
  useNewsFeed: () => ({ unreadCount: 0 }),
}));
// 子组件降级为可识别桩，避开 next-intl / SSE
vi.mock("./MobileChatHeader", () => ({
  MobileChatHeader: () => <div data-testid="chat-header" />,
}));
vi.mock("../ChatMessageList", () => ({
  ChatMessageList: () => <div data-testid="msg-list" />,
}));
vi.mock("../ChatComposer", () => ({
  ChatComposer: () => <div data-testid="composer" />,
}));
vi.mock("../ChatQuickReplies", () => ({
  ChatQuickReplies: () => <div data-testid="quick-replies" />,
}));
vi.mock("../news/NewsPanel", () => ({
  NewsPanel: () => <div data-testid="news-panel" />,
}));

beforeEach(() => {
  mockResponsive = "h5";
  mockAuthed = true;
  mockPathname = "/markets";
  sessionState.mode = "float";
  sessionState.activeTab = "chat";
});

afterEach(() => {
  document.body.style.overflow = "";
});

describe("MobileAiChatSheet gating", () => {
  it("h5 + open + 已登录 → 渲染抽屉（chat tab：消息区 + 输入框）", () => {
    render(<MobileAiChatSheet />);
    expect(screen.getByTestId("chat-header")).toBeTruthy();
    expect(screen.getByTestId("msg-list")).toBeTruthy();
    expect(screen.getByTestId("composer")).toBeTruthy();
  });

  it("非 h5（PC 断点）→ 不渲染（交给 AiChatModal）", () => {
    mockResponsive = "standard";
    render(<MobileAiChatSheet />);
    expect(screen.queryByTestId("chat-header")).toBeNull();
  });

  it("mode=closed → 不渲染", () => {
    sessionState.mode = "closed";
    render(<MobileAiChatSheet />);
    expect(screen.queryByTestId("chat-header")).toBeNull();
  });

  it("未登录 → 不渲染（兜底拒绝）", () => {
    mockAuthed = false;
    render(<MobileAiChatSheet />);
    expect(screen.queryByTestId("chat-header")).toBeNull();
  });

  it("/ai-agent 全屏页 → 不渲染（避免与全屏页双入口）", () => {
    mockPathname = "/ai-agent";
    render(<MobileAiChatSheet />);
    expect(screen.queryByTestId("chat-header")).toBeNull();
  });

  it("news tab → 渲染 NewsPanel，不渲染聊天输入区", () => {
    sessionState.activeTab = "news";
    render(<MobileAiChatSheet />);
    expect(screen.getByTestId("news-panel")).toBeTruthy();
    expect(screen.queryByTestId("composer")).toBeNull();
  });
});
