// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LeagueCountryOption } from "@/hooks/useMarketData";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
  ResizeObserverStub;

import LeagueCountryChips from "./LeagueCountryChips";

const setSelectedLeagueCountryId = vi.fn();
let mockSelectedCountryId: number | null = null;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      chipAllCountries: "All Countries",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@/stores/marketsLayoutStore", () => ({
  useMarketsLayoutStore: (selector: (s: unknown) => unknown) =>
    selector({
      selectedLeagueCountryId: mockSelectedCountryId,
      setSelectedLeagueCountryId,
    }),
  selectSelectedLeagueCountryId: (s: { selectedLeagueCountryId: number | null }) =>
    s.selectedLeagueCountryId,
}));

function lc(countryId: number, name: string, count = 1, leagueIds = [1]): LeagueCountryOption {
  return { countryId, name, imagePath: "", count, leagueIds };
}

describe("LeagueCountryChips", () => {
  beforeEach(() => {
    setSelectedLeagueCountryId.mockClear();
    mockSelectedCountryId = null;
  });

  it("renders 'All Countries' + a chip per backend-provided name", () => {
    render(
      <LeagueCountryChips
        leagueCountries={[lc(462, "England"), lc(32, "Spain"), lc(11, "Germany")]}
      />
    );
    expect(screen.getByText("All Countries")).toBeTruthy();
    expect(screen.getByText("England")).toBeTruthy();
    expect(screen.getByText("Spain")).toBeTruthy();
    expect(screen.getByText("Germany")).toBeTruthy();
  });

  it("renders backend name for countries outside the old whitelist (no longer dropped)", () => {
    // DD-market-chips：白名单外国家由后端提供名称（英文 league 名兜底），前端不再静默丢弃。
    render(<LeagueCountryChips leagueCountries={[lc(462, "England"), lc(99999, "Eliteserien")]} />);
    expect(screen.getByText("England")).toBeTruthy();
    expect(screen.getByText("Eliteserien")).toBeTruthy();
  });

  it("renders nothing when leagueCountries is empty", () => {
    const { container } = render(<LeagueCountryChips leagueCountries={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("calls setSelectedLeagueCountryId(null) when 'All Countries' clicked", () => {
    mockSelectedCountryId = 462;
    render(<LeagueCountryChips leagueCountries={[lc(462, "England", 10)]} />);
    fireEvent.click(screen.getByText("All Countries"));
    expect(setSelectedLeagueCountryId).toHaveBeenCalledWith(null);
  });

  it("calls setSelectedLeagueCountryId with countryId when a country chip clicked", () => {
    render(
      <LeagueCountryChips
        leagueCountries={[lc(462, "England", 10), lc(35376, "Saudi Arabia", 2)]}
      />
    );
    fireEvent.click(screen.getByText("Saudi Arabia"));
    expect(setSelectedLeagueCountryId).toHaveBeenCalledWith(35376);
  });
});
