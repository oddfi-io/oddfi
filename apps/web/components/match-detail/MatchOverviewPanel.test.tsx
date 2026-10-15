// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/**
 * MatchOverviewPanel.test.tsx — DD-104 Batch 3 更新。
 *
 * Props 变更：overview → fixtureId + locale + stateId。
 * useMatchDetailOverview mock 覆盖 loading / error / data 三 case。
 */

import type { MatchOverviewDomain } from "@/types/match-detail-domain";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="next-image">{alt}</span>,
}));

// Mock useMatchDetailOverview — 返回值由各 test case 覆写
const mockUseMatchDetailOverview = vi.fn();
vi.mock("@/hooks/useMatchDetailOverview", () => ({
  useMatchDetailOverview: (...args: unknown[]) => mockUseMatchDetailOverview(...args),
}));

// Mock sub-components to isolate MatchOverviewPanel logic
vi.mock("./overview/OverviewHeader", () => ({
  default: ({
    homeTeam,
    awayTeam,
  }: {
    homeTeam: { name: string; jerseyPath?: string };
    awayTeam: { name: string; jerseyPath?: string };
  }) => (
    <div
      data-testid="overview-header"
      data-home-jersey={homeTeam.jerseyPath ?? ""}
      data-away-jersey={awayTeam.jerseyPath ?? ""}
    >
      {homeTeam.name} vs {awayTeam.name}
    </div>
  ),
}));

vi.mock("./overview/MatchTimeline", () => ({
  default: () => <div data-testid="match-timeline" />,
}));

// DD-126：市场页详情列直播卡片 — mock 成带 fixtureId 的占位，隔离 useFixtureStreams fetch
vi.mock("./live-stream/LiveStreamSection", () => ({
  default: ({ fixtureId }: { fixtureId: number }) => (
    <div data-testid="live-stream-section" data-fixture-id={fixtureId} />
  ),
}));

vi.mock("./overview/VenueCard", () => ({
  default: () => <div data-testid="venue-card" />,
}));

// OverviewTabs mock: pass through activeTab as data-testid content so we can assert
vi.mock("./overview/OverviewTabs", () => ({
  OverviewTabs: ({
    activeTab,
    onTabChange,
  }: {
    activeTab: string;
    onTabChange: (tab: string) => void;
  }) => (
    <div data-testid="overview-tabs" data-active-tab={activeTab}>
      <span>{activeTab.toUpperCase()}</span>
      <button onClick={() => onTabChange("standings")} data-testid="mock-standings-btn">
        switch to standings
      </button>
    </div>
  ),
}));

vi.mock("./MatchOverviewToggle", () => ({
  default: () => <div data-testid="overview-toggle" />,
}));

// Mock tab content components used in compact mode
vi.mock("./overview/tabs/HeadToHeadTab", () => ({
  HeadToHeadTab: () => <div data-testid="compact-h2h">H2H Content</div>,
}));

vi.mock("./overview/tabs/StandingsTab", () => ({
  StandingsTab: () => <div data-testid="compact-standings">Standings Content</div>,
}));

vi.mock("./overview/tabs/LineupsTab", () => ({
  LineupsTab: () => <div data-testid="compact-lineups">Lineups Content</div>,
}));

import MatchOverviewPanel from "./MatchOverviewPanel";

/** 最小 MatchOverviewDomain fixture 供 data case 使用 */
const mockDomain: MatchOverviewDomain = {
  homeTeam: {
    participantId: 1,
    name: "Home FC",
    shortCode: "HOM",
    imagePath: "/images/home.png",
  },
  awayTeam: {
    participantId: 2,
    name: "Away FC",
    shortCode: "AWA",
    imagePath: "/images/away.png",
  },
  kickoff: { iso: "2026-06-11T18:00:00Z", timestamp: 1749657600 },
  venue: {
    name: "Stadium X",
    city: "City Y",
    capacity: 50000,
    imagePath: "",
    distanceKm: null,
  },
  seasonGoals: { home: null, away: null },
  topScorers: { home: null, away: null },
  standingsRank: { home: null, away: null },
  formPercentage: { home: 60, away: 45 },
  recentResults: { home: [], away: [] },
  periodGoals: [],
  winProbability: null,
  h2hSummary: { home_wins: 3, draws: 2, away_wins: 1 },
  referee: { name: "Ref Name" },
  managers: { home: { name: "Home Coach" }, away: { name: "Away Coach" } },
};

const fixtureHomeTeam = {
  participantId: 10,
  name: "Fixture Home",
  shortCode: "FHM",
  imagePath: "/images/fixture-home.png",
};
const fixtureAwayTeam = {
  participantId: 20,
  name: "Fixture Away",
  shortCode: "FAW",
  imagePath: "/images/fixture-away.png",
};

const defaultProps = {
  fixtureId: 123,
  locale: "en",
  collapsed: false,
  onToggle: () => {},
  fixtureHomeTeam,
  fixtureAwayTeam,
  fixtureStartingAt: "2026-06-11 18:00:00",
  fixtureStartingAtTimestamp: 1749657600,
} as const;

describe("MatchOverviewPanel — loading state", () => {
  it("renders skeleton when isLoading=true", () => {
    mockUseMatchDetailOverview.mockReturnValue({ data: null, isLoading: true, isError: false });
    render(<MatchOverviewPanel {...defaultProps} />);
    expect(screen.getByTestId("overview-panel-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("overview-header")).toBeNull();
  });
});

describe("MatchOverviewPanel — error / no data state", () => {
  it("renders OverviewHeader + MatchTimeline (no VenueCard / tabs) when isError=true", () => {
    mockUseMatchDetailOverview.mockReturnValue({ data: null, isLoading: false, isError: true });
    render(<MatchOverviewPanel {...defaultProps} />);
    // 基础信息从 fixtureXxx 兜底，始终展示
    expect(screen.getByTestId("overview-header")).toBeTruthy();
    expect(screen.getByTestId("match-timeline")).toBeTruthy();
    expect(screen.getByText("Fixture Home vs Fixture Away")).toBeTruthy();
    // VenueCard / OverviewTabs / Toggle 仅 overview 命中时才展示
    expect(screen.queryByTestId("venue-card")).toBeNull();
    expect(screen.queryByTestId("overview-tabs")).toBeNull();
    expect(screen.queryByTestId("overview-toggle")).toBeNull();
  });

  it("renders OverviewHeader + MatchTimeline only when data=null and not loading", () => {
    mockUseMatchDetailOverview.mockReturnValue({ data: null, isLoading: false, isError: false });
    render(<MatchOverviewPanel {...defaultProps} />);
    expect(screen.getByTestId("overview-header")).toBeTruthy();
    expect(screen.getByTestId("match-timeline")).toBeTruthy();
    expect(screen.queryByTestId("venue-card")).toBeNull();
    expect(screen.queryByTestId("overview-tabs")).toBeNull();
  });
});

describe("MatchOverviewPanel — data state", () => {
  beforeEach(() => {
    mockUseMatchDetailOverview.mockReturnValue({
      data: mockDomain,
      isLoading: false,
      isError: false,
    });
  });

  it("renders OverviewTabs when collapsed=false", () => {
    render(<MatchOverviewPanel {...defaultProps} collapsed={false} />);
    expect(screen.getByTestId("overview-tabs")).toBeTruthy();
    expect(screen.getByText("H2H")).toBeTruthy();
  });

  it("does not render OverviewTabs when collapsed=true", () => {
    render(<MatchOverviewPanel {...defaultProps} collapsed={true} />);
    expect(screen.queryByTestId("overview-tabs")).toBeNull();
  });

  it("always renders OverviewHeader, MatchTimeline and VenueCard regardless of collapsed state", () => {
    const { rerender } = render(<MatchOverviewPanel {...defaultProps} collapsed={false} />);
    expect(screen.getByTestId("overview-header")).toBeTruthy();
    expect(screen.getByTestId("match-timeline")).toBeTruthy();
    expect(screen.getByTestId("venue-card")).toBeTruthy();

    rerender(<MatchOverviewPanel {...defaultProps} collapsed={true} />);
    expect(screen.getByTestId("overview-header")).toBeTruthy();
    expect(screen.getByTestId("match-timeline")).toBeTruthy();
    expect(screen.getByTestId("venue-card")).toBeTruthy();
  });

  it("default mode passes activeTab='h2h' initially to OverviewTabs", () => {
    render(<MatchOverviewPanel {...defaultProps} collapsed={false} />);
    const tabs = screen.getByTestId("overview-tabs");
    expect(tabs.getAttribute("data-active-tab")).toBe("h2h");
  });

  it("activeTab state is shared: switching tab in default mode persists when component rerenders", () => {
    render(<MatchOverviewPanel {...defaultProps} collapsed={false} />);
    // Initial tab is h2h
    expect(screen.getByTestId("overview-tabs").getAttribute("data-active-tab")).toBe("h2h");
    // Switch to standings via mock button
    fireEvent.click(screen.getByTestId("mock-standings-btn"));
    // Tab state updated
    expect(screen.getByTestId("overview-tabs").getAttribute("data-active-tab")).toBe("standings");
  });

  it("compact mode: shows h2h content by default", () => {
    render(<MatchOverviewPanel {...defaultProps} collapsed={false} compactBody />);
    expect(screen.getByTestId("compact-h2h")).toBeTruthy();
    expect(screen.queryByTestId("compact-standings")).toBeNull();
    expect(screen.queryByTestId("compact-lineups")).toBeNull();
  });

  it("compact mode: clicking Standings tab button shows standings content", () => {
    render(<MatchOverviewPanel {...defaultProps} collapsed={false} compactBody />);
    const standingsBtn = screen.getByRole("tab", { name: /standings/i });
    fireEvent.click(standingsBtn);
    expect(screen.getByTestId("compact-standings")).toBeTruthy();
    expect(screen.queryByTestId("compact-h2h")).toBeNull();
  });

  it("passes team names from domain to OverviewHeader", () => {
    render(<MatchOverviewPanel {...defaultProps} collapsed={false} />);
    expect(screen.getByText("Home FC vs Away FC")).toBeTruthy();
  });

  it("merges fixtureHomeTeam.jerseyPath / fixtureAwayTeam.jerseyPath into OverviewHeader team props", () => {
    render(
      <MatchOverviewPanel
        {...defaultProps}
        collapsed={false}
        fixtureHomeTeam={{
          ...fixtureHomeTeam,
          jerseyPath: "https://cdn.example.com/jerseys/home.png",
        }}
        fixtureAwayTeam={{
          ...fixtureAwayTeam,
          jerseyPath: "https://cdn.example.com/jerseys/away.png",
        }}
      />
    );
    const header = screen.getByTestId("overview-header");
    expect(header.getAttribute("data-home-jersey")).toBe(
      "https://cdn.example.com/jerseys/home.png"
    );
    expect(header.getAttribute("data-away-jersey")).toBe(
      "https://cdn.example.com/jerseys/away.png"
    );
  });

  it("leaves jerseyPath undefined when fixture team_kits are not provided (non-world-cup leagues)", () => {
    render(<MatchOverviewPanel {...defaultProps} collapsed={false} />);
    const header = screen.getByTestId("overview-header");
    expect(header.getAttribute("data-home-jersey")).toBe("");
    expect(header.getAttribute("data-away-jersey")).toBe("");
  });
});

describe("MatchOverviewPanel — showLiveStream (DD-126 市场页详情列时间线下方直播)", () => {
  beforeEach(() => {
    mockUseMatchDetailOverview.mockReturnValue({
      data: mockDomain,
      isLoading: false,
      isError: false,
    });
  });

  it("renders LiveStreamSection below MatchTimeline when showLiveStream=true", () => {
    render(<MatchOverviewPanel {...defaultProps} showLiveStream />);
    const stream = screen.getByTestId("live-stream-section");
    expect(stream).toBeTruthy();
    // fixtureId 透传正确
    expect(stream.getAttribute("data-fixture-id")).toBe("123");
    // DOM 顺序：直播在时间线「下面」
    const timeline = screen.getByTestId("match-timeline");
    expect(
      timeline.compareDocumentPosition(stream) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("does not render LiveStreamSection by default (showLiveStream omitted)", () => {
    render(<MatchOverviewPanel {...defaultProps} />);
    expect(screen.queryByTestId("live-stream-section")).toBeNull();
  });

  it("renders LiveStreamSection in compact mode (市场页详情列 compactBody)", () => {
    render(<MatchOverviewPanel {...defaultProps} showLiveStream compactBody />);
    expect(screen.getByTestId("live-stream-section")).toBeTruthy();
  });
});
