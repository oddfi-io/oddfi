// @vitest-environment jsdom
/**
 * DD-120 Batch 3b — ChatRecommendationCard 容器逻辑测试。
 * 验证：可派生 → 渲染卡；fixture 缺失 / 派生失败 → 静默不渲染。
 */
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

import { ChatRecommendationCard } from "./ChatRecommendationCard";
import type { SportmonksFixture, SportmonksOddsEntry } from "@/types/api";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const { getMarketFixtureDetailMock } = vi.hoisted(() => ({ getMarketFixtureDetailMock: vi.fn() }));
vi.mock("@/lib/api", () => ({ getMarketFixtureDetail: getMarketFixtureDetailMock }));

// 展示型卡用 sentinel 替身，只验容器是否渲染 + 传入的 selection
vi.mock("./RecommendationBetCard", () => ({
  RecommendationBetCard: ({ selection }: { selection: { selection: string } | null }) => (
    <div data-testid="rec-card">{selection ? selection.selection : "no-odds"}</div>
  ),
}));

function odd(
  label: string,
  value: string,
  overrides: Partial<SportmonksOddsEntry> = {}
): SportmonksOddsEntry {
  return {
    id: Math.floor(Math.random() * 1e6),
    fixture_id: 100,
    market_id: 1,
    bookmaker_id: 1,
    label,
    value,
    name: null,
    market_description: "Fulltime Result",
    probability: "",
    total: null,
    handicap: null,
    sort_order: 0,
    winning: false,
    stopped: false,
    ...overrides,
  };
}

function makeFx(
  odds: SportmonksOddsEntry[],
  overrides: Partial<SportmonksFixture> = {}
): SportmonksFixture {
  return {
    id: 100,
    league_id: 8,
    stage_id: 0,
    name: "Arsenal vs Chelsea",
    starting_at: "2026-06-12 19:00:00",
    starting_at_timestamp: 1781622000,
    state_id: 1,
    has_odds: odds.length > 0,
    league: { id: 8, name: "Premier League" },
    participants: [
      {
        id: 1,
        name: "Arsenal",
        short_code: "ARS",
        image_path: "",
        country_id: 0,
        type: "domestic",
        meta: { location: "home", winner: null, position: 1 },
      },
      {
        id: 2,
        name: "Chelsea",
        short_code: "CHE",
        image_path: "",
        country_id: 0,
        type: "domestic",
        meta: { location: "away", winner: null, position: 2 },
      },
    ],
    odds,
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => getMarketFixtureDetailMock.mockReset());

describe("ChatRecommendationCard", () => {
  it("可派生 → 渲染推荐卡（Home favorite）", async () => {
    getMarketFixtureDetailMock.mockResolvedValue([
      makeFx([odd("Home", "1.50"), odd("Draw", "4.00"), odd("Away", "6.00")]),
    ]);
    render(<ChatRecommendationCard matchId="100" />, { wrapper });
    expect(await screen.findByTestId("rec-card")).toBeTruthy();
    expect(screen.getByTestId("rec-card").textContent).toBe("Home");
  });

  it("fixture 列表为空 → 静默不渲染", async () => {
    getMarketFixtureDetailMock.mockResolvedValue([]);
    const { container } = render(<ChatRecommendationCard matchId="100" />, { wrapper });
    await waitFor(() => expect(getMarketFixtureDetailMock).toHaveBeenCalled());
    expect(screen.queryByTestId("rec-card")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("有 fixture 但无 1X2 odds → 渲染『赔率待开』占位卡（selection=null）", async () => {
    getMarketFixtureDetailMock.mockResolvedValue([makeFx([], { has_odds: false })]);
    render(<ChatRecommendationCard matchId="100" />, { wrapper });
    expect(await screen.findByTestId("rec-card")).toBeTruthy();
    expect(screen.getByTestId("rec-card").textContent).toBe("no-odds");
  });

  it("非法 matchId（NaN）→ query 不触发，不渲染", () => {
    render(<ChatRecommendationCard matchId="not-a-number" />, { wrapper });
    expect(getMarketFixtureDetailMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("rec-card")).toBeNull();
  });

  // ─── DD-136 W3：picks 多卡模式 ─────────────────────────────────────────────

  const FULL_ODDS = [
    odd("Home", "1.50"),
    odd("Draw", "4.00"),
    odd("Away", "6.00"),
    odd("Home", "1.95", { market_id: 6, handicap: "-0.5", market_description: "Asian Handicap" }),
    odd("Away", "1.85", { market_id: 6, handicap: "0.5", market_description: "Asian Handicap" }),
    odd("Over", "1.90", { market_id: 7, total: "2.5", market_description: "Asian Total" }),
    odd("Under", "1.88", { market_id: 7, total: "2.5", market_description: "Asian Total" }),
  ];

  it("DD-136: picks 三玩法 → 渲染 3 张卡，按置信度降序（仅排序不展示）+ reason 小标签 + 免责行", async () => {
    getMarketFixtureDetailMock.mockResolvedValue([makeFx(FULL_ODDS)]);
    const picks = [
      { market: "asian_total" as const, side: "Over", confidence: "low" as const },
      { market: "1x2" as const, side: "Away", confidence: "high" as const, reason: "客队状态佳" },
      { market: "asian_handicap" as const, side: "Home", confidence: "mid" as const },
    ];
    const { container } = render(<ChatRecommendationCard matchId="100" picks={picks} />, {
      wrapper,
    });
    await screen.findAllByTestId("rec-card");
    const cards = screen.getAllByTestId("rec-card");
    expect(cards).toHaveLength(3);
    // 置信度降序：1x2(high) → AH(mid) → total(low)
    const order = Array.from(container.querySelectorAll("[data-market]")).map((el) =>
      el.getAttribute("data-market")
    );
    expect(order).toEqual(["1x2", "asian_handicap", "asian_total"]);
    // 置信度不再展示（用户验收反馈），reason 做成统一色小标签（tagClasses("market")）
    expect(container.textContent).not.toContain("置信度");
    const reasonTag = Array.from(container.querySelectorAll("span")).find(
      (el) => el.textContent === "客队状态佳"
    );
    expect(reasonTag?.className).toContain("bg-white/[0.08]");
    expect(container.textContent).toContain("仅供参考");
  });

  it("DD-136: 某玩法无盘口 → 该卡为『赔率待开』占位（selection=null），其余正常", async () => {
    // 只有 1X2，无 AH/Total
    getMarketFixtureDetailMock.mockResolvedValue([
      makeFx([odd("Home", "1.50"), odd("Draw", "4.00"), odd("Away", "6.00")]),
    ]);
    const picks = [
      { market: "1x2" as const, side: "Home", confidence: "high" as const },
      { market: "asian_total" as const, side: "Over", confidence: "mid" as const },
    ];
    render(<ChatRecommendationCard matchId="100" picks={picks} />, { wrapper });
    await screen.findAllByTestId("rec-card");
    const cards = screen.getAllByTestId("rec-card");
    expect(cards).toHaveLength(2);
    expect(cards[0]!.textContent).toBe("Home");
    expect(cards[1]!.textContent).toBe("no-odds"); // 赔率待开占位
  });

  it("DD-136: picks 空数组 → 回落 DD-120 单卡模式", async () => {
    getMarketFixtureDetailMock.mockResolvedValue([
      makeFx([odd("Home", "1.50"), odd("Draw", "4.00"), odd("Away", "6.00")]),
    ]);
    render(<ChatRecommendationCard matchId="100" picks={[]} />, { wrapper });
    expect(await screen.findByTestId("rec-card")).toBeTruthy();
    expect(screen.getByTestId("rec-card").textContent).toBe("Home");
  });
});
