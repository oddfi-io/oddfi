// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import type { SportmonksFixture, SportmonksOddsEntry } from "@/types/api";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params && "line" in params) return `${key}:${params.line as string}`;
    return key;
  },
}));

vi.mock("@/stores/betSlipStore", () => ({
  useBetSlipStore: (selector: (s: unknown) => unknown) => selector({ toggleSelection: vi.fn() }),
  selectIsSelected: () => () => false,
}));

vi.mock("@/lib/betslip-animations-pc", () => ({
  flashOddsBtn: vi.fn(),
  flyChipToPanel: vi.fn(),
  isPcRapidAdd: () => false,
  shakePanel: vi.fn(),
  scrollToNewest: vi.fn(),
}));

vi.mock("@/components/ui/SportIcon", () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="sport-icon">{alt}</span>,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="next-image">{alt}</span>,
}));

vi.mock("@/lib/parse-odds-lines", () => ({
  parseOddsLines: () => [],
}));

import MatchDetailContent from "./MatchDetailContent";

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeOdd(label: string, value: string, marketId = 1): SportmonksOddsEntry {
  return {
    id: Math.floor(Math.random() * 100000),
    fixture_id: 1,
    market_id: marketId,
    bookmaker_id: 1,
    label,
    value,
    name: null,
    market_description: marketId === 1 ? "Fulltime Result" : "Asian Handicap",
    probability: "33.33%",
    total: null,
    handicap: null,
    sort_order: 0,
  } as SportmonksOddsEntry;
}

function makeFixture(overrides: Partial<SportmonksFixture> = {}): SportmonksFixture {
  return {
    id: 19609127,
    league_id: 732,
    stage_id: 77478590,
    stage_name: "",
    name: "Mexico vs South Africa",
    starting_at: "2026-06-11 19:00:00",
    starting_at_timestamp: 1781204400,
    state_id: 1,
    has_odds: true,
    enable_bet: true,
    odds: [makeOdd("Home", "1.85"), makeOdd("Draw", "3.40"), makeOdd("Away", "4.20")],
    participants: [
      {
        id: 1,
        name: "Mexico",
        image_path: "https://cdn.sportmonks.com/images/soccer/teams/16/18576.png",
        country_id: 458,
        type: "national",
        short_code: "MEX",
        meta: { location: "home", winner: false },
      } as never,
      {
        id: 2,
        name: "South Africa",
        image_path: "https://cdn.sportmonks.com/images/soccer/teams/27/18555.png",
        country_id: 146,
        type: "national",
        short_code: "ZAF",
        meta: { location: "away", winner: false },
      } as never,
    ],
    league: { id: 732, name: "World Cup" },
    statistics: [],
    ...overrides,
  } as SportmonksFixture;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("MatchDetailContent", () => {
  it("renders fixture name and league name", () => {
    render(<MatchDetailContent fixture={makeFixture()} locale="en" />);
    expect(screen.getByText("Mexico vs South Africa")).toBeTruthy();
    expect(screen.getByText("World Cup")).toBeTruthy();
  });

  it("renders home and away team names", () => {
    render(<MatchDetailContent fixture={makeFixture()} locale="en" />);
    expect(screen.getAllByText("Mexico").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("South Africa").length).toBeGreaterThanOrEqual(1);
  });

  it("renders 1x2 odds values", () => {
    render(<MatchDetailContent fixture={makeFixture()} locale="en" />);
    expect(screen.getByText("1.85")).toBeTruthy();
    expect(screen.getByText("3.40")).toBeTruthy();
    expect(screen.getByText("4.20")).toBeTruthy();
  });

  it("renders dash for missing odds (pre_open scenario)", () => {
    const fixture = makeFixture({ odds: [], has_odds: false, enable_bet: false });
    render(<MatchDetailContent fixture={fixture} locale="en" />);
    // 三 cell 全显示 "—"
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(<MatchDetailContent fixture={makeFixture()} locale="en" onClose={onClose} />);
    const closeBtn = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg") && !b.textContent);
    closeBtn?.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hides full-page link when fullPageHref=null (Calendar use case)", () => {
    render(<MatchDetailContent fixture={makeFixture()} locale="en" fullPageHref={null} />);
    // 没有 a 链接到 /markets/fixture
    const links = screen.queryAllByRole("link");
    expect(links.find((a) => a.getAttribute("href")?.includes("fixture"))).toBeFalsy();
  });

  it("uses default full-page link to markets fixture path", () => {
    render(<MatchDetailContent fixture={makeFixture()} locale="en" />);
    const link = screen.getByTitle("openFullPage").closest("a");
    expect(link?.getAttribute("href")).toBe("/en/markets/fixture/19609127");
  });
});
