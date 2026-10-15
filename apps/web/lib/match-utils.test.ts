import { describe, it, expect } from "vitest";
import type { SportmonksFixture, SportmonksOddsEntry } from "@/types/api";
import {
  getTeam,
  getTeamLogo,
  getTeamName,
  formatKickoff,
  getOddsByMarketId,
  get1X2Entry,
  getFirstLineEntries,
  getMainHandicapLine,
  getMainTotalLine,
  getOddsDisplay,
  getOddsEntries,
  getAllOddsDisplay,
} from "./match-utils";

// ─── Mock data ────────────────────────────────────────────────────────────

const mockFixture: SportmonksFixture = {
  id: 123,
  league_id: 8,
  stage_id: 0,
  name: "Arsenal vs Chelsea",
  starting_at: "2026-06-15T14:30:00.000000Z",
  starting_at_timestamp: 1781538600,
  state_id: 1,
  has_odds: true,
  odds: [],
  participants: [
    {
      id: 1,
      name: "Arsenal",
      short_code: "ARS",
      image_path: "https://cdn/arsenal.png",
      country_id: 462,
      type: "domestic",
      meta: { location: "home", winner: null, position: 1 },
    },
    {
      id: 2,
      name: "Chelsea",
      short_code: "CHE",
      image_path: "https://cdn/chelsea.png",
      country_id: 462,
      type: "domestic",
      meta: { location: "away", winner: null, position: 2 },
    },
  ],
};

const baseOddsEntry: Omit<
  SportmonksOddsEntry,
  "market_id" | "label" | "value" | "market_description"
> = {
  id: 1,
  fixture_id: 123,
  bookmaker_id: 1,
  name: null,
  probability: "33.33%",
  total: null,
  handicap: null,
  sort_order: 1,
  winning: false,
  stopped: false,
};

const mock1X2Odds: SportmonksOddsEntry[] = [
  {
    ...baseOddsEntry,
    id: 1,
    market_id: 1,
    label: "Home",
    value: "2.10",
    market_description: "Fulltime Result",
  },
  {
    ...baseOddsEntry,
    id: 2,
    market_id: 1,
    label: "Draw",
    value: "3.25",
    market_description: "Fulltime Result",
  },
  {
    ...baseOddsEntry,
    id: 3,
    market_id: 1,
    label: "Away",
    value: "3.50",
    market_description: "Fulltime Result",
  },
];

const mockHandicapOdds: SportmonksOddsEntry[] = [
  {
    ...baseOddsEntry,
    id: 4,
    market_id: 6,
    label: "Home",
    value: "1.85",
    handicap: "-0.5",
    market_description: "Asian Handicap",
  },
  {
    ...baseOddsEntry,
    id: 5,
    market_id: 6,
    label: "Away",
    value: "2.05",
    handicap: "0.5",
    market_description: "Asian Handicap",
  },
];

const mockTotalOdds: SportmonksOddsEntry[] = [
  {
    ...baseOddsEntry,
    id: 6,
    market_id: 7,
    label: "Over",
    value: "1.90",
    total: "2.5",
    market_description: "Asian Total",
  },
  {
    ...baseOddsEntry,
    id: 7,
    market_id: 7,
    label: "Under",
    value: "1.95",
    total: "2.5",
    market_description: "Asian Total",
  },
];

const allOdds = [...mock1X2Odds, ...mockHandicapOdds, ...mockTotalOdds];

// ─── Tests ────────────────────────────────────────────────────────────────

describe("getTeam", () => {
  it("returns home participant", () => {
    const team = getTeam(mockFixture, "home");
    expect(team?.name).toBe("Arsenal");
    expect(team?.meta.location).toBe("home");
  });

  it("returns away participant", () => {
    const team = getTeam(mockFixture, "away");
    expect(team?.name).toBe("Chelsea");
    expect(team?.meta.location).toBe("away");
  });

  it("returns undefined when no matching participant", () => {
    const emptyFixture: SportmonksFixture = {
      ...mockFixture,
      participants: [],
    };
    expect(getTeam(emptyFixture, "home")).toBeUndefined();
  });
});

describe("getTeamLogo", () => {
  it("returns image_path for existing team", () => {
    expect(getTeamLogo(mockFixture, "home")).toBe("https://cdn/arsenal.png");
    expect(getTeamLogo(mockFixture, "away")).toBe("https://cdn/chelsea.png");
  });

  it("returns empty string when team not found", () => {
    const emptyFixture: SportmonksFixture = {
      ...mockFixture,
      participants: [],
    };
    expect(getTeamLogo(emptyFixture, "home")).toBe("");
  });
});

describe("getTeamName", () => {
  it("returns name for existing team", () => {
    expect(getTeamName(mockFixture, "home")).toBe("Arsenal");
    expect(getTeamName(mockFixture, "away")).toBe("Chelsea");
  });

  it('returns "—" when team not found', () => {
    const emptyFixture: SportmonksFixture = {
      ...mockFixture,
      participants: [],
    };
    expect(getTeamName(emptyFixture, "home")).toBe("—");
  });
});

describe("formatKickoff", () => {
  it("formats in the runtime's local timezone (HH:mm)", () => {
    const ms = Date.UTC(2026, 5, 15, 14, 30, 0);
    const d = new Date(ms);
    const expected = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    expect(formatKickoff("2026-06-15T14:30:00.000000Z")).toBe(expected);
  });

  it("treats string variants and timestamps as the same UTC instant", () => {
    const baseline = formatKickoff("2026-06-15T14:30:00Z");
    expect(formatKickoff("2026-06-15T14:30:00")).toBe(baseline);
    expect(formatKickoff("2026-06-15 14:30:00")).toBe(baseline);
    expect(formatKickoff(Date.UTC(2026, 5, 15, 14, 30, 0) / 1000)).toBe(baseline);
    expect(formatKickoff(Date.UTC(2026, 5, 15, 14, 30, 0))).toBe(baseline);
  });

  it("pads single-digit hours and minutes", () => {
    // 03:05 UTC → 当前时区的 (3 + offset):(05) 仍需补零
    const result = formatKickoff("2026-01-01T03:05:00.000000Z");
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it("returns a string for invalid date input", () => {
    // Invalid Date 在 getHours 上返回 NaN，padStart("NaN", 2) 还是 "NaN" — 不崩即可
    const result = formatKickoff("not-a-date");
    expect(typeof result).toBe("string");
  });
});

describe("getOddsByMarketId", () => {
  it("filters entries by market_id", () => {
    const result = getOddsByMarketId(allOdds, 1);
    expect(result).toHaveLength(3);
    expect(result.every((o) => o.market_id === 1)).toBe(true);
  });

  it("returns empty array when no matching market_id", () => {
    expect(getOddsByMarketId(allOdds, 999)).toEqual([]);
  });

  it("returns empty array for empty odds", () => {
    expect(getOddsByMarketId([], 1)).toEqual([]);
  });
});

describe("get1X2Entry", () => {
  it("finds Home entry", () => {
    const entry = get1X2Entry(mock1X2Odds, "Home");
    expect(entry?.value).toBe("2.10");
    expect(entry?.label).toBe("Home");
  });

  it("finds Draw entry", () => {
    const entry = get1X2Entry(mock1X2Odds, "Draw");
    expect(entry?.value).toBe("3.25");
  });

  it("finds Away entry", () => {
    const entry = get1X2Entry(mock1X2Odds, "Away");
    expect(entry?.value).toBe("3.50");
  });

  it("returns undefined for non-existent label", () => {
    expect(get1X2Entry(mock1X2Odds, "NonExistent")).toBeUndefined();
  });

  it("only searches market_id=1", () => {
    // handicap odds have "Home"/"Away" labels too, but market_id=6
    expect(get1X2Entry(mockHandicapOdds, "Home")).toBeUndefined();
  });
});

describe("getFirstLineEntries", () => {
  it("finds Asian Handicap home/away entries", () => {
    const { home, away } = getFirstLineEntries(allOdds, 6, ["Home", "1"], ["Away", "2"]);
    expect(home?.value).toBe("1.85");
    expect(away?.value).toBe("2.05");
  });

  it("matches alternative labels ('1'/'2')", () => {
    const altLabelOdds: SportmonksOddsEntry[] = [
      {
        ...baseOddsEntry,
        id: 10,
        market_id: 6,
        label: "1",
        value: "1.80",
        handicap: "-1.0",
        market_description: "Asian Handicap",
      },
      {
        ...baseOddsEntry,
        id: 11,
        market_id: 6,
        label: "2",
        value: "2.10",
        handicap: "1.0",
        market_description: "Asian Handicap",
      },
    ];
    const { home, away } = getFirstLineEntries(altLabelOdds, 6, ["Home", "1"], ["Away", "2"]);
    expect(home?.label).toBe("1");
    expect(away?.label).toBe("2");
  });

  it("finds Over/Under entries for total", () => {
    const { home, away } = getFirstLineEntries(allOdds, 7, ["Over"], ["Under"]);
    expect(home?.value).toBe("1.90");
    expect(away?.value).toBe("1.95");
  });

  it("returns undefined entries when market not found", () => {
    const { home, away } = getFirstLineEntries([], 6, ["Home", "1"], ["Away", "2"]);
    expect(home).toBeUndefined();
    expect(away).toBeUndefined();
  });
});

describe("getMainHandicapLine", () => {
  it("returns handicap data when available", () => {
    const result = getMainHandicapLine(allOdds);
    expect(result).not.toBeNull();
    expect(result!.homeOdds).toBe("1.85");
    expect(result!.awayOdds).toBe("2.05");
    expect(result!.line).toBe("-0.5");
  });

  it("returns null when no handicap odds", () => {
    expect(getMainHandicapLine(mock1X2Odds)).toBeNull();
  });

  it("returns null for empty odds", () => {
    expect(getMainHandicapLine([])).toBeNull();
  });

  it('falls back to "—" when only one side exists', () => {
    const oneSideOdds: SportmonksOddsEntry[] = [
      {
        ...baseOddsEntry,
        id: 20,
        market_id: 6,
        label: "Home",
        value: "1.85",
        handicap: "-0.5",
        market_description: "Asian Handicap",
      },
    ];
    const result = getMainHandicapLine(oneSideOdds);
    expect(result).not.toBeNull();
    expect(result!.homeOdds).toBe("1.85");
    expect(result!.awayOdds).toBe("—");
    expect(result!.line).toBe("-0.5");
  });
});

describe("getMainTotalLine", () => {
  it("returns total data when available", () => {
    const result = getMainTotalLine(allOdds);
    expect(result).not.toBeNull();
    expect(result!.overOdds).toBe("1.90");
    expect(result!.underOdds).toBe("1.95");
    expect(result!.line).toBe("2.5");
  });

  it("returns null when no total odds", () => {
    expect(getMainTotalLine(mock1X2Odds)).toBeNull();
  });

  it("returns null for empty odds", () => {
    expect(getMainTotalLine([])).toBeNull();
  });

  it('falls back to "—" when only one side exists', () => {
    const oneSideOdds: SportmonksOddsEntry[] = [
      {
        ...baseOddsEntry,
        id: 30,
        market_id: 7,
        label: "Over",
        value: "1.90",
        total: "2.5",
        market_description: "Asian Total",
      },
    ];
    const result = getMainTotalLine(oneSideOdds);
    expect(result).not.toBeNull();
    expect(result!.overOdds).toBe("1.90");
    expect(result!.underOdds).toBe("—");
    expect(result!.line).toBe("2.5");
  });
});

describe("getOddsDisplay", () => {
  describe('filter="winner"', () => {
    it("returns 1X2 data", () => {
      const display = getOddsDisplay(allOdds, "winner");
      expect(display.col1).toBe("2.10");
      expect(display.col2).toBe("3.25");
      expect(display.col3).toBe("3.50");
      expect(display.header1).toBe("1");
      expect(display.header2).toBe("1x2");
      expect(display.header3).toBe("2");
      expect(display.isFallback).toBe(false);
    });
  });

  describe('filter="handicap"', () => {
    it("returns handicap data when available", () => {
      const display = getOddsDisplay(allOdds, "handicap");
      expect(display.col1).toBe("1.85");
      expect(display.col2).toBe("-0.5");
      expect(display.col3).toBe("2.05");
      expect(display.header1).toBe("1");
      expect(display.header2).toBe("HC");
      expect(display.header3).toBe("2");
      expect(display.isFallback).toBe(false);
    });

    it("falls back to 1X2 when no handicap data", () => {
      const display = getOddsDisplay(mock1X2Odds, "handicap");
      expect(display.col1).toBe("2.10");
      expect(display.col2).toBe("3.25");
      expect(display.col3).toBe("3.50");
      expect(display.isFallback).toBe(true);
    });
  });

  describe('filter="total"', () => {
    it("returns total data when available", () => {
      const display = getOddsDisplay(allOdds, "total");
      expect(display.col1).toBe("1.90");
      expect(display.col2).toBe("2.5");
      expect(display.col3).toBe("1.95");
      expect(display.header1).toBe("O");
      expect(display.header2).toBe("O/U");
      expect(display.header3).toBe("U");
      expect(display.isFallback).toBe(false);
    });

    it("falls back to 1X2 when no total data", () => {
      const display = getOddsDisplay(mock1X2Odds, "total");
      expect(display.col1).toBe("2.10");
      expect(display.isFallback).toBe(true);
    });
  });

  it('returns "—" for all columns when odds are empty', () => {
    const display = getOddsDisplay([], "winner");
    expect(display.col1).toBe("—");
    expect(display.col2).toBe("—");
    expect(display.col3).toBe("—");
    expect(display.isFallback).toBe(false);
  });

  it('returns "—" and isFallback=true when handicap filter on empty odds', () => {
    const display = getOddsDisplay([], "handicap");
    expect(display.col1).toBe("—");
    expect(display.col2).toBe("—");
    expect(display.col3).toBe("—");
    expect(display.isFallback).toBe(true);
  });
});

describe("getOddsEntries", () => {
  describe('filter="winner"', () => {
    it("returns 1X2 entries", () => {
      const entries = getOddsEntries(allOdds, "winner");
      expect(entries.entry1?.label).toBe("Home");
      expect(entries.entry2?.label).toBe("Draw");
      expect(entries.entry3?.label).toBe("Away");
      expect(entries.displayLabel1).toBe("Home");
      expect(entries.displayLabel2).toBe("Draw");
      expect(entries.displayLabel3).toBe("Away");
    });
  });

  describe('filter="handicap"', () => {
    it("returns handicap entries when available", () => {
      const entries = getOddsEntries(allOdds, "handicap");
      expect(entries.entry1?.market_id).toBe(6);
      expect(entries.entry3?.market_id).toBe(6);
      expect(entries.entry2).toBeUndefined();
      expect(entries.displayLabel2).toBe("HC");
    });

    it("falls back to 1X2 entries when no handicap data", () => {
      const entries = getOddsEntries(mock1X2Odds, "handicap");
      expect(entries.entry1?.market_id).toBe(1);
      expect(entries.displayLabel1).toBe("Home");
      expect(entries.displayLabel2).toBe("Draw");
    });
  });

  describe('filter="total"', () => {
    it("returns total entries when available", () => {
      const entries = getOddsEntries(allOdds, "total");
      expect(entries.entry1?.label).toBe("Over");
      expect(entries.entry3?.label).toBe("Under");
      expect(entries.entry2).toBeUndefined();
      expect(entries.displayLabel1).toBe("Over");
      expect(entries.displayLabel2).toBe("O/U");
      expect(entries.displayLabel3).toBe("Under");
    });

    it("falls back to 1X2 entries when no total data", () => {
      const entries = getOddsEntries(mock1X2Odds, "total");
      expect(entries.entry1?.market_id).toBe(1);
      expect(entries.displayLabel1).toBe("Home");
    });
  });

  it("returns undefined entries for empty odds", () => {
    const entries = getOddsEntries([], "winner");
    expect(entries.entry1).toBeUndefined();
    expect(entries.entry2).toBeUndefined();
    expect(entries.entry3).toBeUndefined();
  });
});

// ─── getAllOddsDisplay ────────────────────────────────────────────────────

describe("getAllOddsDisplay", () => {
  it("returns correct display values and entries for all three markets", () => {
    const result = getAllOddsDisplay(allOdds);

    // Winner (1X2)
    expect(result.winner.display.col1).toBe("2.10");
    expect(result.winner.display.col2).toBe("3.25");
    expect(result.winner.display.col3).toBe("3.50");
    expect(result.winner.display.header1).toBe("1");
    expect(result.winner.display.header2).toBe("X");
    expect(result.winner.display.header3).toBe("2");
    expect(result.winner.entries.entry1?.market_id).toBe(1);
    expect(result.winner.entries.entry2?.market_id).toBe(1);
    expect(result.winner.entries.entry3?.market_id).toBe(1);

    // Handicap (HC)
    expect(result.handicap.display.col1).toBe("1.85");
    expect(result.handicap.display.col2).toBe("-0.5");
    expect(result.handicap.display.col3).toBe("2.05");
    expect(result.handicap.display.header2).toBe("HC");
    expect(result.handicap.entries.entry1?.market_id).toBe(6);
    expect(result.handicap.entries.entry3?.market_id).toBe(6);

    // Total (O/U)
    expect(result.total.display.col1).toBe("1.90");
    expect(result.total.display.col2).toBe("2.5");
    expect(result.total.display.col3).toBe("1.95");
    expect(result.total.display.header2).toBe("O/U");
    expect(result.total.entries.entry1?.label).toBe("Over");
    expect(result.total.entries.entry3?.label).toBe("Under");
  });

  it('shows "—" for handicap display when HC data is missing', () => {
    const result = getAllOddsDisplay(mock1X2Odds);

    // Winner should still work
    expect(result.winner.display.col1).toBe("2.10");

    // Handicap display all "—"
    expect(result.handicap.display.col1).toBe("—");
    expect(result.handicap.display.col2).toBe("—");
    expect(result.handicap.display.col3).toBe("—");
    // Handicap entries 独立构造，不 fallback 到 1X2
    expect(result.handicap.entries.entry1).toBeUndefined();
    expect(result.handicap.entries.entry3).toBeUndefined();
  });

  it('shows "—" for total display when Total data is missing', () => {
    const result = getAllOddsDisplay(mock1X2Odds);

    // Winner should still work
    expect(result.winner.display.col1).toBe("2.10");

    // Total display all "—"
    expect(result.total.display.col1).toBe("—");
    expect(result.total.display.col2).toBe("—");
    expect(result.total.display.col3).toBe("—");
    // Total entries 独立构造，不 fallback 到 1X2
    expect(result.total.entries.entry1).toBeUndefined();
    expect(result.total.entries.entry3).toBeUndefined();
  });

  it('shows "—" for all markets when all three are missing', () => {
    const onlyUnrelatedOdds: SportmonksOddsEntry[] = [
      {
        ...baseOddsEntry,
        id: 100,
        market_id: 99,
        label: "X",
        value: "5.00",
        market_description: "Other Market",
      },
    ];
    const result = getAllOddsDisplay(onlyUnrelatedOdds);

    expect(result.winner.display.col1).toBe("—");
    expect(result.winner.display.col2).toBe("—");
    expect(result.winner.display.col3).toBe("—");
    expect(result.handicap.display.col1).toBe("—");
    expect(result.handicap.display.col2).toBe("—");
    expect(result.handicap.display.col3).toBe("—");
    expect(result.total.display.col1).toBe("—");
    expect(result.total.display.col2).toBe("—");
    expect(result.total.display.col3).toBe("—");
  });

  it('shows "—" for all markets when odds array is empty', () => {
    const result = getAllOddsDisplay([]);

    expect(result.winner.display.col1).toBe("—");
    expect(result.winner.display.col2).toBe("—");
    expect(result.winner.display.col3).toBe("—");
    expect(result.handicap.display.col1).toBe("—");
    expect(result.handicap.display.col2).toBe("—");
    expect(result.handicap.display.col3).toBe("—");
    expect(result.total.display.col1).toBe("—");
    expect(result.total.display.col2).toBe("—");
    expect(result.total.display.col3).toBe("—");

    expect(result.winner.entries.entry1).toBeUndefined();
    expect(result.handicap.entries.entry1).toBeUndefined();
    expect(result.total.entries.entry1).toBeUndefined();
  });
});
