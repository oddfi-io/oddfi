// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      moneylineTitle: "Moneyline",
      moneylineDraw: "Draw",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@/components/ui/SportIcon", () => ({
  default: ({ alt }: { alt?: string }) => <span data-testid="sport-icon">{alt}</span>,
}));

import MoneylineHeader from "./MoneylineHeader";

const defaultProps = {
  homeName: "Manchester City",
  awayName: "Crystal Palace",
  homeShortCode: "MCI",
  awayShortCode: "CRY",
  homeLogo: "/images/mocks/teams/home.png",
  awayLogo: "/images/mocks/teams/away.png",
  homePct: 48,
  drawPct: 27,
  awayPct: 25,
  homeColor: "#e2b900",
  drawColor: "#8b8d93",
  awayColor: "#02aee5",
};

describe("MoneylineHeader", () => {
  it("renders home and away short codes", () => {
    render(<MoneylineHeader {...defaultProps} />);
    expect(screen.getByText("MCI")).toBeTruthy();
    expect(screen.getByText("CRY")).toBeTruthy();
  });

  it("renders three percentage values", () => {
    render(<MoneylineHeader {...defaultProps} />);
    expect(screen.getByText("48%")).toBeTruthy();
    expect(screen.getByText("27%")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy();
  });

  it("renders Draw legend label", () => {
    render(<MoneylineHeader {...defaultProps} />);
    expect(screen.getByText("Draw")).toBeTruthy();
  });

  it("renders two SportIcon logos (home + away)", () => {
    render(<MoneylineHeader {...defaultProps} />);
    const icons = screen.getAllByTestId("sport-icon");
    expect(icons.length).toBe(2);
  });

  it("renders the Moneyline title label", () => {
    render(<MoneylineHeader {...defaultProps} />);
    expect(screen.getByText("Moneyline")).toBeTruthy();
  });
});
