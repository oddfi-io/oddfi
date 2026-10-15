import { describe, it, expect } from "vitest";
import {
  lineToBasis,
  hasOnchainLine,
  filterLinesToOnchain,
  pickOnchainAlignedLine,
  shouldAlignToOnchain,
} from "./onchain-line-filter";
import type { OnchainMarket } from "@/types/onchain-betting";
import type { OddsLine } from "@/lib/parse-odds-lines";

/** 最小 OnchainMarket 夹具（仅本模块用到的字段）。 */
function market(market_type: number, line_value?: string): OnchainMarket {
  return {
    fixture_id: 19609127,
    match_id: "0xmatch",
    market_id: `0xm-${market_type}-${line_value ?? "none"}`,
    market_type,
    line: 0,
    bet_market: "x",
    outcomes: [],
    base_odds: [],
    quoted_odds: [],
    signal: 0,
    match_start_time: 0,
    match_end_time: 0,
    lock_at: 0,
    ...(line_value !== undefined ? { line_value } : {}),
  } as unknown as OnchainMarket;
}

function line(lineValue: string): OddsLine {
  return {
    lineValue,
    homeOdds: "1.80",
    awayOdds: "2.07",
    homeEntryId: 1,
    awayEntryId: 2,
  };
}

// 实测场景夹具：fixture 19609127 链上只有 1x2 和 AH -1.25（行情却展示 AH -1 / AT 2.5）
const REAL_MARKETS = [market(0), market(1, "-1.25")];

describe("lineToBasis", () => {
  it("解析常规/带符号/unicode 减号/省略前导零", () => {
    expect(lineToBasis("-1.25")).toBe(-125);
    expect(lineToBasis("+0.5")).toBe(50);
    expect(lineToBasis("−1")).toBe(-100); // unicode 减号
    expect(lineToBasis(".5")).toBe(50);
    expect(lineToBasis("2.5")).toBe(250);
  });

  it("空值/不可解析返回 null", () => {
    expect(lineToBasis(null)).toBeNull();
    expect(lineToBasis("")).toBeNull();
    expect(lineToBasis("abc")).toBeNull();
  });
});

describe("hasOnchainLine", () => {
  it("1x2 无线概念，只看 market_type 0 是否存在", () => {
    expect(hasOnchainLine(REAL_MARKETS, 1, null)).toBe(true);
    expect(hasOnchainLine([market(1, "-1.25")], 1, null)).toBe(false);
  });

  it("AH 用 basis 数值匹配：-1.25 命中，停盘的 -1 不命中（实测场景）", () => {
    expect(hasOnchainLine(REAL_MARKETS, 6, "-1.25")).toBe(true);
    expect(hasOnchainLine(REAL_MARKETS, 6, "-1")).toBe(false);
  });

  it("格式差异不影响匹配：'-1.25' vs 后端 '-1.25'、'0.5' vs '+0.5'", () => {
    expect(hasOnchainLine([market(1, "+0.5")], 6, "0.5")).toBe(true);
    expect(hasOnchainLine([market(2, "2.5")], 7, "2.50")).toBe(true);
  });

  it("AT 2.5 链上无盘 → false（实测场景：行情僵尸线）", () => {
    expect(hasOnchainLine(REAL_MARKETS, 7, "2.5")).toBe(false);
  });

  it("markets 空/未加载、未知玩法、缺 line_value 一律 false", () => {
    expect(hasOnchainLine(null, 6, "-1.25")).toBe(false);
    expect(hasOnchainLine([], 6, "-1.25")).toBe(false);
    expect(hasOnchainLine(REAL_MARKETS, 99, "-1.25")).toBe(false);
    expect(hasOnchainLine([market(1)], 6, "-1.25")).toBe(false); // 旧后端无 line_value
  });
});

describe("filterLinesToOnchain（详情页）", () => {
  it("只保留链上有盘的线：[-1, -1.25] → [-1.25]", () => {
    const out = filterLinesToOnchain([line("-1"), line("-1.25")], REAL_MARKETS, 6);
    expect(out.map((l) => l.lineValue)).toEqual(["-1.25"]);
  });

  it("链上无该玩法任何盘 → 空列表（AT 实测场景）", () => {
    expect(filterLinesToOnchain([line("2.5"), line("2.25")], REAL_MARKETS, 7)).toEqual([]);
  });

  it("markets 未加载（null）→ 原列表透传，不闪缺省态", () => {
    const lines = [line("-1"), line("-1.25")];
    expect(filterLinesToOnchain(lines, null, 6)).toBe(lines);
  });
});

describe("pickOnchainAlignedLine（列表卡片）", () => {
  it("无 preferredLine 时挑出首条链上有盘的线", () => {
    const picked = pickOnchainAlignedLine([line("-1"), line("-1.25")], REAL_MARKETS, 6);
    expect(picked?.lineValue).toBe("-1.25");
  });

  it("preferredLine（行情主线）链上有盘 → 直接用它", () => {
    const markets = [market(1, "-1"), market(1, "-1.25")];
    const picked = pickOnchainAlignedLine([line("-1.25"), line("-1")], markets, 6, "-1");
    expect(picked?.lineValue).toBe("-1");
  });

  it("preferredLine 链上无盘 → 取 basis 距离最近的可投线（不是升序首条深盘）", () => {
    // 行情主线 -1 停盘；可投线 -2.5 / -1.25 → 距 -1 最近的是 -1.25
    const markets = [market(1, "-2.5"), market(1, "-1.25")];
    const picked = pickOnchainAlignedLine(
      [line("-2.5"), line("-1.25"), line("-1")],
      markets,
      6,
      "-1"
    );
    expect(picked?.lineValue).toBe("-1.25");
  });

  it("已加载有盘体系但该玩法无可投线 → null（渲染横杠缺省）", () => {
    expect(pickOnchainAlignedLine([line("2.5")], REAL_MARKETS, 7)).toBeNull();
  });

  it("未加载（null）或链上零盘（[]）→ undefined（透传现状：普通联赛/过渡窗口不误伤）", () => {
    expect(pickOnchainAlignedLine([line("-1")], null, 6)).toBeUndefined();
    expect(pickOnchainAlignedLine([line("2.5")], [], 7)).toBeUndefined();
  });
});

describe("filterLinesToOnchain 零盘透传（critic Major#3）", () => {
  it("链上零盘（[]）→ 原列表透传，不整场打横杠", () => {
    const lines = [line("-1"), line("-1.25")];
    expect(filterLinesToOnchain(lines, [], 6)).toBe(lines);
  });
});

describe("shouldAlignToOnchain（DD-147 两网统一）", () => {
  it("真实赛事 → 对齐链上盘（true，testnet/mainnet 统一不再看 IS_TESTNET）", () => {
    expect(shouldAlignToOnchain(19609165)).toBe(true);
  });

  it("测试赛事（TEST_FIXTURE_IDS 99200001）→ 不对齐，按行情线走中心化（false）", () => {
    expect(shouldAlignToOnchain(99200001)).toBe(false);
  });
});
