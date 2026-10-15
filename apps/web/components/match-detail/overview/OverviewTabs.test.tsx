// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { useState } from "react";

// Mock the three tab content components
vi.mock("./tabs/HeadToHeadTab", () => ({
  HeadToHeadTab: ({ enabled }: { enabled?: boolean }) => (
    <div data-testid="h2h-tab" data-enabled={enabled ? "true" : "false"}>
      HEAD TO HEAD
    </div>
  ),
}));

vi.mock("./tabs/StandingsTab", () => ({
  StandingsTab: ({ enabled }: { enabled?: boolean }) => (
    <div data-testid="standings-tab" data-enabled={enabled ? "true" : "false"}>
      Standings Content
    </div>
  ),
}));

vi.mock("./tabs/LineupsTab", () => ({
  LineupsTab: ({ enabled }: { enabled?: boolean }) => (
    <div data-testid="lineups-tab" data-enabled={enabled ? "true" : "false"}>
      Lineups Content
    </div>
  ),
}));

import { OverviewTabs } from "./OverviewTabs";
import type { TabId } from "./OverviewTabs";

// 受控父组件包装器 — 用于验证受控行为
function ControlledWrapper({ initialTab = "h2h" }: { initialTab?: TabId }) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  return <OverviewTabs fixtureId={123} activeTab={activeTab} onTabChange={setActiveTab} />;
}

// 只读父组件 — 不更新 state，验证受控特征
function ReadOnlyWrapper({ activeTab }: { activeTab: TabId }) {
  const onTabChange = vi.fn();
  return <OverviewTabs fixtureId={123} activeTab={activeTab} onTabChange={onTabChange} />;
}

describe("OverviewTabs", () => {
  // 全挂载模式：所有 tab 始终挂载，active 的显示，inactive 的 display:none
  it("renders all three tab containers (full-mount mode)", () => {
    render(<OverviewTabs fixtureId={123} activeTab="h2h" onTabChange={() => {}} />);
    expect(screen.getByTestId("h2h-tab")).toBeTruthy();
    expect(screen.getByTestId("standings-tab")).toBeTruthy();
    expect(screen.getByTestId("lineups-tab")).toBeTruthy();
  });

  it("h2h tab has enabled=true when activeTab='h2h'", () => {
    render(<OverviewTabs fixtureId={123} activeTab="h2h" onTabChange={() => {}} />);
    expect(screen.getByTestId("h2h-tab").getAttribute("data-enabled")).toBe("true");
    expect(screen.getByTestId("standings-tab").getAttribute("data-enabled")).toBe("false");
    expect(screen.getByTestId("lineups-tab").getAttribute("data-enabled")).toBe("false");
  });

  it("standings tab has enabled=true when activeTab='standings'", () => {
    render(<OverviewTabs fixtureId={123} activeTab="standings" onTabChange={() => {}} />);
    expect(screen.getByTestId("standings-tab").getAttribute("data-enabled")).toBe("true");
    expect(screen.getByTestId("h2h-tab").getAttribute("data-enabled")).toBe("false");
  });

  it("lineups tab has enabled=true when activeTab='lineups'", () => {
    render(<OverviewTabs fixtureId={123} activeTab="lineups" onTabChange={() => {}} />);
    expect(screen.getByTestId("lineups-tab").getAttribute("data-enabled")).toBe("true");
    expect(screen.getByTestId("h2h-tab").getAttribute("data-enabled")).toBe("false");
  });

  it("calls onTabChange with correct TabId when Standings button is clicked", () => {
    const onTabChange = vi.fn();
    render(<OverviewTabs fixtureId={123} activeTab="h2h" onTabChange={onTabChange} />);
    const standingsBtn = screen.getByRole("button", { name: /standings/i });
    fireEvent.click(standingsBtn);
    expect(onTabChange).toHaveBeenCalledWith("standings");
  });

  it("calls onTabChange with correct TabId when Lineups button is clicked", () => {
    const onTabChange = vi.fn();
    render(<OverviewTabs fixtureId={123} activeTab="h2h" onTabChange={onTabChange} />);
    const lineupsBtn = screen.getByRole("button", { name: /lineups/i });
    fireEvent.click(lineupsBtn);
    expect(onTabChange).toHaveBeenCalledWith("lineups");
  });

  it("clicking tab does NOT change enabled when parent does not update activeTab (controlled)", () => {
    // ReadOnlyWrapper never updates activeTab → h2h stays enabled=true after click
    render(<ReadOnlyWrapper activeTab="h2h" />);
    expect(screen.getByTestId("h2h-tab").getAttribute("data-enabled")).toBe("true");
    const standingsBtn = screen.getByRole("button", { name: /standings/i });
    fireEvent.click(standingsBtn);
    // h2h still enabled because parent did not update prop
    expect(screen.getByTestId("h2h-tab").getAttribute("data-enabled")).toBe("true");
    expect(screen.getByTestId("standings-tab").getAttribute("data-enabled")).toBe("false");
  });

  it("fully controlled: clicking tab changes enabled when parent updates activeTab", () => {
    render(<ControlledWrapper initialTab="h2h" />);
    expect(screen.getByTestId("h2h-tab").getAttribute("data-enabled")).toBe("true");
    // Click Standings
    fireEvent.click(screen.getByRole("button", { name: /standings/i }));
    expect(screen.getByTestId("standings-tab").getAttribute("data-enabled")).toBe("true");
    expect(screen.getByTestId("h2h-tab").getAttribute("data-enabled")).toBe("false");
    // Click back to H2H
    fireEvent.click(screen.getByRole("button", { name: /head-to-head/i }));
    expect(screen.getByTestId("h2h-tab").getAttribute("data-enabled")).toBe("true");
    expect(screen.getByTestId("standings-tab").getAttribute("data-enabled")).toBe("false");
  });
});
