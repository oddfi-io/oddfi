// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render } from "@testing-library/react";

import { useAiChatSessionStore } from "@/stores/aiChatSessionStore";
import { useAuthStore } from "@/stores/authStore";

// Mock 重型依赖：测试目标只是 auth 守卫，不需要真实拖拽 / SSE / portal 行为
// 捕获 onDragStop/onDrag 让集成测试能模拟"拖到右边缘"
interface RndCallbacks {
  onDragStop?: (e: unknown, data: { x: number; y: number }) => void;
  onDrag?: (e: unknown, data: { x: number; y: number }) => void;
}
const rndCaptured: RndCallbacks = {};
vi.mock("react-rnd", () => ({
  Rnd: ({
    children,
    onDragStop,
    onDrag,
  }: {
    children: React.ReactNode;
    onDragStop?: RndCallbacks["onDragStop"];
    onDrag?: RndCallbacks["onDrag"];
  }) => {
    rndCaptured.onDragStop = onDragStop;
    rndCaptured.onDrag = onDrag;
    return <div data-testid="rnd-stub">{children}</div>;
  },
}));

vi.mock("sonner", () => ({ toast: { warning: vi.fn(), success: vi.fn() } }));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/markets",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

// ChatHeader / ChatTabs 等子组件用 next-intl 的 useTranslations，测试环境无 provider
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/useResizableModal", () => ({
  DRAG_HANDLE_CLASSNAME: "drag-handle",
  useResizableModal: () => ({
    hydrated: true,
    rndProps: { size: { width: 360, height: 540 }, position: { x: 0, y: 0 } },
  }),
}));

vi.mock("@/hooks/useResponsiveMode", () => ({ useResponsiveMode: () => "pc" }));

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
  useNewsFeed: () => ({ items: [], unreadCount: 0, hasMore: false, loadMore: vi.fn() }),
}));

import AiChatModal, { isEdgeSnap, computeDockIntent } from "./AiChatModal";
import type { Rect } from "@/lib/geometry";

describe("AiChatModal · auth 守卫（DD-108 + 未登录禁止显示）", () => {
  beforeEach(() => {
    // 重置两个 store 到登出 + closed 默认态
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
    useAiChatSessionStore.setState({ mode: "closed", isOpen: false });
  });

  it("未登录 + mode=closed → 不渲染（默认路径）", () => {
    const { container } = render(<AiChatModal />);
    expect(container.firstChild).toBeNull();
  });

  it("未登录 + mode=dock → 仍不渲染（兜底登出后残留状态）", () => {
    useAiChatSessionStore.setState({ mode: "dock", isOpen: true });
    const { container } = render(<AiChatModal />);
    expect(container.firstChild).toBeNull();
    // Rnd / dock portal 都不应出现
    expect(container.querySelector('[data-testid="rnd-stub"]')).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("未登录 + mode=float → 仍不渲染（兜底 openWithIntent 越权）", () => {
    useAiChatSessionStore.setState({ mode: "float", isOpen: true });
    const { container } = render(<AiChatModal />);
    expect(container.firstChild).toBeNull();
  });

  it("已登录 + mode=float → 正常渲染浮窗", () => {
    useAuthStore.setState({ isAuthenticated: true });
    useAiChatSessionStore.setState({ mode: "float", isOpen: true });
    const { container } = render(<AiChatModal />);
    // mode=float 走 Rnd 路径
    expect(container.querySelector('[data-testid="rnd-stub"]')).not.toBeNull();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });
});

describe("AiChatModal · dock slot 订阅（回归：导航回 /markets 后 dock 不显示）", () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true });
    useAiChatSessionStore.setState({
      mode: "dock",
      isOpen: true,
      dockSlotEl: null,
    });
  });

  it("mode=dock + dockSlotEl=null → 不渲染（slot 还没挂载）", () => {
    const { container } = render(<AiChatModal />);
    // dock 路径但 slot 未注册 → 早返 null
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("mode=dock + dockSlotEl 后注册 → portal 渲染到该节点（回归核心）", () => {
    const { rerender } = render(<AiChatModal />);
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    // 模拟 BetSlipPanel 异步挂载后通过 ref callback 注册 slot 节点。
    // 旧实现下：AiChatModal 的 `useEffect([mode, pathname])` 不会重跑，dockSlot 永久 null。
    // 新实现下：直接订阅 store.dockSlotEl，set 后立即重渲染。
    const slot = document.createElement("div");
    slot.id = "ai-chat-dock-slot";
    document.body.appendChild(slot);
    act(() => {
      useAiChatSessionStore.getState().setDockSlotEl(slot);
    });

    rerender(<AiChatModal />);

    // portal 的 body 在 slot 节点内
    const dialog = slot.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    document.body.removeChild(slot);
  });

  it("dockSlotEl 清空 → portal 跟随移除（不残留旧引用）", () => {
    const slot = document.createElement("div");
    slot.id = "ai-chat-dock-slot";
    document.body.appendChild(slot);
    useAiChatSessionStore.setState({ dockSlotEl: slot });

    const { rerender } = render(<AiChatModal />);
    expect(slot.querySelector('[role="dialog"]')).not.toBeNull();

    // BetSlipPanel 卸载 → ref callback(null) → store 清零
    act(() => {
      useAiChatSessionStore.getState().setDockSlotEl(null);
    });
    rerender(<AiChatModal />);
    expect(slot.querySelector('[role="dialog"]')).toBeNull();

    document.body.removeChild(slot);
  });
});

describe("AiChatModal · isEdgeSnap 右缘吸附判定", () => {
  it("浮窗右边距 viewport 右缘 ≤ 24px → 命中", () => {
    expect(isEdgeSnap(1900, 1920)).toBe(true); // 距 20px
    expect(isEdgeSnap(1896, 1920)).toBe(true); // 距 24px 边界
  });

  it("浮窗右边距 viewport 右缘 > 24px → 未命中", () => {
    expect(isEdgeSnap(1895, 1920)).toBe(false); // 距 25px
    expect(isEdgeSnap(1000, 1920)).toBe(false);
  });

  it("浮窗右边超出 viewport 右缘 → 命中（用户强力推到边外）", () => {
    expect(isEdgeSnap(1950, 1920)).toBe(true);
  });

  it("自定义阈值优先于默认 24px", () => {
    expect(isEdgeSnap(1895, 1920, 50)).toBe(true); // 距 25px ≤ 50 → 命中
    expect(isEdgeSnap(1870, 1920, 50)).toBe(true); // 距 50px = 阈值边界 → 命中
    expect(isEdgeSnap(1869, 1920, 50)).toBe(false); // 距 51px > 50 → 未命中
  });

  it("viewport.width ≤ 0（异常）→ 不命中", () => {
    expect(isEdgeSnap(100, 0)).toBe(false);
    expect(isEdgeSnap(100, -10)).toBe(false);
  });
});

describe("AiChatModal · computeDockIntent (float → dock 触发判定)", () => {
  const VIEWPORT_W = 1920;

  it("浮窗在 viewport 中央 + column 存在但不重叠 → 全不触发", () => {
    const rnd: Rect = { left: 700, top: 200, right: 1100, bottom: 740 };
    const column: Rect = { left: 1500, top: 100, right: 1880, bottom: 900 };
    expect(computeDockIntent(rnd, VIEWPORT_W, column, 400)).toEqual({
      edgeSnap: false,
      columnHit: false,
      shouldDock: false,
    });
  });

  it("浮窗右边距 viewport 右缘 ≤ 24px + 无 column → edgeSnap 触发 dock (用户首次拖右边场景)", () => {
    const rnd: Rect = { left: 1500, top: 100, right: 1900, bottom: 640 };
    expect(computeDockIntent(rnd, VIEWPORT_W, null, 400)).toEqual({
      edgeSnap: true,
      columnHit: false,
      shouldDock: true,
    });
  });

  it("浮窗右边贴 viewport 右缘 + column 也存在 → edgeSnap 优先", () => {
    const rnd: Rect = { left: 1500, top: 100, right: 1900, bottom: 640 };
    const column: Rect = { left: 1500, top: 100, right: 1880, bottom: 900 };
    expect(computeDockIntent(rnd, VIEWPORT_W, column, 400)).toEqual({
      edgeSnap: true,
      columnHit: true,
      shouldDock: true,
    });
  });

  it("浮窗水平重叠 column ≥ 60% width 且垂直有重叠 → columnHit 触发 dock", () => {
    // 浮窗 400 宽，column right=1880 → 浮窗 [1500,1900] 与 column [1500,1880] 重叠 380px > 0.6*400=240px
    // 但 right=1900 距 viewport.width=1920 = 20px ≤ 24px，会触发 edgeSnap 也 true。改用更窄场景：
    const rnd: Rect = { left: 1450, top: 200, right: 1850, bottom: 740 };
    const column: Rect = { left: 1500, top: 100, right: 1880, bottom: 900 };
    // edgeSnap: rnd.right=1850, viewport-24=1896 → 1850 < 1896 → false
    // columnHit horizontal overlap: min(1850,1880)-max(1450,1500)=1850-1500=350px → 350/400=0.875 ≥ 0.6 ✓
    // vertical overlap: min(740,900)-max(200,100)=740-200=540 > 0 ✓
    expect(computeDockIntent(rnd, VIEWPORT_W, column, 400)).toEqual({
      edgeSnap: false,
      columnHit: true,
      shouldDock: true,
    });
  });

  it("浮窗在 viewport 上半、column 在下半（垂直不重叠）+ 不贴右缘 → 不触发", () => {
    const rnd: Rect = { left: 1500, top: 0, right: 1860, bottom: 100 };
    const column: Rect = { left: 1500, top: 600, right: 1880, bottom: 900 };
    expect(computeDockIntent(rnd, VIEWPORT_W, column, 360)).toEqual({
      edgeSnap: false,
      columnHit: false,
      shouldDock: false,
    });
  });

  it("浮窗在 viewport 上半、column 在下半（垂直不重叠）+ 贴右缘 → edgeSnap 仍触发", () => {
    const rnd: Rect = { left: 1540, top: 0, right: 1900, bottom: 100 };
    const column: Rect = { left: 1500, top: 600, right: 1880, bottom: 900 };
    // 这正是新 edge snap 的核心价值：column 在下半，传统 overlap 判定漏掉，edge snap 接住
    expect(computeDockIntent(rnd, VIEWPORT_W, column, 360)).toEqual({
      edgeSnap: true,
      columnHit: false,
      shouldDock: true,
    });
  });
});

// 集成测试：验证 react-rnd onDragStop 回调正确触发 setMode('dock')
// 关键：column 不存在时（用户首次 float 拖右边场景）依然能切 dock
describe("AiChatModal · float→dock 集成接线（onDragStop → computeDockIntent → setMode）", () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true });
    useAiChatSessionStore.setState({
      mode: "float",
      isOpen: true,
      lastMode: "float",
      dockSlotEl: null,
    });
    // 清除前一个 test 的 column 节点（如有）
    document.getElementById("ai-chat-dock-column")?.remove();
    delete rndCaptured.onDragStop;
    delete rndCaptured.onDrag;
  });

  it("float 拖到 viewport 右缘 24px 内 + column 不存在 → mode 切 dock (核心回归)", () => {
    render(<AiChatModal />);
    expect(rndCaptured.onDragStop).toBeDefined();
    expect(useAiChatSessionStore.getState().mode).toBe("float");

    // 模拟 react-rnd onDragStop：浮窗 360 宽，x 让 right=window.innerWidth - 5 (距右缘 5px ≤ 24)
    const vw = window.innerWidth;
    const x = vw - 360 - 5;
    act(() => {
      rndCaptured.onDragStop?.({}, { x, y: 100 });
    });

    expect(useAiChatSessionStore.getState().mode).toBe("dock");
  });

  it("float 拖到 viewport 中央（右缘距离 > 24px）+ column 不存在 → mode 保持 float", () => {
    render(<AiChatModal />);
    act(() => {
      rndCaptured.onDragStop?.({}, { x: 100, y: 100 });
    });
    expect(useAiChatSessionStore.getState().mode).toBe("float");
  });

  it("float onDrag 拖向右缘 → willRedock + edgeSnapping 进入 true（视觉指示器触发条件）", () => {
    const { container } = render(<AiChatModal />);
    expect(container.querySelector('[aria-hidden="true"][class*="w-1.5"]')).toBeNull();

    const vw = window.innerWidth;
    const x = vw - 360 - 5; // 距右缘 5px

    act(() => {
      rndCaptured.onDrag?.({}, { x, y: 100 });
    });

    // edgeSnapping=true 时渲染 mint 竖条（pointer-events-none fixed right-0 ... w-1.5）
    const edgeBar = document.querySelector('[aria-hidden="true"][class*="w-1.5"]');
    expect(edgeBar).not.toBeNull();
  });
});
