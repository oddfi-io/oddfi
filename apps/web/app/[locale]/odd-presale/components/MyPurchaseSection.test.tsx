// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../../../messages/en.json";
import { formatAdaptiveAmount } from "@/lib/decimal";
import MyPurchaseSection from "./MyPurchaseSection";

// ─── hook mocks ───────────────────────────────────────────────────────────────
let mockConnected = false;
vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: mockConnected }),
}));
let mockBalance: { total_balance?: string } | undefined;
vi.mock("@/hooks/useAccountBalance", () => ({
  useAccountBalance: () => ({ data: mockBalance }),
}));

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MyPurchaseSection />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  mockConnected = false;
  mockBalance = undefined;
});
afterEach(() => cleanup());

describe("MyPurchaseSection 渲染", () => {
  it("未连接态：展示连接引导 + 总持仓占位 --", () => {
    renderSection();
    expect(screen.getAllByText(en.token.purchase.connectHint).length).toBe(2);
    expect(screen.getAllByText("-- ODD").length).toBeGreaterThanOrEqual(1);
    // 标题渲染（PC + H5）
    expect(screen.getAllByText(en.token.purchase.title).length).toBe(2);
  });

  it("连接态：总持仓取 balance.total_balance（PC + H5 各一处显示真实值）", () => {
    mockConnected = true;
    mockBalance = { total_balance: "1234.5" };
    renderSection();
    // 无连接引导
    expect(screen.queryByText(en.token.purchase.connectHint)).toBeNull();
    // 总持仓走真实 formatAdaptiveAmount（PC + H5 各一处）
    const expected = `${formatAdaptiveAmount("1234.5")} ODD`;
    expect(screen.getAllByText(expected).length).toBe(2);
  });
});
