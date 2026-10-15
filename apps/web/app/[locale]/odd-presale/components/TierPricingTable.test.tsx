// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../../../messages/en.json";
import TierPricingTable from "./TierPricingTable";
import type { SaleState } from "../config/tier-sale.config";

// ─── hook mock ────────────────────────────────────────────────────────────────
let mockSale: SaleState | null = null;
vi.mock("../hooks/useTierSaleState", () => ({
  useTierSaleState: () => ({
    saleState: mockSale,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

function renderTable() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <TierPricingTable />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  cleanup();
  mockSale = null;
});

describe("TierPricingTable 渲染", () => {
  it("渲染 10 档行（PC + H5 各一份 → 每档名出现 2 次）", () => {
    renderTable();
    for (let tier = 1; tier <= 10; tier++) {
      expect(screen.getAllByText(`Tier ${tier}`).length).toBe(2);
    }
  });

  it("当前档高亮：currentTier=5 时第 5 档累积售出标蓝（text-brand-default）", () => {
    mockSale = {
      totalSoldOdd: "12780000",
      currentTier: 5,
      currentTierPriceUsd: "0.05",
      currentTierSoldOdd: "1800000",
      currentTierRemainingOdd: "1200000",
      poolProgressPct: "42.6",
      soldOut: false,
    };
    renderTable();
    // 第 5 档累积售出 = 5 × 3,000,000 = 15,000,000 ODD → en locale "15M"
    const cells = screen.getAllByText("15M");
    const highlighted = cells.filter((el) => el.className.includes("text-brand-default"));
    expect(highlighted.length).toBeGreaterThanOrEqual(1);
  });
});
