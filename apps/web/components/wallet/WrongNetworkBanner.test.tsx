// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { WrongNetworkBanner } from "./WrongNetworkBanner";

const mockSwitchToCore = vi.fn();

vi.mock("@/hooks/useNetworkGuard", () => ({
  useNetworkGuard: vi.fn(),
}));

import { useNetworkGuard } from "@/hooks/useNetworkGuard";

function setupGuard(overrides: Partial<ReturnType<typeof useNetworkGuard>>) {
  vi.mocked(useNetworkGuard).mockReturnValue({
    canOperate: false,
    canOperateOnCore: false,
    isOnCoreChain: false,
    isWrongNetwork: false,
    isDisconnected: false,
    currentChain: undefined,
    coreChain: { id: 56 } as ReturnType<typeof useNetworkGuard>["coreChain"],
    switchToCore: mockSwitchToCore,
    isSwitching: false,
    switchError: null,
    connect: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useNetworkGuard>);
}

describe("WrongNetworkBanner", () => {
  beforeEach(() => {
    mockSwitchToCore.mockReset();
  });

  afterEach(cleanup);

  it("不渲染：isWrongNetwork = false", () => {
    setupGuard({ isWrongNetwork: false });
    const { container } = render(<WrongNetworkBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("不渲染：钱包连接 Arbitrum（支持链）— isWrongNetwork = false", () => {
    // Arbitrum is a supported chain; useNetworkGuard returns isWrongNetwork=false
    setupGuard({ isWrongNetwork: false, canOperate: true });
    const { container } = render(<WrongNetworkBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("渲染 Banner：isWrongNetwork = true，显示警告文案", () => {
    setupGuard({ isWrongNetwork: true });
    render(<WrongNetworkBanner />);
    expect(screen.getByText(/Please switch to a supported network/)).toBeTruthy();
  });

  it("默认状态：按钮文案为 'Switch network →'", () => {
    setupGuard({ isWrongNetwork: true });
    render(<WrongNetworkBanner />);
    expect(screen.getByText("Switch network →")).toBeTruthy();
  });

  it("切链中：按钮文案为 'Switching...'，按钮 disabled", () => {
    setupGuard({ isWrongNetwork: true, isSwitching: true });
    render(<WrongNetworkBanner />);
    const btn = screen.getByRole("button");
    expect(btn.textContent).toBe("Switching...");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("切链失败：按钮文案为 'Retry'", () => {
    setupGuard({
      isWrongNetwork: true,
      switchError: new Error("User rejected") as ReturnType<typeof useNetworkGuard>["switchError"],
    });
    render(<WrongNetworkBanner />);
    expect(screen.getByText("Retry")).toBeTruthy();
  });

  it("点击 Switch 按钮调用 switchToCore", () => {
    setupGuard({ isWrongNetwork: true });
    render(<WrongNetworkBanner />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockSwitchToCore).toHaveBeenCalledTimes(1);
  });

  it("不会自动触发切链（auto-switch 由 useAuth 负责）", () => {
    setupGuard({ isWrongNetwork: true });
    render(<WrongNetworkBanner />);
    // Banner renders but does NOT call switchToCore on mount
    expect(mockSwitchToCore).not.toHaveBeenCalled();
  });
});
