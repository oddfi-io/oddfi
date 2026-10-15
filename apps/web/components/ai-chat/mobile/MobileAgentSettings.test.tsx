/**
 * @vitest-environment jsdom
 *
 * DD-135 Batch 4 — MobileAgentSettings 组件测试。
 * 覆盖：shell 渲染（标题/chips/footer）、tab 切换分支、切 tab 不丢 draft、
 * 保存写 aiAgentStore、重置回默认、关闭回调。
 * Step/Basics 子组件降级为可交互桩（避开 PetSprite / slider 重依赖），
 * draft 状态机走真实 useAgentConfigDraft + aiAgentStore。
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => {
    const fn = (key: string) => key;
    fn.raw = (key: string) => (key === "defaultList" && ns?.includes("step3") ? [] : undefined);
    return fn;
  },
}));

// 内容子组件 → 可交互桩：basics 桩提供一个触发 onChange 的按钮（驱动 dirty）
vi.mock("./MobileAgentBasics", () => ({
  MobileAgentBasics: ({ onChange }: { onChange: (p: { name: string }) => void }) => (
    <button data-testid="stub-basics" onClick={() => onChange({ name: "Neo" })} />
  ),
}));
vi.mock("@/components/ai-agent/create-agent/Step2Behavior", () => ({
  Step2Behavior: () => <div data-testid="stub-behavior" />,
}));
vi.mock("@/components/ai-agent/create-agent/Step3Notify", () => ({
  Step3Notify: () => <div data-testid="stub-notify" />,
}));
vi.mock("@/components/ai-agent/create-agent/Step4Memory", () => ({
  Step4Memory: () => <div data-testid="stub-memory" />,
}));
vi.mock("@/components/ai-agent/create-agent/Step5Usage", () => ({
  Step5Usage: () => <div data-testid="stub-usage" />,
}));

import { MobileAgentSettings } from "./MobileAgentSettings";
import { useAiAgentStore, DEFAULT_AGENT_CONFIG } from "@/stores/aiAgentStore";

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  useAiAgentStore.setState({
    hasCreatedAgent: false,
    hasSeenGlobalOnboarding: false,
    config: DEFAULT_AGENT_CONFIG,
    hydrated: true,
  });
  vi.clearAllMocks();
});

function setup(activeTab: Parameters<typeof MobileAgentSettings>[0]["activeTab"] = "basics") {
  const onTabChange = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <MobileAgentSettings activeTab={activeTab} onTabChange={onTabChange} onClose={onClose} />
  );
  return { onTabChange, onClose, ...utils };
}

describe("MobileAgentSettings", () => {
  it("渲染 shell：标题 + 5 chips + 重置/保存 footer", () => {
    setup();
    expect(screen.getByText("settingsTitle")).toBeTruthy();
    ["basics", "behavior", "notification", "memory", "usage"].forEach((label) =>
      expect(screen.getByText(label)).toBeTruthy()
    );
    expect(screen.getByText("actions.reset")).toBeTruthy();
    expect(screen.getByText("actions.save")).toBeTruthy();
  });

  it("activeTab 分支渲染对应内容（usage）", () => {
    setup("usage");
    expect(screen.getByTestId("stub-usage")).toBeTruthy();
    expect(screen.queryByTestId("stub-basics")).toBeNull();
  });

  it("点击 chip → onTabChange（受控切换）", () => {
    const { onTabChange } = setup();
    fireEvent.click(screen.getByText("behavior"));
    expect(onTabChange).toHaveBeenCalledWith("behavior");
  });

  it("保存：默认 disabled，draft 变更后可点 → 写入 store + toast", async () => {
    const { toast } = await import("sonner");
    setup();
    const save = screen.getByText("actions.save").closest("button")!;
    expect(save.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByTestId("stub-basics")); // patch name → dirty
    expect(save.hasAttribute("disabled")).toBe(false);

    fireEvent.click(save);
    expect(useAiAgentStore.getState().config.name).toBe("Neo");
    expect(toast.success).toHaveBeenCalledOnce();
  });

  it("切 tab 不丢未保存 draft（受控 rerender 后保存仍可点）", () => {
    const onTabChange = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <MobileAgentSettings activeTab="basics" onTabChange={onTabChange} onClose={onClose} />
    );
    fireEvent.click(screen.getByTestId("stub-basics")); // dirty
    rerender(
      <MobileAgentSettings activeTab="behavior" onTabChange={onTabChange} onClose={onClose} />
    );
    expect(screen.getByTestId("stub-behavior")).toBeTruthy();
    const save = screen.getByText("actions.save").closest("button")!;
    expect(save.hasAttribute("disabled")).toBe(false); // draft 仍在
    expect(useAiAgentStore.getState().config.name).toBe(DEFAULT_AGENT_CONFIG.name); // 未落库
  });

  it("重置：draft 回默认（store 不变）→ 保存恢复 disabled", () => {
    setup();
    fireEvent.click(screen.getByTestId("stub-basics")); // dirty
    fireEvent.click(screen.getByText("actions.reset"));
    const save = screen.getByText("actions.save").closest("button")!;
    expect(save.hasAttribute("disabled")).toBe(true); // draft == store 默认
  });

  it("关闭钮 → onClose（回聊天视图）", () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByLabelText("Close settings"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
