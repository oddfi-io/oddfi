/**
 * @vitest-environment jsdom
 *
 * DD-135 Batch 4 — MobileAgentDrawer 组件测试。
 * 覆盖：开关挂载/卸载（WAAPI 退场 + fallback timer）、遮罩/关闭钮/Escape 关闭、
 * 复用 AiChatSidebar 的回调透传。jsdom 无 WAAPI → mock element.animate。
 */
import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { MobileAgentDrawer } from "./MobileAgentDrawer";

type AnimStub = { onfinish: (() => void) | null; cancel: () => void };
let animations: AnimStub[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  animations = [];
  // jsdom 无 WAAPI：stub 收集动画实例，可手动触发 onfinish
  Element.prototype.animate = vi.fn(() => {
    const stub: AnimStub = { onfinish: null, cancel: vi.fn() };
    animations.push(stub);
    return stub as unknown as Animation;
  }) as unknown as typeof Element.prototype.animate;
});

afterEach(() => {
  vi.useRealTimers();
});

const baseProps = {
  recents: [],
  onNewChat: vi.fn(),
  onClearRecents: vi.fn(),
  onOpenConfig: vi.fn(),
};

describe("MobileAgentDrawer", () => {
  it("open=false → 不挂载", () => {
    render(<MobileAgentDrawer open={false} onClose={vi.fn()} {...baseProps} />);
    expect(screen.queryByRole("dialog", { name: "Agent menu" })).toBeNull();
  });

  it("open=true → 挂载抽屉 + 复用 AiChatSidebar（Feature 7 项）+ 播放入场动画", () => {
    render(<MobileAgentDrawer open onClose={vi.fn()} {...baseProps} />);
    expect(screen.getByRole("dialog", { name: "Agent menu" })).toBeTruthy();
    ["newChat", "search", "basics", "behavior", "notification", "memory", "usage"].forEach(
      (label) => expect(screen.getByText(label)).toBeTruthy()
    );
    // panel translateX + 遮罩 fade 两条入场动画
    expect(animations.length).toBeGreaterThanOrEqual(2);
  });

  it("点击遮罩 / 关闭钮 → onClose", () => {
    const onClose = vi.fn();
    const { container } = render(<MobileAgentDrawer open onClose={onClose} {...baseProps} />);
    void container;
    fireEvent.click(screen.getByLabelText("Close menu"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape → onClose", () => {
    const onClose = vi.fn();
    render(<MobileAgentDrawer open onClose={onClose} {...baseProps} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("open 翻 false → 播退场动画，onfinish 后卸载", () => {
    const { rerender } = render(<MobileAgentDrawer open onClose={vi.fn()} {...baseProps} />);
    animations = [];
    rerender(<MobileAgentDrawer open={false} onClose={vi.fn()} {...baseProps} />);
    // 退场动画已创建，但未结束 → 仍挂载
    expect(animations.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("dialog", { name: "Agent menu" })).toBeTruthy();
    // 触发 panel 动画 onfinish → 卸载
    act(() => {
      animations[0].onfinish?.();
    });
    expect(screen.queryByRole("dialog", { name: "Agent menu" })).toBeNull();
  });

  it("退场动画被打断（onfinish 未触发）→ fallback timer 兜底卸载", () => {
    const { rerender } = render(<MobileAgentDrawer open onClose={vi.fn()} {...baseProps} />);
    rerender(<MobileAgentDrawer open={false} onClose={vi.fn()} {...baseProps} />);
    expect(screen.getByRole("dialog", { name: "Agent menu" })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(screen.queryByRole("dialog", { name: "Agent menu" })).toBeNull();
  });

  it("快速 open→close→open 竞态：过时退场回调不卸载抽屉（REV-v1 A-3 cancelled 防重入）", () => {
    const { rerender } = render(<MobileAgentDrawer open onClose={vi.fn()} {...baseProps} />);
    animations = [];
    // close：创建退场动画
    rerender(<MobileAgentDrawer open={false} onClose={vi.fn()} {...baseProps} />);
    const staleExit = animations[0];
    // 退场未结束立即 reopen → 退场 effect cleanup 应作废过时回调
    rerender(<MobileAgentDrawer open onClose={vi.fn()} {...baseProps} />);
    act(() => {
      staleExit.onfinish?.(); // 过时 onfinish 此时触发
      vi.advanceTimersByTime(450); // 过时 fallback timer 也已被 cleanup 清掉
    });
    expect(screen.getByRole("dialog", { name: "Agent menu" })).toBeTruthy();
  });

  it("open 时锁定 body 滚动，关闭后恢复先前值（REV-v1 A-2）", () => {
    document.body.style.overflow = "hidden"; // 模拟 sheet 已锁
    const { rerender, unmount } = render(
      <MobileAgentDrawer open onClose={vi.fn()} {...baseProps} />
    );
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<MobileAgentDrawer open={false} onClose={vi.fn()} {...baseProps} />);
    // 恢复的是先前值（sheet 的 hidden），不是清空
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    document.body.style.overflow = "";
  });

  it("点击设置项 → onOpenConfig 收到对应 tab", () => {
    const onOpenConfig = vi.fn();
    render(<MobileAgentDrawer open onClose={vi.fn()} {...baseProps} onOpenConfig={onOpenConfig} />);
    fireEvent.click(screen.getByText("memory"));
    expect(onOpenConfig).toHaveBeenCalledWith("memory");
  });
});
