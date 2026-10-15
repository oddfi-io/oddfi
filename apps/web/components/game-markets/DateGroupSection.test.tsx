// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { SportmonksFixture } from "@/types/api";
import DateGroupSection from "./DateGroupSection";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      timelineToday: "Today",
      timelineTomorrow: "Tomorrow",
    };
    return map[key] ?? key;
  },
  useLocale: () => "en",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/useResponsiveMode", () => ({
  useResponsiveMode: () => "standard",
}));

vi.mock("@/stores/marketsLayoutStore", () => ({
  useLayoutState: () => "default",
  useMarketsLayoutStore: (selector: (s: unknown) => unknown) =>
    selector({ selectedFixtureId: null, selectFixture: vi.fn() }),
  selectSelectedFixtureId: (s: { selectedFixtureId: unknown }) => s.selectedFixtureId,
}));

vi.mock("./MatchCard", () => ({
  default: ({ fixture }: { fixture: SportmonksFixture }) => (
    <div data-testid="match-card">{fixture.name}</div>
  ),
}));

function makeFx(id: number, name = `Fixture ${id}`): SportmonksFixture {
  return {
    id,
    league_id: 8,
    stage_id: 0,
    name,
    starting_at: "2026-06-11 15:00:00",
    starting_at_timestamp: 1781622000,
    state_id: 1,
    has_odds: true,
    odds: [],
    participants: [],
  } as SportmonksFixture;
}

describe("DateGroupSection", () => {
  const today = "2026-06-11";

  it("renders header with Today label and fixture count", () => {
    render(
      <DateGroupSection
        date={today}
        today={today}
        fixtures={[makeFx(1), makeFx(2), makeFx(3)]}
        locale="en"
      />
    );
    expect(screen.getByText("Today")).toBeTruthy();
  });

  it("renders all match cards when expanded by default", () => {
    render(
      <DateGroupSection
        date={today}
        today={today}
        fixtures={[makeFx(1, "A"), makeFx(2, "B")]}
        locale="en"
      />
    );
    expect(screen.getAllByTestId("match-card")).toHaveLength(2);
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
  });

  it("hides match cards when defaultCollapsed=true", () => {
    render(
      <DateGroupSection
        date={today}
        today={today}
        fixtures={[makeFx(1), makeFx(2)]}
        locale="en"
        defaultCollapsed
      />
    );
    expect(screen.queryAllByTestId("match-card")).toHaveLength(0);
    // Count badge visible only when collapsed
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("renders label override instead of date label (test group)", () => {
    render(
      <DateGroupSection
        date="__test__"
        today={today}
        fixtures={[makeFx(1)]}
        locale="en"
        label="Test"
      />
    );
    expect(screen.getByText("Test")).toBeTruthy();
    // 不再回退到日期标签
    expect(screen.queryByText("Today")).toBeNull();
  });

  it("toggles visibility when header clicked", () => {
    render(
      <DateGroupSection date={today} today={today} fixtures={[makeFx(1), makeFx(2)]} locale="en" />
    );
    expect(screen.getAllByTestId("match-card")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryAllByTestId("match-card")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getAllByTestId("match-card")).toHaveLength(2);
  });
});
