// @vitest-environment jsdom
/**
 * useBetSelectionToggle / runBetClick — 共用 Bet 点击执行器测试
 *
 * 重点验证：
 *  - "toggle" 模式下重复点击 → 移除（markets 行为）
 *  - "add" 模式下重复点击 → 仅触发飞行动画，不移除（banner 行为）
 *  - 不同模式下都会读 store.selections 检测重复 + 调用对应 store action
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// 动画模块全部 mock 成 no-op，避免 DOM/getBoundingClientRect 依赖
vi.mock("@/lib/betslip-animations", () => ({
  flashOddsBtn: vi.fn(),
  isRapidAdd: vi.fn(() => false),
  shakeFab: vi.fn(),
  shrinkFab: vi.fn(),
  flyChipToFab: vi.fn(),
}));
vi.mock("@/lib/betslip-animations-pc", () => ({
  flashOddsBtn: vi.fn(),
  isPcRapidAdd: vi.fn(() => false),
  shakePanel: vi.fn(),
  flyChipToPanel: vi.fn(),
  scrollToNewest: vi.fn(),
}));

import { runBetClick } from "./useBetSelectionToggle";
import { useBetSlipStore } from "@/stores/betSlipStore";
import type { BetSelection } from "@/types/betting";

const SEL: BetSelection = {
  id: "1-1-Home",
  oddId: 1,
  fixtureId: 1,
  fixtureName: "A vs B",
  leagueName: "Test League",
  marketType: "1x2",
  marketDescription: "Fulltime Result",
  selection: "Home",
  displayLabel: "A",
  odds: "2.00",
};

function makeEvent(): React.MouseEvent {
  const btn = document.createElement("button");
  return {
    stopPropagation: vi.fn(),
    currentTarget: btn,
  } as unknown as React.MouseEvent;
}

describe("runBetClick", () => {
  beforeEach(() => {
    useBetSlipStore.setState({ selections: [], amounts: {} });
    // PC viewport — 避免 H5 分支
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
  });

  it("toggle 模式：未选 → 加入", () => {
    runBetClick(makeEvent(), SEL, "toggle");
    expect(useBetSlipStore.getState().selections).toHaveLength(1);
  });

  it("toggle 模式：已选 → 移除", () => {
    useBetSlipStore.getState().addSelection(SEL);
    expect(useBetSlipStore.getState().selections).toHaveLength(1);
    runBetClick(makeEvent(), SEL, "toggle");
    expect(useBetSlipStore.getState().selections).toHaveLength(0);
  });

  it("add 模式：已选再点 → 不移除（addSelection 幂等）", () => {
    useBetSlipStore.getState().addSelection(SEL);
    expect(useBetSlipStore.getState().selections).toHaveLength(1);
    runBetClick(makeEvent(), SEL, "add");
    expect(useBetSlipStore.getState().selections).toHaveLength(1);
  });

  it("e.stopPropagation 必调用（避免冒泡触发卡片点击）", () => {
    const e = makeEvent();
    runBetClick(e, SEL, "toggle");
    expect(e.stopPropagation).toHaveBeenCalled();
  });
});
