/**
 * @vitest-environment jsdom
 *
 * DD-121 Batch 5 — AiChatMainView 编排逻辑测试。
 * 覆盖：配置覆盖层 open/close + 定位 tab；New Chat 快照进 Recents + 重置会话；清理 Recents。
 * 子组件全部替身，隔离 useAiChat/SSE 与 next-intl 依赖。
 */
import { render, screen, fireEvent, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAiChatSessionStore, type ChatMsg } from "@/stores/aiChatSessionStore";

// sonner：clear 的二次确认直接执行 action.onClick（模拟用户点"Clear"）
vi.mock("sonner", () => ({
  toast: {
    warning: (_msg: string, opts: { action: { onClick: () => void } }) => opts.action.onClick(),
    success: vi.fn(),
  },
}));

// LeagueSidebar 替身（避免拉 next-intl useLocale + markets/betSlip 全套 store）
vi.mock("@/components/game-markets/LeagueSidebar", () => ({
  default: () => <div data-testid="league-sidebar" />,
}));

// BetSlipPanel 替身（避免拉 betSlipStore 真实依赖；右栏可见性由 useLayoutState mock 控制）
vi.mock("@/app/[locale]/markets/BetSlipPanel", () => ({
  default: () => <div data-testid="betslip-panel" />,
}));

// marketsLayoutStore 替身：默认 LeagueSidebar 展开、布局无右栏（隔离 betSlip 真实状态）
vi.mock("@/stores/marketsLayoutStore", () => ({
  selectSidebarCollapsed: (s: { sidebarCollapsed: boolean }) => s.sidebarCollapsed,
  useMarketsLayoutStore: <T,>(
    sel: (s: { sidebarCollapsed: boolean; toggleSidebar: () => void }) => T
  ) => sel({ sidebarCollapsed: false, toggleSidebar: () => {} }),
  useLayoutState: () => "default",
}));

// 中央聊天区替身（避免 useAiChat 网络依赖）
vi.mock("./AiAgentPageView", () => ({
  AiAgentPageView: () => <div data-testid="page-view" />,
}));

// 配置内容区替身：暴露 activeTab（DD-121 优化：内联切换，无覆盖层 / 无 onClose）
vi.mock("./AgentConfigTabs", () => ({
  AgentConfigTabs: ({ activeTab }: { activeTab: string }) => (
    <div data-testid="config-view">
      <span data-testid="config-tab">{activeTab}</span>
    </div>
  ),
}));

// 侧栏替身：暴露回调按钮 + 渲染 recents + 透传 activeConfigTab
vi.mock("./AiChatSidebar", () => ({
  AiChatSidebar: ({
    recents,
    onNewChat,
    onClearRecents,
    onOpenConfig,
    activeConfigTab,
  }: {
    recents: { id: string; title: string; timeLabel: string }[];
    onNewChat: () => void;
    onClearRecents: () => void;
    onOpenConfig: (tab: string) => void;
    activeConfigTab: string | null;
  }) => (
    <div>
      <div data-testid="recents-count">{recents.length}</div>
      <div data-testid="active-config-tab">{activeConfigTab ?? "none"}</div>
      {recents.map((r) => (
        <div key={r.id} data-testid="recent-item">
          {r.title}
        </div>
      ))}
      <button onClick={onNewChat}>new-chat</button>
      <button onClick={onClearRecents}>clear-recents</button>
      <button onClick={() => onOpenConfig("behavior")}>open-behavior</button>
      <button onClick={() => onOpenConfig("memory")}>open-memory</button>
    </div>
  ),
}));

import { AiChatMainView } from "./AiChatMainView";

function seedMessages(messages: ChatMsg[]) {
  act(() => {
    useAiChatSessionStore.setState({ messages });
  });
}

beforeEach(() => {
  act(() => {
    useAiChatSessionStore.setState({ messages: [] });
  });
});

describe("AiChatMainView", () => {
  it("默认渲染聊天主视图，config 视图不出现", () => {
    render(<AiChatMainView />);
    expect(screen.queryByTestId("config-view")).toBeNull();
    expect(screen.getByTestId("page-view")).toBeTruthy();
    expect(screen.getByTestId("active-config-tab").textContent).toBe("none");
  });

  it("点击 config tab 内联切换内容区（替换聊天主视图），sidebar 同步高亮", () => {
    render(<AiChatMainView />);
    fireEvent.click(screen.getByText("open-behavior"));
    expect(screen.queryByTestId("page-view")).toBeNull();
    expect(screen.getByTestId("config-view")).toBeTruthy();
    expect(screen.getByTestId("config-tab").textContent).toBe("behavior");
    expect(screen.getByTestId("active-config-tab").textContent).toBe("behavior");
  });

  it("config tab 之间切换：直接替换内容，不经过聊天视图", () => {
    render(<AiChatMainView />);
    fireEvent.click(screen.getByText("open-behavior"));
    fireEvent.click(screen.getByText("open-memory"));
    expect(screen.getByTestId("config-tab").textContent).toBe("memory");
    expect(screen.queryByTestId("page-view")).toBeNull();
  });

  it("再次点击当前激活的 config tab → toggle 回聊天视图（保留消息）", () => {
    seedMessages([{ id: "m1", role: "user", content: "keep me", createdAt: Date.now() }]);
    render(<AiChatMainView />);
    fireEvent.click(screen.getByText("open-behavior"));
    expect(screen.getByTestId("config-view")).toBeTruthy();
    fireEvent.click(screen.getByText("open-behavior"));
    expect(screen.queryByTestId("config-view")).toBeNull();
    expect(screen.getByTestId("page-view")).toBeTruthy();
    expect(useAiChatSessionStore.getState().messages).toHaveLength(1);
  });

  it("config 视图中点击 New Chat → 回到聊天视图并执行常规清理", () => {
    seedMessages([
      { id: "m1", role: "user", content: "Argentina vs Spain", createdAt: Date.now() },
    ]);
    render(<AiChatMainView />);
    fireEvent.click(screen.getByText("open-behavior"));
    expect(screen.queryByTestId("page-view")).toBeNull();
    fireEvent.click(screen.getByText("new-chat"));
    expect(screen.getByTestId("page-view")).toBeTruthy();
    expect(screen.queryByTestId("config-view")).toBeNull();
    expect(screen.getByTestId("recents-count").textContent).toBe("1");
  });

  it("New Chat：有消息时快照进 Recents 并清空当前会话", () => {
    seedMessages([
      { id: "m1", role: "user", content: "Argentina vs Spain odds?", createdAt: Date.now() },
      { id: "m2", role: "assistant", content: "...", createdAt: Date.now() },
    ]);
    render(<AiChatMainView />);
    expect(screen.getByTestId("recents-count").textContent).toBe("0");

    fireEvent.click(screen.getByText("new-chat"));
    expect(screen.getByTestId("recents-count").textContent).toBe("1");
    expect(screen.getByTestId("recent-item").textContent).toBe("Argentina vs Spain odds?");
    expect(useAiChatSessionStore.getState().messages).toHaveLength(0);
  });

  it("New Chat：无消息时不新增 Recents", () => {
    render(<AiChatMainView />);
    fireEvent.click(screen.getByText("new-chat"));
    expect(screen.getByTestId("recents-count").textContent).toBe("0");
  });

  it("清理 Recents：清空列表 + 清空会话", () => {
    seedMessages([{ id: "m1", role: "user", content: "hi", createdAt: Date.now() }]);
    render(<AiChatMainView />);
    fireEvent.click(screen.getByText("new-chat")); // 先攒一条 recent
    expect(screen.getByTestId("recents-count").textContent).toBe("1");

    fireEvent.click(screen.getByText("clear-recents"));
    expect(screen.getByTestId("recents-count").textContent).toBe("0");
    expect(useAiChatSessionStore.getState().messages).toHaveLength(0);
  });
});
