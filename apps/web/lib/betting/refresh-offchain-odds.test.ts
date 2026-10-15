import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { refreshOffchainOdds, type RefreshOffchainOddsDeps } from "./refresh-offchain-odds";
import type { BetSelection } from "@/types/betting";
import type { SportmonksFixture, SportmonksOddsEntry } from "@/types/api";

function mkEntry(id: number, value: string): SportmonksOddsEntry {
  return {
    id,
    fixture_id: 0,
    market_id: 1,
    bookmaker_id: 1,
    label: "Home",
    value,
    name: null,
    market_description: "Fulltime Result",
    probability: "50%",
    total: null,
    handicap: null,
    sort_order: 0,
    winning: false,
    stopped: false,
  };
}

function mkFixture(id: number, entries: SportmonksOddsEntry[]): SportmonksFixture {
  return { id, odds: entries } as SportmonksFixture;
}

function mkSel(overrides: Partial<BetSelection>): BetSelection {
  return {
    id: "sel-1",
    oddId: 1,
    fixtureId: 100,
    fixtureName: "A vs B",
    leagueName: "L",
    marketType: "1x2",
    selection: "Home",
    displayLabel: "A",
    odds: "2.00",
    ...overrides,
  } as BetSelection;
}

function mkDeps(impl: RefreshOffchainOddsDeps["getMarketFixtureDetail"]): RefreshOffchainOddsDeps {
  return { getMarketFixtureDetail: impl };
}

describe("refreshOffchainOdds", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("空输入直接返回空 Map，且不发请求", async () => {
    const spy = vi.fn();
    const res = await refreshOffchainOdds([], mkDeps(spy));
    expect(res.size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("用最新 entry.value 覆盖匹配 oddId 的快照", async () => {
    const sel = mkSel({ id: "sel-1", oddId: 7, fixtureId: 100, odds: "1.53" });
    const deps = mkDeps(
      vi.fn().mockResolvedValue([mkFixture(100, [mkEntry(7, "1.47"), mkEntry(8, "3.10")])])
    );
    const res = await refreshOffchainOdds([sel], deps);
    expect(res.get("sel-1")).toBe("1.47");
  });

  it("同一 fixture 的多腿只拉一次（去重）", async () => {
    const spy = vi
      .fn()
      .mockResolvedValue([mkFixture(100, [mkEntry(7, "1.47"), mkEntry(8, "3.10")])]);
    const sels = [
      mkSel({ id: "a", oddId: 7, fixtureId: 100 }),
      mkSel({ id: "b", oddId: 8, fixtureId: 100 }),
    ];
    const res = await refreshOffchainOdds(sels, mkDeps(spy));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(res.get("a")).toBe("1.47");
    expect(res.get("b")).toBe("3.10");
  });

  it("某 fixture 拉取失败 → 该腿不在结果中（调用方回退快照）", async () => {
    const spy = vi.fn().mockImplementation((fid: number) => {
      if (fid === 200) return Promise.reject(new Error("network"));
      return Promise.resolve([mkFixture(100, [mkEntry(7, "1.47")])]);
    });
    const sels = [
      mkSel({ id: "ok", oddId: 7, fixtureId: 100 }),
      mkSel({ id: "fail", oddId: 9, fixtureId: 200 }),
    ];
    const res = await refreshOffchainOdds(sels, mkDeps(spy));
    expect(res.get("ok")).toBe("1.47");
    expect(res.has("fail")).toBe(false);
  });

  it("oddId 在返回中找不到（已下架）→ 不写入", async () => {
    const sel = mkSel({ id: "gone", oddId: 999, fixtureId: 100 });
    const deps = mkDeps(vi.fn().mockResolvedValue([mkFixture(100, [mkEntry(7, "1.47")])]));
    const res = await refreshOffchainOdds([sel], deps);
    expect(res.has("gone")).toBe(false);
  });

  it("entry.value 为空字符串 → 视为无效，不写入", async () => {
    const sel = mkSel({ id: "empty", oddId: 7, fixtureId: 100 });
    const deps = mkDeps(vi.fn().mockResolvedValue([mkFixture(100, [mkEntry(7, "")])]));
    const res = await refreshOffchainOdds([sel], deps);
    expect(res.has("empty")).toBe(false);
  });

  it("多个不同 fixture 各自匹配", async () => {
    const spy = vi
      .fn()
      .mockImplementation((fid: number) =>
        Promise.resolve([mkFixture(fid, [mkEntry(fid + 1, fid === 100 ? "1.40" : "2.20")])])
      );
    const sels = [
      mkSel({ id: "x", oddId: 101, fixtureId: 100 }),
      mkSel({ id: "y", oddId: 301, fixtureId: 300 }),
    ];
    const res = await refreshOffchainOdds(sels, mkDeps(spy));
    expect(res.get("x")).toBe("1.40");
    expect(res.get("y")).toBe("2.20");
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
