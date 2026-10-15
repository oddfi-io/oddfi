/**
 * @vitest-environment jsdom
 *
 * DD-110 Batch 6 — NewsPanel 组件测试。
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NewsPanel } from "./NewsPanel";
import type { UseNewsFeedResult } from "@/hooks/useNewsFeed";
import type { PushCard } from "@/types/news";

// DD-120：NewsPanel 现调 useUclWcFixtures（需 QueryClient/NextIntl Provider）→ 本测试无 provider，mock 掉。
// fixtures 为空 → resolveFixture 永远 null → 不渲染推荐卡，不影响既有断言。
vi.mock("@/hooks/useUclWcFixtures", () => ({
  useUclWcFixtures: () => ({ fixtures: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));

// IntersectionObserver 在 jsdom 中不存在 — 做最小 stub
class IOStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(
  globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }
).IntersectionObserver = IOStub as unknown as typeof IntersectionObserver;

// ResizeObserver 同样 jsdom 缺失 — react-virtual measureElement 需要它
class ROStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
  ROStub as unknown as typeof ResizeObserver;

// jsdom getBoundingClientRect / offsetWidth / offsetHeight 默认 0×0
// → react-virtual 算不出可视范围。下方 prototype 覆写持续整个 worker 生命周期，未 restore。
// 当前安全是因为 vitest 默认 forks pool（每文件独立 worker 进程）→ 不跨文件污染。
// 若未来切到 pool:'threads' / 'vmThreads' / singleFork，必须改为 beforeAll/afterAll +
// 显式 restore，否则其他依赖真实 DOM 尺寸的组件测试会集体走样（详见 REV-DD110-v4-quality I3）。
const MOCK_VIEWPORT = { width: 400, height: 600 } as const;

Element.prototype.getBoundingClientRect = function (): DOMRect {
  return {
    width: MOCK_VIEWPORT.width,
    height: MOCK_VIEWPORT.height,
    top: 0,
    left: 0,
    right: MOCK_VIEWPORT.width,
    bottom: MOCK_VIEWPORT.height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
};

Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  get() {
    return MOCK_VIEWPORT.width;
  },
});
Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  get() {
    return MOCK_VIEWPORT.height;
  },
});

function makeFeed(overrides: Partial<UseNewsFeedResult> = {}): UseNewsFeedResult {
  return {
    cards: [],
    status: "ready",
    hasMore: false,
    truncated: false,
    sseStatus: "open",
    unreadCount: 0,
    isConfigured: true,
    loadMore: vi.fn(async () => {}),
    retry: vi.fn(),
    markAllRead: vi.fn(),
    ...overrides,
  };
}

function makeCard(id: string, text = "tweet text"): PushCard {
  return {
    id,
    ingestedAt: Date.now(),
    createdAt: Date.now() - 60_000,
    enrichStatus: "skipped",
    source: "🐦 X",
    sourceUrl: `x.com/x/status/${id}`,
    originalText: text,
  };
}

describe("NewsPanel — 状态分支", () => {
  it("未配置 → 占位提示", () => {
    render(<NewsPanel feed={makeFeed({ isConfigured: false })} />);
    expect(screen.getByText(/未配置/)).toBeTruthy();
  });

  it("loading + 空 cards → 渲染骨架", () => {
    const { container } = render(<NewsPanel feed={makeFeed({ status: "loading", cards: [] })} />);
    // 3 个骨架
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("error + 空 cards → 显示加载失败 + Retry 按钮", () => {
    const retry = vi.fn();
    render(<NewsPanel feed={makeFeed({ status: "error", errorMessage: "boom", retry })} />);
    expect(screen.getByText("加载失败")).toBeTruthy();
    expect(screen.getByText("boom")).toBeTruthy();
  });

  it("error + retryAfterSec → 显示「请求过频」，隐藏 Retry 按钮（DD-110 §10.1）", () => {
    render(
      <NewsPanel
        feed={makeFeed({
          status: "error",
          errorMessage: "请求过频，60s 后再试",
          retryAfterSec: 60,
        })}
      />
    );
    expect(screen.getByText("请求过频")).toBeTruthy();
    expect(screen.getByText("请求过频，60s 后再试")).toBeTruthy();
    expect(screen.queryByText("Retry")).toBeNull();
  });

  it("ready + cards 数组 → mount 调 markAllRead", () => {
    const markAllRead = vi.fn();
    render(<NewsPanel feed={makeFeed({ cards: [makeCard("a")], markAllRead })} />);
    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  it("empty cards + ready → 暂无推送", () => {
    render(<NewsPanel feed={makeFeed({ cards: [] })} />);
    expect(screen.getByText("暂无推送")).toBeTruthy();
  });

  it("cards 非空 → 渲染所有卡片", () => {
    render(
      <NewsPanel
        feed={makeFeed({
          cards: [makeCard("a", "first"), makeCard("b", "second")],
        })}
      />
    );
    expect(screen.getByText("first")).toBeTruthy();
    expect(screen.getByText("second")).toBeTruthy();
  });

  it("truncated=true → 底部 3 天前灰条", () => {
    render(<NewsPanel feed={makeFeed({ cards: [makeCard("a")], truncated: true })} />);
    expect(screen.getByText("已展示到 3 天前")).toBeTruthy();
  });

  it("sseStatus=reconnecting → 顶部 Reconnecting… banner", () => {
    render(<NewsPanel feed={makeFeed({ sseStatus: "reconnecting", cards: [makeCard("a")] })} />);
    expect(screen.getByText("Reconnecting…")).toBeTruthy();
  });

  it("sseStatus=unstable → 连接不稳定 + Retry", () => {
    const retry = vi.fn();
    render(<NewsPanel feed={makeFeed({ sseStatus: "unstable", cards: [makeCard("a")], retry })} />);
    expect(screen.getByText("连接不稳定，可手动刷新")).toBeTruthy();
    expect(screen.getAllByText("Retry").length).toBe(1);
  });
});
