// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * DD-113: SubscriptionGuardButton 行为
 *
 * - 认购模式关闭：透传原 props（disabled / onClick / className）
 * - 认购模式开启：强制 disabled + 拼接灰置样式 + onClick 不触发
 *
 * IS_SUBSCRIPTION_MODE 在模块加载期 freeze，每个用例 resetModules + dynamic import。
 */
describe("components/subscription/SubscriptionGuardButton", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("非认购模式：透传 disabled prop 与 onClick", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUBSCRIPTION_MODE", "");
    const { SubscriptionGuardButton } = await import("./SubscriptionGuardButton");
    const onClick = vi.fn();
    render(
      <SubscriptionGuardButton onClick={onClick} className="text-primary">
        Buy
      </SubscriptionGuardButton>
    );
    const btn = screen.getByRole("button", { name: "Buy" });
    expect(btn).not.toBeDisabled();
    expect(btn.className).toBe("text-primary");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("非认购模式：disabled=true 时按钮保持 disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUBSCRIPTION_MODE", "");
    const { SubscriptionGuardButton } = await import("./SubscriptionGuardButton");
    const onClick = vi.fn();
    render(
      <SubscriptionGuardButton onClick={onClick} disabled>
        Buy
      </SubscriptionGuardButton>
    );
    const btn = screen.getByRole("button", { name: "Buy" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("认购模式：强制 disabled，拼接 opacity-50 与 cursor-not-allowed，onClick 不触发", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUBSCRIPTION_MODE", "1");
    const { SubscriptionGuardButton } = await import("./SubscriptionGuardButton");
    const onClick = vi.fn();
    render(
      <SubscriptionGuardButton onClick={onClick} className="text-primary">
        Buy
      </SubscriptionGuardButton>
    );
    const btn = screen.getByRole("button", { name: "Buy" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(btn.className).toContain("text-primary");
    expect(btn.className).toContain("opacity-50");
    expect(btn.className).toContain("cursor-not-allowed");
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});
