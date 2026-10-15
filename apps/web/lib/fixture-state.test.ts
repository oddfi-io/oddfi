import { describe, it, expect } from "vitest";
import {
  getFixtureStatus,
  getStatePeriodKey,
  LIVE_STATE_IDS,
  UPCOMING_STATE_IDS,
  FINISHED_STATE_IDS,
  TERMINAL_STATE_IDS,
  ANOMALY_STATE_IDS,
} from "./fixture-state";
import { MONEYLINE_LIVE_STATES } from "@/types/moneyline";

describe("getFixtureStatus", () => {
  it("classifies live states correctly", () => {
    for (const id of LIVE_STATE_IDS) {
      expect(getFixtureStatus(id)).toBe("live");
    }
  });

  it("classifies upcoming states correctly", () => {
    for (const id of UPCOMING_STATE_IDS) {
      expect(getFixtureStatus(id)).toBe("upcoming");
    }
  });

  it("classifies finished states correctly", () => {
    for (const id of FINISHED_STATE_IDS) {
      expect(getFixtureStatus(id)).toBe("finished");
    }
  });

  it("treats unknown state_id as finished", () => {
    expect(getFixtureStatus(99)).toBe("finished");
    expect(getFixtureStatus(0)).toBe("finished");
    expect(getFixtureStatus(-1)).toBe("finished");
  });
});

describe("state_id sets are disjoint", () => {
  it("no overlap between live and upcoming", () => {
    for (const id of LIVE_STATE_IDS) {
      expect(UPCOMING_STATE_IDS.has(id)).toBe(false);
    }
  });

  it("no overlap between live and finished", () => {
    for (const id of LIVE_STATE_IDS) {
      expect(FINISHED_STATE_IDS.has(id)).toBe(false);
    }
  });

  it("no overlap between upcoming and finished", () => {
    for (const id of UPCOMING_STATE_IDS) {
      expect(FINISHED_STATE_IDS.has(id)).toBe(false);
    }
  });

  it("FINISHED = TERMINAL ∪ ANOMALY，且 TERMINAL/ANOMALY 互斥", () => {
    for (const id of TERMINAL_STATE_IDS) expect(FINISHED_STATE_IDS.has(id)).toBe(true);
    for (const id of ANOMALY_STATE_IDS) expect(FINISHED_STATE_IDS.has(id)).toBe(true);
    for (const id of TERMINAL_STATE_IDS) expect(ANOMALY_STATE_IDS.has(id)).toBe(false);
    expect(FINISHED_STATE_IDS.size).toBe(TERMINAL_STATE_IDS.size + ANOMALY_STATE_IDS.size);
  });
});

// ─── BUG-029 回归钉子：对齐 SportMonks v3 / 后端 moneyline_lifecycle.go ───────

describe("BUG-029 · state_id 分类对齐后端权威口径", () => {
  it("下半场/break/加时/点球进 live（致命路径：22 曾被误判 finished 整场消失）", () => {
    expect(getFixtureStatus(22)).toBe("live"); // 2nd Half
    expect(getFixtureStatus(4)).toBe("live"); // Break（非 finished）
    expect(getFixtureStatus(21)).toBe("live"); // Extra Time Break
    expect(getFixtureStatus(23)).toBe("live"); // 后端归 LIVE
    expect(getFixtureStatus(25)).toBe("live"); // Penalties Break
  });

  it("终结态归 finished", () => {
    expect(getFixtureStatus(5)).toBe("finished"); // Full-Time
    expect(getFixtureStatus(20)).toBe("finished"); // Deleted（v3，非旧表的 22）
  });

  it("未开赛态归 upcoming（含 v3 新增 26 Pending）", () => {
    expect(getFixtureStatus(1)).toBe("upcoming");
    expect(getFixtureStatus(26)).toBe("upcoming");
  });

  it("ANOMALY {10,11,16,18,19} 全部归 finished（用户决策：丢弃）", () => {
    for (const id of [10, 11, 16, 18, 19]) {
      expect(getFixtureStatus(id)).toBe("finished");
    }
  });

  it("旧 v2 残留号已纠偏（17=Awarded→finished、13=TBA→upcoming）", () => {
    expect(getFixtureStatus(17)).toBe("finished"); // 旧表误含 upcoming
    expect(getFixtureStatus(13)).toBe("upcoming");
  });
});

describe("getStatePeriodKey · v3 周期文案重映射", () => {
  it("LIVE 态映射正确（22=下半场，4/21/25=break）", () => {
    expect(getStatePeriodKey(2)).toBe("period1H");
    expect(getStatePeriodKey(22)).toBe("period2H"); // 旧表 4 才是 period2H，已纠
    expect(getStatePeriodKey(3)).toBe("periodHT");
    expect(getStatePeriodKey(4)).toBe("periodBRK");
    expect(getStatePeriodKey(6)).toBe("periodET");
    expect(getStatePeriodKey(9)).toBe("periodPEN");
    expect(getStatePeriodKey(21)).toBe("periodBRK");
    expect(getStatePeriodKey(25)).toBe("periodBRK");
  });

  it("非 labelled 态返回 null（finished/upcoming/23/unknown）", () => {
    expect(getStatePeriodKey(5)).toBeNull(); // finished
    expect(getStatePeriodKey(1)).toBeNull(); // upcoming
    expect(getStatePeriodKey(23)).toBeNull(); // 未知 live 态不给 label
    expect(getStatePeriodKey(99)).toBeNull();
  });
});

describe("两张 LIVE 表收敛为单一源", () => {
  it("MONEYLINE_LIVE_STATES 引用相等于 LIVE_STATE_IDS（同一对象，杜绝漂移）", () => {
    expect(MONEYLINE_LIVE_STATES).toBe(LIVE_STATE_IDS);
  });
});
