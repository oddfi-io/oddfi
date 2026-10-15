// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (key === "moneylineTeaser" && params) {
      return `Oddfi users piling on ${params.teamCode}—${params.userBetPct}% of bets vs ${params.impliedPct}% implied at ${params.odds} odds.`;
    }
    return key;
  },
}));

vi.mock("@/components/icons/AiInsightIcon", () => ({
  default: ({ size }: { size?: number }) => <span data-testid="ai-insight-icon" data-size={size} />,
}));

import MoneylineTeaser from "./MoneylineTeaser";

const stats = {
  teamCode: "BL",
  userBetPct: 48,
  impliedPct: 20,
  odds: "2.25",
};

describe("MoneylineTeaser", () => {
  it("renders the AI insight text with placeholders interpolated", () => {
    render(<MoneylineTeaser stats={stats} />);
    expect(screen.getByText(/Oddfi users piling on BL/)).toBeTruthy();
    expect(screen.getByText(/48%/)).toBeTruthy();
    expect(screen.getByText(/2\.25/)).toBeTruthy();
  });

  it("substitutes a different team code", () => {
    render(<MoneylineTeaser stats={{ ...stats, teamCode: "MCI" }} />);
    expect(screen.getByText(/Oddfi users piling on MCI/)).toBeTruthy();
  });

  it("renders the AiInsightIcon with size 32", () => {
    render(<MoneylineTeaser stats={stats} />);
    const icon = screen.getByTestId("ai-insight-icon");
    expect(icon).toBeTruthy();
    expect(icon.getAttribute("data-size")).toBe("32");
  });
});
