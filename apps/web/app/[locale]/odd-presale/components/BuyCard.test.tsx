// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import en from "../../../../messages/en.json";
import BuyCard, { buyButtonState } from "./BuyCard";
import type { SaleState } from "../config/tier-sale.config";

// ─── hook mocks ───────────────────────────────────────────────────────────────
let mockIsConnected = false;
vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: mockIsConnected, address: undefined }),
}));
vi.mock("@/hooks/useRequireWallet", () => ({
  useRequireWallet: () => ({ requireWallet: vi.fn().mockResolvedValue("0x0") }),
}));
let mockBalance: { usdt_available_balance?: string } | undefined = {
  usdt_available_balance: "1000",
};
vi.mock("@/hooks/useAccountBalance", () => ({
  useAccountBalance: () => ({ data: mockBalance }),
}));

interface BuyState {
  estimate: { odd_amount: string } | null;
  phase: string;
  isBusy: boolean;
  errorMessage?: string;
  buyTxHash?: string;
}
let mockBuy: BuyState = { estimate: null, phase: "idle", isBusy: false };
const setUsdtAmount = vi.fn();
const buyFn = vi.fn();
vi.mock("@/hooks/useTierSaleBuy", () => ({
  useTierSaleBuy: () => ({
    estimate: mockBuy.estimate,
    phase: mockBuy.phase,
    isBusy: mockBuy.isBusy,
    errorMessage: mockBuy.errorMessage,
    buyTxHash: mockBuy.buyTxHash,
    setUsdtAmount,
    buy: buyFn,
  }),
}));

const SALE: SaleState = {
  totalSoldOdd: "12780000",
  currentTier: 5,
  currentTierPriceUsd: "0.05",
  currentTierSoldOdd: "1800000",
  currentTierRemainingOdd: "1200000",
  poolProgressPct: "42.6",
  soldOut: false,
};

function renderCard(saleState: SaleState | null = SALE) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={en}>
        <BuyCard saleState={saleState} />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockIsConnected = false;
  mockBalance = { usdt_available_balance: "1000" };
  mockBuy = { estimate: null, phase: "idle", isBusy: false };
});
afterEach(() => cleanup());

// ─── pure helper ────────────────────────────────────────────────────────────
describe("buyButtonState", () => {
  const labels = {
    connect: "Connect & Buy",
    buy: "Buy",
    soldOut: "Sold out",
    processing: "Processing",
  };

  it("未连接 → connect 文案且可点", () => {
    const r = buyButtonState({
      isConnected: false,
      isBusy: false,
      estimateOddAmount: undefined,
      hasAmount: false,
      soldOut: false,
      labels,
    });
    expect(r.label).toBe("Connect & Buy");
    expect(r.disabled).toBe(false);
  });
  it("连接 + 售罄 → 禁用", () => {
    const r = buyButtonState({
      isConnected: true,
      isBusy: false,
      estimateOddAmount: "100",
      hasAmount: true,
      soldOut: true,
      labels,
    });
    expect(r.label).toBe("Sold out");
    expect(r.disabled).toBe(true);
  });
  it("连接 + isBusy → 处理中禁用", () => {
    const r = buyButtonState({
      isConnected: true,
      isBusy: true,
      estimateOddAmount: "100",
      hasAmount: true,
      soldOut: false,
      labels,
    });
    expect(r.label).toBe("Processing");
    expect(r.disabled).toBe(true);
  });
  it("连接 + estimate odd_amount=0（预算太小/售罄）→ 禁用", () => {
    const r = buyButtonState({
      isConnected: true,
      isBusy: false,
      estimateOddAmount: "0",
      hasAmount: true,
      soldOut: false,
      labels,
    });
    expect(r.disabled).toBe(true);
  });
  it("连接 + 无输入 → 禁用", () => {
    const r = buyButtonState({
      isConnected: true,
      isBusy: false,
      estimateOddAmount: undefined,
      hasAmount: false,
      soldOut: false,
      labels,
    });
    expect(r.disabled).toBe(true);
  });
  it("连接 + 有效输入 + estimate>0 → 可买", () => {
    const r = buyButtonState({
      isConnected: true,
      isBusy: false,
      estimateOddAmount: "5000",
      hasAmount: true,
      soldOut: false,
      labels,
    });
    expect(r.label).toBe("Buy");
    expect(r.disabled).toBe(false);
  });
});

// ─── render states ──────────────────────────────────────────────────────────
describe("BuyCard 渲染", () => {
  it("未连接态：渲染未连接按钮文案 + 邀请码占位行", () => {
    mockIsConnected = false;
    renderCard();
    expect(screen.getByText(en.token.buy.connectAndBuy)).toBeTruthy();
    expect(screen.getByText(en.token.buy.inviteCodeOptional)).toBeTruthy();
  });

  it("连接态：渲染购买按钮，无邀请码占位行", () => {
    mockIsConnected = true;
    renderCard();
    expect(screen.getByText(en.token.buy.buy)).toBeTruthy();
    expect(screen.queryByText(en.token.buy.inviteCodeOptional)).toBeNull();
  });

  it("售罄(soldOut)：按钮禁用", () => {
    mockIsConnected = true;
    renderCard({ ...SALE, soldOut: true });
    const btn = screen.getByRole("button", { name: en.token.buy.soldOut });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("isBusy：按钮禁用 + 处理中文案", () => {
    mockIsConnected = true;
    mockBuy = { estimate: { odd_amount: "5000" }, phase: "approving", isBusy: true };
    renderCard();
    const btn = screen.getByRole("button", { name: en.token.buy.processing });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("信息面板：渲染当前档位单价 $0.05 + 本档剩余 1,200,000", () => {
    mockIsConnected = true;
    renderCard();
    expect(screen.getByText("$0.05")).toBeTruthy();
    expect(screen.getByText(/1,200,000/)).toBeTruthy();
  });

  it("saleState=null：信息面板降级为占位 --，不崩", () => {
    mockIsConnected = true;
    renderCard(null);
    expect(screen.getByText(en.token.buy.buy)).toBeTruthy();
  });

  // ─── C1 修复：购买态反馈（防重复购买的最后一环） ───────────────────────────────
  it("reconciling：渲染对账提示 + 勿重复购买文案（醒目）", () => {
    mockIsConnected = true;
    mockBuy = {
      estimate: { odd_amount: "5000" },
      phase: "reconciling",
      isBusy: false,
      errorMessage: "Submitted, but confirmation is taking longer than expected.",
    };
    renderCard();
    expect(screen.getByText(en.token.buy.reconcileHint)).toBeTruthy();
    expect(screen.getByText(/taking longer/)).toBeTruthy();
  });

  it("failed：渲染错误文案", () => {
    mockIsConnected = true;
    mockBuy = {
      estimate: { odd_amount: "5000" },
      phase: "failed",
      isBusy: false,
      errorMessage: "Transaction failed, please try again.",
    };
    renderCard();
    expect(screen.getByText(/Transaction failed/)).toBeTruthy();
  });

  it("success：渲染成功文案 + tx 短哈希", () => {
    mockIsConnected = true;
    mockBuy = {
      estimate: { odd_amount: "5000" },
      phase: "success",
      isBusy: false,
      buyTxHash: "0xabcdef1234567890",
    };
    renderCard();
    expect(screen.getByText(/0xabcdef12/)).toBeTruthy();
  });

  it("M2 超额输入（> 可用 USDT）：提示余额不足 + 购买禁用", () => {
    mockIsConnected = true;
    mockBalance = { usdt_available_balance: "10" };
    mockBuy = { estimate: { odd_amount: "5000" }, phase: "idle", isBusy: false };
    const { container } = renderCard();
    const input = container.querySelector("input")!;
    // 输入 100 > 余额 10
    fireEvent.change(input, { target: { value: "100" } });
    expect(screen.getByText(en.token.buy.insufficientBalance)).toBeTruthy();
  });
});
