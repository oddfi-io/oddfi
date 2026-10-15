import { describe, it, expect, beforeEach } from "vitest";
import { useBetSlipStore } from "./betSlipStore";
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

describe("betSlipStore", () => {
  beforeEach(() => {
    useBetSlipStore.setState({
      selections: [],
      amounts: {},
      multiAmount: "",
      mode: "single",
      isOpen: false,
      isSettingsOpen: false,
      settings: { oddsAcceptance: "any" },
    });
  });

  describe("addSelection / removeSelection / toggleSelection", () => {
    it("adds a selection and opens the slip", () => {
      const sel = makeSel();
      useBetSlipStore.getState().addSelection(sel);

      const s = useBetSlipStore.getState();
      expect(s.selections).toHaveLength(1);
      expect(s.selections[0].id).toBe("sel-1");
      expect(s.isOpen).toBe(true);
    });

    it("does not add duplicate selection", () => {
      const sel = makeSel();
      useBetSlipStore.getState().addSelection(sel);
      useBetSlipStore.getState().addSelection(sel);

      expect(useBetSlipStore.getState().selections).toHaveLength(1);
    });

    it("removes a selection and cleans up amounts", () => {
      const sel = makeSel();
      useBetSlipStore.getState().addSelection(sel);
      useBetSlipStore.getState().setAmount("sel-1", "100");
      useBetSlipStore.getState().removeSelection("sel-1");

      const s = useBetSlipStore.getState();
      expect(s.selections).toHaveLength(0);
      expect(s.amounts["sel-1"]).toBeUndefined();
      expect(s.isOpen).toBe(false);
    });

    it("removeSelection preserves isOpen=false when other selections remain", () => {
      // User adds 2 selections (isOpen=true), then dismisses BetSlip
      useBetSlipStore.getState().addSelection(makeSel({ id: "a", fixtureId: 1 }));
      useBetSlipStore.getState().addSelection(makeSel({ id: "b", fixtureId: 2 }));
      useBetSlipStore.getState().setOpen(false); // user dismisses
      expect(useBetSlipStore.getState().isOpen).toBe(false);

      // Removing one of the selections should NOT reopen
      useBetSlipStore.getState().removeSelection("a");
      expect(useBetSlipStore.getState().selections).toHaveLength(1);
      expect(useBetSlipStore.getState().isOpen).toBe(false);
    });

    it("removeSelection closes when last selection is removed", () => {
      useBetSlipStore.getState().addSelection(makeSel());
      useBetSlipStore.getState().setOpen(false); // user dismisses
      useBetSlipStore.getState().removeSelection("sel-1");
      expect(useBetSlipStore.getState().isOpen).toBe(false);
    });

    it("toggleSelection adds when absent, removes when present", () => {
      const sel = makeSel();
      useBetSlipStore.getState().toggleSelection(sel);
      expect(useBetSlipStore.getState().selections).toHaveLength(1);

      useBetSlipStore.getState().toggleSelection(sel);
      expect(useBetSlipStore.getState().selections).toHaveLength(0);
    });
  });

  describe("clearAll", () => {
    it("resets selections, amounts, multiAmount but keeps betslip open", () => {
      useBetSlipStore.getState().setOpen(true);
      useBetSlipStore.getState().addSelection(makeSel());
      useBetSlipStore.getState().setAmount("sel-1", "50");
      useBetSlipStore.getState().setMultiAmount("200");
      useBetSlipStore.getState().clearAll();

      const s = useBetSlipStore.getState();
      expect(s.selections).toEqual([]);
      expect(s.amounts).toEqual({});
      expect(s.multiAmount).toBe("");
      expect(s.isOpen).toBe(true);
    });
  });

  describe("totalOdds (multi mode)", () => {
    it("multiplies all odds using decimal.ts", () => {
      useBetSlipStore.getState().addSelection(makeSel({ id: "a", odds: "2.00", fixtureId: 1 }));
      useBetSlipStore.getState().addSelection(makeSel({ id: "b", odds: "3.00", fixtureId: 2 }));

      expect(useBetSlipStore.getState().totalOdds()).toBe("6");
    });

    it('returns "0" for empty selections', () => {
      expect(useBetSlipStore.getState().totalOdds()).toBe("0");
    });
  });

  describe("totalBet", () => {
    it("sums individual amounts in single mode", () => {
      useBetSlipStore.getState().addSelection(makeSel({ id: "a", fixtureId: 1 }));
      useBetSlipStore.getState().addSelection(makeSel({ id: "b", fixtureId: 2 }));
      useBetSlipStore.getState().setAmount("a", "100");
      useBetSlipStore.getState().setAmount("b", "50");

      expect(useBetSlipStore.getState().totalBet()).toBe("150");
    });

    it("returns multiAmount in multi mode", () => {
      useBetSlipStore.getState().setMode("multi");
      useBetSlipStore.getState().setMultiAmount("300");

      expect(useBetSlipStore.getState().totalBet()).toBe("300");
    });
  });

  describe("potentialWin", () => {
    it("calculates per-selection payout in single mode", () => {
      useBetSlipStore.getState().addSelection(makeSel({ id: "a", odds: "2.00", fixtureId: 1 }));
      useBetSlipStore.getState().setAmount("a", "100");

      // 100 * 2.00 = 200
      expect(useBetSlipStore.getState().potentialWin()).toBe("200");
    });

    it("calculates totalOdds × multiAmount in multi mode", () => {
      useBetSlipStore.getState().setMode("multi");
      useBetSlipStore.getState().addSelection(makeSel({ id: "a", odds: "2.00", fixtureId: 1 }));
      useBetSlipStore.getState().addSelection(makeSel({ id: "b", odds: "3.00", fixtureId: 2 }));
      useBetSlipStore.getState().setMultiAmount("100");

      // 2.00 * 3.00 = 6.00, 100 * 6 = 600
      expect(useBetSlipStore.getState().potentialWin()).toBe("600");
    });
  });

  describe("hasConflict", () => {
    it("returns false when all selections from different fixtures", () => {
      useBetSlipStore.getState().addSelection(makeSel({ id: "a", fixtureId: 1 }));
      useBetSlipStore.getState().addSelection(makeSel({ id: "b", fixtureId: 2 }));

      expect(useBetSlipStore.getState().hasConflict()).toBe(false);
    });

    it("returns true when two selections from same fixture", () => {
      useBetSlipStore
        .getState()
        .addSelection(makeSel({ id: "a", fixtureId: 100, selection: "Home" }));
      useBetSlipStore
        .getState()
        .addSelection(makeSel({ id: "b", fixtureId: 100, selection: "Over" }));

      expect(useBetSlipStore.getState().hasConflict()).toBe(true);
    });
  });

  describe("settings", () => {
    it("updates settings with partial merge", () => {
      useBetSlipStore.getState().updateSettings({ oddsAcceptance: "higher_only" });

      const s = useBetSlipStore.getState().settings;
      expect(s.oddsAcceptance).toBe("higher_only");
    });
  });

  describe("enableBet guard (DD-087 §4.1)", () => {
    it("addSelection with enableBet=true adds normally", () => {
      const sel = makeSel();
      useBetSlipStore.getState().addSelection(sel, true);

      expect(useBetSlipStore.getState().selections).toHaveLength(1);
    });

    it("addSelection with enableBet=false is rejected, selection not added", () => {
      const sel = makeSel();
      useBetSlipStore.getState().addSelection(sel, false);

      expect(useBetSlipStore.getState().selections).toHaveLength(0);
    });

    it("addSelection default (no enableBet arg) adds normally", () => {
      const sel = makeSel();
      useBetSlipStore.getState().addSelection(sel);

      expect(useBetSlipStore.getState().selections).toHaveLength(1);
    });

    it("toggleSelection with enableBet=false does not add selection", () => {
      const sel = makeSel();
      useBetSlipStore.getState().toggleSelection(sel, false);

      expect(useBetSlipStore.getState().selections).toHaveLength(0);
    });

    it("toggleSelection with enableBet=false allows removing an existing selection", () => {
      // 先正常添加
      useBetSlipStore.getState().addSelection(makeSel(), true);
      expect(useBetSlipStore.getState().selections).toHaveLength(1);

      // 再用 enableBet=false 触发 toggle（已存在 → 移除路径，不走 addSelection）
      useBetSlipStore.getState().toggleSelection(makeSel(), false);
      expect(useBetSlipStore.getState().selections).toHaveLength(0);
    });
  });

  describe("betAlert (DD-119 P2)", () => {
    it("setBetAlert stores the alert payload", () => {
      useBetSlipStore.getState().setBetAlert({ variant: "err", message: "Network error" });
      expect(useBetSlipStore.getState().betAlert).toEqual({
        variant: "err",
        message: "Network error",
      });
    });

    it("setBetAlert(null) clears the alert", () => {
      useBetSlipStore.getState().setBetAlert({ variant: "warn", message: "Congested" });
      useBetSlipStore.getState().setBetAlert(null);
      expect(useBetSlipStore.getState().betAlert).toBeNull();
    });

    it("clearAll resets betAlert to null", () => {
      useBetSlipStore.getState().setBetAlert({ variant: "err", message: "Network error" });
      useBetSlipStore.getState().clearAll();
      expect(useBetSlipStore.getState().betAlert).toBeNull();
    });
  });

  describe("partialFill (DD-119 P2)", () => {
    const info = { accepted: "8,000.00", origin: "10,000.00", remain: "2,000.00" };

    it("setPartialFill stores per-selection info; null clears", () => {
      useBetSlipStore.getState().setPartialFill("sel-1", info);
      expect(useBetSlipStore.getState().partialFillById["sel-1"]).toEqual(info);
      useBetSlipStore.getState().setPartialFill("sel-1", null);
      expect(useBetSlipStore.getState().partialFillById["sel-1"]).toBeUndefined();
    });

    it("setAmount clears stale partialFill for that selection (用户改金额)", () => {
      useBetSlipStore.getState().setPartialFill("sel-1", info);
      useBetSlipStore.getState().setAmount("sel-1", "500");
      expect(useBetSlipStore.getState().partialFillById["sel-1"]).toBeUndefined();
      expect(useBetSlipStore.getState().amounts["sel-1"]).toBe("500");
    });

    it("回填顺序 setAmount→setPartialFill 时 partial 文案存活", () => {
      // BetSummary 部分成交回填的实际顺序
      useBetSlipStore.getState().setAmount("sel-1", "2000");
      useBetSlipStore.getState().setPartialFill("sel-1", info);
      expect(useBetSlipStore.getState().partialFillById["sel-1"]).toEqual(info);
    });

    it("removeSelection + clearAll 清除 partialFill", () => {
      useBetSlipStore.getState().addSelection(makeSel({ id: "sel-1" }), true);
      useBetSlipStore.getState().setPartialFill("sel-1", info);
      useBetSlipStore.getState().removeSelection("sel-1");
      expect(useBetSlipStore.getState().partialFillById["sel-1"]).toBeUndefined();

      useBetSlipStore.getState().setPartialFill("sel-2", info);
      useBetSlipStore.getState().clearAll();
      expect(useBetSlipStore.getState().partialFillById).toEqual({});
    });
  });
});
