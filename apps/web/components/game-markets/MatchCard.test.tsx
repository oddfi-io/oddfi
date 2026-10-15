// @vitest-environment jsdom
/**
 * DD-120 Batch 1 — MatchCard AI badge 抑制测试。
 * 推荐下注卡片只覆盖真实赛事；测试比赛（isTestFixtureId / mock_activity）不暴露 AI 分析入口。
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MatchCard from "./MatchCard";
import type { SportmonksFixture } from "@/types/api";

// next-intl 无 provider → key 直出
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
// SportIcon 走 next/image，测试环境用 stub 规避
vi.mock("@/components/ui/SportIcon", () => ({
  default: () => null,
}));
vi.mock("./TripleOddsGrid", () => ({ default: () => null }));
const openChatWithIntent = vi.fn();
vi.mock("@/hooks/useChatOpener", () => ({
  useChatOpener: () => ({ openChat: vi.fn(), openChatWithIntent }),
}));
vi.mock("@/lib/dev-toggles", () => ({ useForceDisableBet: () => false }));
// DD-118/119：MatchCard 用 useOnchainMarketsByFixture(useQuery) → mock 规避 QueryClient（本测试只关心 AI badge）
vi.mock("@/hooks/useOnchainMarketBySelection", () => ({
  useOnchainMarketsByFixture: () => ({ markets: [] }),
  selectOnchainMarketForEntry: () => ({ marketId: null, outcomeIndex: null }),
}));

function makeFx(overrides: Partial<SportmonksFixture> = {}): SportmonksFixture {
  return {
    id: 100,
    league_id: 8,
    stage_id: 0,
    name: "Arsenal vs Chelsea",
    starting_at: "2026-06-12 19:00:00",
    starting_at_timestamp: 1781622000,
    state_id: 1,
    has_odds: true,
    participants: [
      { id: 1, name: "Arsenal", image_path: "", meta: { location: "home" } },
      { id: 2, name: "Chelsea", image_path: "", meta: { location: "away" } },
    ],
    odds: [],
    ...overrides,
  } as SportmonksFixture;
}

describe("MatchCard — AI badge 抑制（DD-120）", () => {
  it("普通比赛 → 渲染 AI badge", () => {
    render(<MatchCard fixture={makeFx()} locale="en" />);
    expect(screen.queryByLabelText(/AI 分析/)).not.toBeNull();
  });

  it("测试比赛（isTestFixtureId）→ 不渲染 AI badge", () => {
    render(<MatchCard fixture={makeFx({ id: 99200001 })} locale="en" />);
    expect(screen.queryByLabelText(/AI 分析/)).toBeNull();
  });

  it("mock_activity 比赛 → 不渲染 AI badge", () => {
    const mockActivity = {
      activity_id: "act-1",
      period_sec: 600,
      bet_close_sec: 540,
      settle_at_sec: 660,
      phase: "betting",
      remaining_sec: 120,
      bet_close_at: "2026-06-12 19:09:00",
      settle_at: "2026-06-12 19:11:00",
    };
    render(<MatchCard fixture={makeFx({ mock_activity: mockActivity })} locale="en" />);
    expect(screen.queryByLabelText(/AI 分析/)).toBeNull();
  });
});

describe("MatchCard — 链上测试赛事标签（DD-138）", () => {
  const onchainMockActivity = {
    activity_id: "ONCHAIN_MOCK_10MIN",
    period_sec: 600,
    bet_close_sec: 600,
    settle_at_sec: 601,
    phase: "open",
    remaining_sec: 450,
    bet_close_at: "2026-06-07 09:00:00",
    settle_at: "2026-06-07 09:00:01",
  };

  it("链上测试赛事 → 同时渲染 TEST（既有 mock_activity 标签）与链上标签", () => {
    render(
      <MatchCard
        fixture={makeFx({ id: 993011780822200, mock_activity: onchainMockActivity })}
        locale="en"
      />
    );
    expect(screen.queryByText("TEST")).not.toBeNull();
    // next-intl mock key 直出 → 标签文案为 key 名
    expect(screen.queryByText("onchainTag")).not.toBeNull();
  });

  it("旧演示赛事（99200001 + mock_activity）→ 只有 TEST，无链上标签", () => {
    render(
      <MatchCard
        fixture={makeFx({ id: 99200001, mock_activity: onchainMockActivity })}
        locale="en"
      />
    );
    expect(screen.queryByText("TEST")).not.toBeNull();
    expect(screen.queryByText("onchainTag")).toBeNull();
  });

  it("普通比赛 → 两个标签都不渲染", () => {
    render(<MatchCard fixture={makeFx()} locale="en" />);
    expect(screen.queryByText("TEST")).toBeNull();
    expect(screen.queryByText("onchainTag")).toBeNull();
  });
});
