// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBetSlipPanel } from "./useBetSlipPanel";
import { useBetSlipStore } from "@/stores/betSlipStore";
import type { BetSelection } from "@/types/betting";

function makeSel(overrides: Partial<BetSelection> = {}): BetSelection {
  return {
    id: "sel-1",
    oddId: 999,
    fixtureId: 100,
    fixtureName: "Team A vs Team B",
    leagueName: "Premier League",
    marketType: "1x2",
    marketDescription: "Fulltime Result",
    selection: "Home",
    displayLabel: "Team A",
    odds: "2.10",
    ...overrides,
  };
}

describe("useBetSlipPanel", () => {
  beforeEach(() => {
    useBetSlipStore.getState().clearAll();
    // activeTab 不在 clearAll 范围内，显式复位避免跨用例泄漏
    useBetSlipStore.getState().setActiveTab("betslip");
  });

  it("selectionCount=0 时 isOpen=false（无 selection 不挂面板）", () => {
    const { result } = renderHook(() => useBetSlipPanel());
    expect(result.current.isOpen).toBe(false);
  });

  it("有 selection 后 isOpen=true（默认 open）", () => {
    const { result } = renderHook(() => useBetSlipPanel());
    act(() => {
      useBetSlipStore.getState().addSelection(makeSel());
    });
    expect(result.current.isOpen).toBe(true);
  });

  it("close() 后 isOpen=false（保留 selection 但隐藏面板）", () => {
    const { result } = renderHook(() => useBetSlipPanel());
    act(() => {
      useBetSlipStore.getState().addSelection(makeSel());
    });
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
    expect(useBetSlipStore.getState().selections).toHaveLength(1);
  });

  it("close 后 open() 重开面板", () => {
    const { result } = renderHook(() => useBetSlipPanel());
    act(() => {
      useBetSlipStore.getState().addSelection(makeSel());
    });
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it("count 归 0 时自动重置 open=true（下次有 selection 立即显示）", () => {
    const { result } = renderHook(() => useBetSlipPanel());
    act(() => {
      useBetSlipStore.getState().addSelection(makeSel({ id: "a" }));
    });
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
    act(() => {
      useBetSlipStore.getState().clearAll();
    });
    act(() => {
      useBetSlipStore.getState().addSelection(makeSel({ id: "b" }));
    });
    expect(result.current.isOpen).toBe(true);
  });

  it("activeTab=mybets 且 count=0 时 isOpen=true（下注成功后保持面板展示注单）", () => {
    const { result } = renderHook(() => useBetSlipPanel());
    // 模拟下注成功：所有 leg 被移除（count=0）+ 切到 mybets tab
    act(() => {
      useBetSlipStore.getState().setActiveTab("mybets");
    });
    expect(useBetSlipStore.getState().selections).toHaveLength(0);
    expect(result.current.isOpen).toBe(true);
  });

  it("mybets tab 下 close() 仍可隐藏面板", () => {
    const { result } = renderHook(() => useBetSlipPanel());
    act(() => {
      useBetSlipStore.getState().setActiveTab("mybets");
    });
    expect(result.current.isOpen).toBe(true);
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("close 后再 addSelection（幂等同 id）— 仍隐藏，需显式 open()", () => {
    const { result } = renderHook(() => useBetSlipPanel());
    const sel = makeSel();
    act(() => {
      useBetSlipStore.getState().addSelection(sel);
    });
    act(() => {
      result.current.close();
    });
    // 模拟用户 X 后再点同一 Bet：addSelection 幂等不会变 count
    act(() => {
      useBetSlipStore.getState().addSelection(sel);
    });
    expect(result.current.isOpen).toBe(false);
    // 详情页 handleBet 显式 open() 解决（见 BannerDetailView.handleBet）
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
  });
});
