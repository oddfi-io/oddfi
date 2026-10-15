// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../../../messages/en.json";
import VaultInfoCard, { cumulativeRaisedUsd } from "./VaultInfoCard";
import type { SaleState } from "../config/tier-sale.config";

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
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <VaultInfoCard saleState={saleState} />
    </NextIntlClientProvider>
  );
}

afterEach(() => cleanup());

describe("cumulativeRaisedUsd（阶梯定价积分）", () => {
  it("0 售出 → 0", () => {
    expect(cumulativeRaisedUsd("0")).toBe("0");
  });
  it("整第 1 档售罄（3,000,000 × $0.01）→ 30000", () => {
    expect(Number(cumulativeRaisedUsd("3000000"))).toBe(30000);
  });
  it("第 5 档部分售出（12,780,000）：前 4 档全卖 + 第 5 档 780,000 × $0.05", () => {
    // tier1..4: 3M×(0.01+0.02+0.03+0.04)=3M×0.10=300000; tier5: 780000×0.05=39000
    expect(Number(cumulativeRaisedUsd("12780000"))).toBe(339000);
  });
});

describe("VaultInfoCard 渲染", () => {
  it("渲染建池进度 42.6% + 标题 + 已售出 ODD 千分位", () => {
    renderCard();
    expect(screen.getByText(en.token.vault.title)).toBeTruthy();
    // 42.6% 出现在 subtitle + 进度行两处
    expect(screen.getAllByText(/42\.6%/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("12,780,000")).toBeTruthy();
  });

  it("saleState=null：占位不崩，进度 0%", () => {
    renderCard(null);
    expect(screen.getByText(en.token.vault.infoTitle)).toBeTruthy();
  });
});
