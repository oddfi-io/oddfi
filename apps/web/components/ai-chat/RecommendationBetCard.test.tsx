// @vitest-environment jsdom
/**
 * DD-122 — RecommendationBetCard V2 展示 + 点击接线测试。
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { RecommendationBetCard } from "./RecommendationBetCard";
import type { SportmonksFixture } from "@/types/api";
import type { BetSelection } from "@/types/betting";

const { runBetClickMock, setAmountMock } = vi.hoisted(() => ({
  runBetClickMock: vi.fn(),
  setAmountMock: vi.fn(),
}));

vi.mock("@/hooks/useBetSelectionToggle", () => ({ runBetClick: runBetClickMock }));
vi.mock("@/components/ui/SportIcon", () => ({ default: () => null }));
vi.mock("@/components/ui/NumberInput", () => ({
  default: ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
    <input
      data-testid="stake-input"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  ),
}));

// 关键 token 走 i18n key 字面量（"draw" → "draw"、"win" → "win"）
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, args?: Record<string, string | number>) => {
    if (args && "line" in args) return `${key} ${args.line}`;
    return key;
  },
}));

// 简化版 useCurrencyDisplay：默认 ODD 模式（canConvert=false），convert 直通
vi.mock("@/hooks/useCurrencyDisplay", () => ({
  useCurrencyDisplay: () => ({
    canConvert: false,
    rate: null,
    convert: (v: string) => v,
  }),
}));

// 受控选中态：默认未选中
let isSelectedState = false;
vi.mock("@/stores/betSlipStore", () => ({
  useBetSlipStore: (
    selector?: (s: { selections: { id: string }[]; setAmount: typeof setAmountMock }) => unknown
  ) => {
    const state = {
      selections: isSelectedState ? [{ id: "100-1-Home" }] : [],
      setAmount: setAmountMock,
    };
    return selector ? selector(state) : state;
  },
  selectIsSelected: (id: string) => (s: { selections: { id: string }[] }) =>
    s.selections.some((x) => x.id === id),
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
    odds: [],
    ...overrides,
  };
}

const homeSel: BetSelection = {
  id: "100-1-Home",
  oddId: 555,
  fixtureId: 100,
  fixtureName: "Arsenal vs Chelsea",
  leagueName: "Premier League",
  marketType: "1x2",
  marketDescription: "Fulltime Result",
  selection: "Home",
  displayLabel: "Arsenal",
  odds: "1.50",
};

beforeEach(() => {
  runBetClickMock.mockClear();
  setAmountMock.mockClear();
  isSelectedState = false;
});

describe("RecommendationBetCard V2", () => {
  it("1X2 主胜 → 显示『队名 win』后缀（业界 betslip 文案约定）", () => {
    render(<RecommendationBetCard fixture={makeFx()} selection={homeSel} />);
    // 队伍头展示纯队名 + 玩法行展示「Arsenal win」
    expect(screen.getByText("Arsenal win")).toBeTruthy();
    expect(screen.getByText("Chelsea")).toBeTruthy();
    expect(screen.getByText("x1.50")).toBeTruthy();
    // 默认推荐金额 100 ODD
    expect(screen.getByText(/100 ODD/)).toBeTruthy();
    // 预计收益 = 100 * 1.50 = 150 ODD
    expect(screen.getByText(/150 ODD/)).toBeTruthy();
  });

  it("点击下注 → runBetClick 调用 'add' 模式 + setAmount 写入用户金额", () => {
    render(<RecommendationBetCard fixture={makeFx({ enable_bet: true })} selection={homeSel} />);
    const btn = screen.getByRole("button", { name: /下注/ });
    fireEvent.click(btn);
    expect(runBetClickMock).toHaveBeenCalledTimes(1);
    const args = runBetClickMock.mock.calls[0];
    expect(args[1]).toBe(homeSel);
    expect(args[2]).toBe("add");
    expect(args[3]).toBe(true);
    // setAmount 用默认 100 ODD（canConvert=false 直通）
    expect(setAmountMock).toHaveBeenCalledWith("100-1-Home", "100");
  });

  it("已选中态：aria-pressed=true", () => {
    isSelectedState = true;
    render(<RecommendationBetCard fixture={makeFx()} selection={homeSel} />);
    const btn = screen.getByRole("button", { name: /下注/ });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("enable_bet=false → 传给 runBetClick", () => {
    render(<RecommendationBetCard fixture={makeFx({ enable_bet: false })} selection={homeSel} />);
    fireEvent.click(screen.getByRole("button", { name: /下注/ }));
    expect(runBetClickMock.mock.calls[0][3]).toBe(false);
  });

  it("enable_bet 缺省 → 默认 true", () => {
    render(<RecommendationBetCard fixture={makeFx()} selection={homeSel} />);
    fireEvent.click(screen.getByRole("button", { name: /下注/ }));
    expect(runBetClickMock.mock.calls[0][3]).toBe(true);
  });

  it("selection=null → 队名仍展示 + CTA『赔率待开』disabled", () => {
    render(<RecommendationBetCard fixture={makeFx()} selection={null} />);
    expect(screen.getByText("Arsenal")).toBeTruthy();
    expect(screen.getByText("Chelsea")).toBeTruthy();
    const btn = screen.getByRole("button", { name: "赔率待开" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn);
    expect(runBetClickMock).not.toHaveBeenCalled();
  });

  it("推荐平局 → 展示 i18n draw 而非 raw displayLabel", () => {
    const drawSel: BetSelection = {
      ...homeSel,
      id: "100-1-Draw",
      selection: "Draw",
      displayLabel: "Draw",
      odds: "3.20",
    };
    render(<RecommendationBetCard fixture={makeFx()} selection={drawSel} />);
    expect(screen.getByText("draw")).toBeTruthy();
    // 预计收益 = 100 * 3.20 = 320
    expect(screen.getByText(/320 ODD/)).toBeTruthy();
  });

  it("点击推荐金额 → 切换 NumberInput；改值后预计收益跟随刷新", () => {
    render(<RecommendationBetCard fixture={makeFx()} selection={homeSel} />);
    fireEvent.click(screen.getByText(/100 ODD/));
    const input = screen.getByTestId("stake-input");
    fireEvent.change(input, { target: { value: "500" } });
    // 500 * 1.50 = 750
    expect(screen.getByText(/750 ODD/)).toBeTruthy();
  });
});
