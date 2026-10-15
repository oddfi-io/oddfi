import { describe, it, expect } from "vitest";
import {
  ledgerToBet,
  ledgerToTransaction,
  mapStatus,
  mapBusinessType,
  deriveMatchStatus,
  absAmount,
  parlayLegToBetLeg,
  parseScoreString,
  parseOnchainOrderId,
} from "./portfolio";
import type { BetStatus, BusinessType, LedgerRecord, ParlayLeg } from "@/types/auth";

function buildBetLedger(overrides: Partial<LedgerRecord> = {}): LedgerRecord {
  return {
    business_type: "single",
    amount: "-100",
    ref_id: "bet-001",
    created_at: "2026-04-18T10:00:00Z",
    event_info: {
      odd_id: 42,
      stake: "100",
      status: "PENDING",
      type: "single",
      odds: "2.50",
      payout: "250",
      fixture_name: "Argentina vs Brazil",
      fixture_time: "2030-01-01T12:00:00Z",
      market_type: "Fulltime Result",
      selection: "Home",
    },
    ...overrides,
  };
}

describe("parseOnchainOrderId (BUG-024)", () => {
  it("解析 onchain:<id> 前缀的 order_id", () => {
    expect(parseOnchainOrderId("onchain:777")).toBe(777);
    expect(parseOnchainOrderId("onchain:1")).toBe(1);
  });
  it("链下 ref_id（纯数字 bet_id，无前缀）→ undefined", () => {
    expect(parseOnchainOrderId("12345")).toBeUndefined();
    expect(parseOnchainOrderId("bet-001")).toBeUndefined();
  });
  it("缺省 / 非法 → undefined", () => {
    expect(parseOnchainOrderId(undefined)).toBeUndefined();
    expect(parseOnchainOrderId("onchain:")).toBeUndefined();
    expect(parseOnchainOrderId("onchain:abc")).toBeUndefined();
  });
});

describe("ledgerToBet onchain 字段 (BUG-024)", () => {
  it("onchain 行解析 onchainOrderId（来自 ref_id onchain:<id>）", () => {
    const bet = ledgerToBet(
      buildBetLedger({ business_type: "onchain_single", ref_id: "onchain:888", bet_id: "0xabc" }),
      null
    );
    expect(bet?.onchainOrderId).toBe(888);
    expect(bet?.onchainBetId).toBe("0xabc");
  });
  it("链下行 onchainOrderId 为 undefined", () => {
    const bet = ledgerToBet(buildBetLedger({ ref_id: "999" }), null);
    expect(bet?.onchainOrderId).toBeUndefined();
  });
  it("CASHED_OUT 状态 → settlementStatus cashed_out + 非 active + 不可领", () => {
    const bet = ledgerToBet(
      buildBetLedger({
        business_type: "onchain_single",
        ref_id: "onchain:5",
        bet_id: "0x5",
        event_info: {
          odd_id: 5,
          stake: "100",
          status: "CASHED_OUT",
          type: "single",
          odds: "1.90",
          payout: "190",
          fixture_name: "A vs B",
          fixture_time: "2030-01-01T12:00:00Z",
          market_type: "FTR",
          selection: "Home",
        },
      }),
      null
    );
    expect(bet?.settlementStatus).toBe("cashed_out");
    expect(bet?.cashoutAvailable).toBe(false); // 非 active → 不可再撤
    expect(bet?.claimable).toBe(false); // 资金已返还 → 不露 Claim
  });
});

describe("mapStatus", () => {
  const cases: Array<[BetStatus, string]> = [
    ["PENDING", "pending"],
    ["WON", "won"],
    ["LOST", "lost"],
    ["PUSH", "push"],
    ["VOID", "void"],
    ["CLAIMED", "won"],
    ["CANCELLED", "void"],
  ];
  cases.forEach(([input, expected]) => {
    it(`${input} → ${expected}`, () => {
      expect(mapStatus(input)).toBe(expected);
    });
  });

  it("小写 live → live（active 列表 banner_single）", () => {
    expect(mapStatus("live")).toBe("live");
  });

  it("混合大小写 Push → push（DD-087 §3.1 归一）", () => {
    expect(mapStatus("Push")).toBe("push");
  });

  it("空白 + 未知值 → active 兜底", () => {
    expect(mapStatus("")).toBe("active");
    expect(mapStatus("UNKNOWN")).toBe("active");
  });
});

describe("mapBusinessType", () => {
  // 普通 business_type → 单一源（DD-087 §4.4）
  const cases: Array<[BusinessType, string]> = [
    ["single", "bet"],
    ["parlay", "bet"],
    ["banner_single", "bet"],
    ["cancel_bet", "cancel"],
    ["withdraw", "withdraw"],
    ["cancel_withdraw", "withdraw"],
    ["deposit", "deposit"],
    ["stake", "stake"],
    ["unstake", "unstake"],
    ["add_lp", "add_lp"],
    ["remove_lp", "remove_lp"],
    // 链上 Stake / Liquidity 流水（chain_consumer 直写 asset_ledger）→ 链下同语义归并
    ["stake_created", "stake"],
    ["stake_withdrawn", "unstake"],
    ["liquidity_deposited", "add_lp"],
    ["liquidity_unbond_requested", "remove_lp"],
    ["liquidity_withdrawn", "remove_lp"],
  ];
  cases.forEach(([input, expected]) => {
    it(`${input} → ${expected}`, () => {
      expect(mapBusinessType(input)).toBe(expected);
    });
  });

  // claim_prize 始终映射为 "claim"，不再按结算状态派生（领奖筛选下统一展示 Claim）
  describe("claim_prize 始终映射为 claim", () => {
    it("claim_prize 无 status → claim", () => {
      expect(mapBusinessType("claim_prize")).toBe("claim");
    });

    it.each(["WON", "LOST", "PUSH", "VOID", "won", "FOO"])(
      "claim_prize + status=%s → claim",
      (status) => {
        expect(mapBusinessType("claim_prize", status)).toBe("claim");
      }
    );
  });

  // 下注类（single / parlay / banner_single）按 event_info.status 派生 won/lost/push/void
  describe("下注类按结算状态派生", () => {
    it.each([
      ["single", "WON", "won"],
      ["single", "LOST", "lost"],
      ["parlay", "PUSH", "push"],
      ["banner_single", "VOID", "void"],
      ["single", "won", "won"], // 大小写归一
    ])("%s + status=%s → %s", (bt, status, expected) => {
      expect(mapBusinessType(bt as BusinessType, status)).toBe(expected);
    });

    it.each([
      ["single", "PENDING"],
      ["parlay", undefined],
      ["banner_single", "live"],
      ["single", "FOO"],
    ])("%s + status=%s（未结算/未知）→ bet", (bt, status) => {
      expect(mapBusinessType(bt as BusinessType, status)).toBe("bet");
    });
  });
});

describe("deriveMatchStatus", () => {
  it("未来时间 → upcoming", () => {
    expect(deriveMatchStatus("2099-01-01T00:00:00Z")).toBe("upcoming");
  });

  it("过去时间 → finished", () => {
    expect(deriveMatchStatus("2000-01-01T00:00:00Z")).toBe("finished");
  });

  it("无 T 分隔（后端格式）→ 视为 UTC 解析", () => {
    expect(deriveMatchStatus("2099-01-01 00:00:00")).toBe("upcoming");
  });

  it("undefined → finished", () => {
    expect(deriveMatchStatus(undefined)).toBe("finished");
  });

  it("无效字符串 → finished", () => {
    expect(deriveMatchStatus("not-a-date")).toBe("finished");
  });
});

describe("absAmount", () => {
  it("负数去符号", () => expect(absAmount("-100")).toBe("100"));
  it("正数不变", () => expect(absAmount("100")).toBe("100"));
  it("0 不变", () => expect(absAmount("0")).toBe("0"));
});

// 后端 event_info.score "主-客" 终场比分串（web-api HistoryScoreForStatus 口径）
describe("parseScoreString", () => {
  it('常规比分 "2-1" → {home:2, away:1}', () => {
    expect(parseScoreString("2-1")).toEqual({ home: 2, away: 1 });
  });

  it('取消/作废注单固定 "0-0" → {home:0, away:0}', () => {
    expect(parseScoreString("0-0")).toEqual({ home: 0, away: 0 });
  });

  it("两位数进球（网球/板球盘分场景）正常解析", () => {
    expect(parseScoreString("10-12")).toEqual({ home: 10, away: 12 });
  });

  it("首尾空白容错", () => {
    expect(parseScoreString(" 2-1 ")).toEqual({ home: 2, away: 1 });
  });

  it("未结算（空串 / 纯空白串 / undefined / null）→ null", () => {
    expect(parseScoreString("")).toBeNull();
    expect(parseScoreString("   ")).toBeNull();
    expect(parseScoreString(undefined)).toBeNull();
    expect(parseScoreString(null)).toBeNull();
  });

  it('非法格式（非 "数字-数字"）→ null，UI 渲染 "--"', () => {
    expect(parseScoreString("2:1")).toBeNull(); // 错误分隔符
    expect(parseScoreString("a-b")).toBeNull();
    expect(parseScoreString("2-")).toBeNull();
    expect(parseScoreString("-1")).toBeNull();
    expect(parseScoreString("2-1-3")).toBeNull();
  });
});

describe("ledgerToBet", () => {
  it("event_info == null 返回 null", () => {
    expect(
      ledgerToBet(buildBetLedger({ business_type: "withdraw", event_info: null }), null)
    ).toBeNull();
  });

  // DD-105 Batch 7 — onchain_single 透传
  it("onchain_single + bet_id 顶层 → isOnchain=true + onchainBetId 透传", () => {
    const ledger = buildBetLedger({
      business_type: "onchain_single",
      bet_id: "0xabc123",
    });
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.isOnchain).toBe(true);
    expect(bet.onchainBetId).toBe("0xabc123");
  });

  it("onchain_single 但 bet_id 缺失(事件索引未回填) → onchainBetId undefined", () => {
    const ledger = buildBetLedger({ business_type: "onchain_single" });
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.isOnchain).toBe(true);
    expect(bet.onchainBetId).toBeUndefined();
  });

  it("链下 single 即使有 bet_id 字段也不标记 isOnchain", () => {
    const ledger = buildBetLedger({ business_type: "single", bet_id: "0xshouldNotLeak" });
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.isOnchain).toBe(false);
    expect(bet.onchainBetId).toBeUndefined();
  });

  // DD-137 纯方案 B：链上单 active + betId + 数值编码(outcome/market_type_code/line_code)齐 → 可撤
  // 报价字段从 event_info 透传给 cashout* 字段；outcome/code/line 的 0 为合法值（falsy 防御）
  const onchainQuoteFields = {
    fixture_id: 993021780890000,
    outcome: 1,
    market_type_code: 1,
    line_code: 0,
    accepted_amount_wei: "1000000000000000000000",
    locked_odds_raw: "18800",
  };

  it("onchain_single LIVE 行 + betId + 数值编码齐 → cashoutAvailable=true + cashout* 字段透传", () => {
    const ledger = buildBetLedger({ business_type: "onchain_single", bet_id: "0xabc" });
    Object.assign(ledger.event_info!, { status: "LIVE", ...onchainQuoteFields });
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.isOnchain).toBe(true);
    expect(bet.settlementStatus).toBe("live");
    expect(bet.cashoutAvailable).toBe(true);
    expect(bet.cashoutFixtureId).toBe(993021780890000);
    expect(bet.cashoutOutcome).toBe(1);
    expect(bet.cashoutMarketTypeCode).toBe(1);
    expect(bet.cashoutLineCode).toBe(0);
    expect(bet.cashoutAcceptedAmountWei).toBe("1000000000000000000000");
    expect(bet.cashoutLockedOddsRaw).toBe("18800");
    expect(bet.claimable).toBe(false); // LIVE 时 Claim 依旧不可用
  });

  it("onchain_single PENDING 行 + betId + 数值编码齐 → cashoutAvailable=true", () => {
    const ledger = buildBetLedger({ business_type: "onchain_single", bet_id: "0xabc" });
    Object.assign(ledger.event_info!, { status: "PENDING", ...onchainQuoteFields });
    expect(ledgerToBet(ledger, null)!.cashoutAvailable).toBe(true);
  });

  it("falsy 防御：outcome=0 / market_type_code=0 / line_code=0 仍 cashoutAvailable=true", () => {
    const ledger = buildBetLedger({ business_type: "onchain_single", bet_id: "0xabc" });
    Object.assign(ledger.event_info!, {
      status: "LIVE",
      fixture_id: 1,
      outcome: 0,
      market_type_code: 0,
      line_code: 0,
    });
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.cashoutAvailable).toBe(true);
    expect(bet.cashoutOutcome).toBe(0);
    expect(bet.cashoutMarketTypeCode).toBe(0);
  });

  it("onchain_single 但 bet_id 缺失(事件索引未回填) → cashoutAvailable=false", () => {
    const ledger = buildBetLedger({ business_type: "onchain_single" });
    Object.assign(ledger.event_info!, { status: "LIVE", ...onchainQuoteFields });
    expect(ledgerToBet(ledger, null)!.cashoutAvailable).toBe(false);
  });

  // ENH-038 · 后端 event_info.cash_out_state（正在取消 / 已取消）
  it("cash_out_state 缺省 → cashoutState='none' + cashoutAvailable=true", () => {
    const ledger = buildBetLedger({ business_type: "onchain_single", bet_id: "0xabc" });
    Object.assign(ledger.event_info!, { status: "LIVE", ...onchainQuoteFields });
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.cashoutState).toBe("none");
    expect(bet.cashoutAvailable).toBe(true);
  });

  it("cash_out_state='cashing_out' → cashoutState 透传 + cashoutAvailable=false(按钮禁用)", () => {
    const ledger = buildBetLedger({ business_type: "onchain_single", bet_id: "0xabc" });
    Object.assign(ledger.event_info!, {
      status: "LIVE",
      ...onchainQuoteFields,
      cash_out_state: "cashing_out",
    });
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.cashoutState).toBe("cashing_out");
    expect(bet.cashoutAvailable).toBe(false);
  });

  it("cash_out_state='cashed_out' → cashoutState 透传(终态已走 settled)", () => {
    const ledger = buildBetLedger({ business_type: "onchain_single", bet_id: "0xabc" });
    Object.assign(ledger.event_info!, {
      status: "CASHED_OUT",
      ...onchainQuoteFields,
      cash_out_state: "cashed_out",
    });
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.cashoutState).toBe("cashed_out");
    expect(bet.settlementStatus).toBe("cashed_out");
    expect(bet.cashoutAvailable).toBe(false); // 非 active
  });

  it("链下行(非 onchain) 即使后端误带 cash_out_state 也强制 'none'", () => {
    const ledger = buildBetLedger({ business_type: "single", ref_id: "555" });
    Object.assign(ledger.event_info!, { status: "LIVE", cash_out_state: "cashing_out" });
    expect(ledgerToBet(ledger, null)!.cashoutState).toBe("none");
  });

  it("onchain_single 但数值编码缺失(outcome 等 undefined) → cashoutAvailable=false", () => {
    const ledger = buildBetLedger({ business_type: "onchain_single", bet_id: "0xabc" });
    ledger.event_info!.status = "LIVE"; // 不带 outcome/market_type_code/line_code
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.onchainBetId).toBe("0xabc");
    expect(bet.cashoutAvailable).toBe(false);
  });

  // 后端信号灯成交回填 — 部分成交退回金额（event_info.refund_amount）透传
  it("onchain_single + refund_amount → refundAmount 透传", () => {
    const ledger = buildBetLedger({ business_type: "onchain_single", bet_id: "0xabc" });
    ledger.event_info!.refund_amount = "2.5";
    const bet = ledgerToBet(ledger, "2")!;
    expect(bet.refundAmount).toBe("2.5");
  });

  // 后端 event_info.score — settled 终场比分展示（Portfolio Settled 表 Match 列）
  it('已结算 + score="2-1" → homeScore=2 awayScore=1', () => {
    const ledger = buildBetLedger();
    ledger.event_info!.status = "WON";
    ledger.event_info!.score = "2-1";
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.homeScore).toBe(2);
    expect(bet.awayScore).toBe(1);
  });

  it("未结算（score 缺省）→ homeScore/awayScore undefined（UI 渲染 --）", () => {
    const bet = ledgerToBet(buildBetLedger(), null)!;
    expect(bet.homeScore).toBeUndefined();
    expect(bet.awayScore).toBeUndefined();
  });

  it("score 非法串 → 回退 DD-115 数值字段 home_score/away_score", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.score = "not-a-score";
    ledger.event_info!.home_score = 3;
    ledger.event_info!.away_score = 2;
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.homeScore).toBe(3);
    expect(bet.awayScore).toBe(2);
  });

  // REV-v1 Major-1：取消/作废单后端恒发占位 "0-0"（非真实赛果），必须过滤为 undefined，
  // 否则 UI 渲染成与真实 0-0 平局无法区分的"平局"样式
  it.each(["CANCELLED", "VOID", "REFUNDED"] as const)(
    '%s 注单 score="0-0" 占位 → homeScore/awayScore undefined（UI 渲染 --）',
    (status) => {
      const ledger = buildBetLedger();
      ledger.event_info!.status = status;
      ledger.event_info!.score = "0-0";
      ledger.event_info!.home_score = 9; // 脏数据，同样不得透出
      const bet = ledgerToBet(ledger, null)!;
      expect(bet.homeScore).toBeUndefined();
      expect(bet.awayScore).toBeUndefined();
    }
  );

  // REV-v1 Minor-2：?? 回退链对 0 值的 nullish 语义防护（防止未来误改为 ||）
  it("score 缺省 + home_score=0（真实 0-0 结算）→ homeScore=0 不被误回退", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.status = "WON";
    ledger.event_info!.home_score = 0;
    ledger.event_info!.away_score = 0;
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.homeScore).toBe(0);
    expect(bet.awayScore).toBe(0);
  });

  it('已结算真实平局 score="0-0"（PUSH）正常展示，不受取消单过滤影响', () => {
    const ledger = buildBetLedger();
    ledger.event_info!.status = "PUSH";
    ledger.event_info!.score = "0-0";
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.homeScore).toBe(0);
    expect(bet.awayScore).toBe(0);
  });

  it('refund_amount="0"（无部分成交）→ refundAmount undefined', () => {
    const ledger = buildBetLedger({ business_type: "onchain_single", bet_id: "0xabc" });
    ledger.event_info!.refund_amount = "0";
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.refundAmount).toBeUndefined();
  });

  // REV N-1 — 固化后端 decimal 输出格式契约：零值变体 / 非法值都不得透传
  it.each(["0.0", "0.00", "", "abc", "-1"])(
    'refund_amount="%s"（零值变体/非法）→ refundAmount undefined',
    (raw) => {
      const ledger = buildBetLedger({ business_type: "onchain_single", bet_id: "0xabc" });
      ledger.event_info!.refund_amount = raw;
      const bet = ledgerToBet(ledger, null)!;
      expect(bet.refundAmount).toBeUndefined();
    }
  );

  it("链下 single 即使后端误带 refund_amount 也不透传", () => {
    const ledger = buildBetLedger({ business_type: "single" });
    ledger.event_info!.refund_amount = "3";
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.refundAmount).toBeUndefined();
  });

  it("onchain_single 已结算(WON) → cashoutAvailable=false（非 active 不可撤）", () => {
    const ledger = buildBetLedger({ business_type: "onchain_single", bet_id: "0xabc" });
    Object.assign(ledger.event_info!, { status: "WON", ...onchainQuoteFields });
    expect(ledgerToBet(ledger, null)!.cashoutAvailable).toBe(false);
  });

  it("real-data: onchain_single LIVE 行(用户实测)→ isOnchain + onchainBetId + live + cashoutAvailable=true(DD-137)", () => {
    const realChainLedger: LedgerRecord = {
      business_type: "onchain_single",
      amount: "-500",
      balance_before: "0",
      balance_after: "0",
      ref_id: "onchain:14",
      status: 1,
      enable_claim: false,
      event_info: {
        odd_id: 0,
        stake: "500",
        status: "LIVE",
        type: "single",
        odds: "3.26",
        payout: "1630",
        actual_payout: "",
        fixture_name: "巴黎圣日耳曼 对 阿森纳",
        fixture_time: "2026-05-30T16:00:00Z",
        home_team_logo: "https://cdn.sportmonks.com/images/soccer/teams/15/591.png",
        away_team_logo: "https://cdn.sportmonks.com/images/soccer/teams/19/19.png",
        market_type: "1X2",
        selection: "Away",
        fixture_id: 993021780890000,
        outcome: 2,
        market_type_code: 0,
        line_code: 0,
        accepted_amount_wei: "500000000000000000000",
        locked_odds_raw: "32600",
      },
      created_at: "2026-05-21T04:04:59.255Z",
      bet_id: "0x000000000000000000000000000000000000000000000000000000000000001d",
    };
    const bet = ledgerToBet(realChainLedger, null);
    expect(bet).not.toBeNull();
    expect(bet!.isOnchain).toBe(true);
    expect(bet!.onchainBetId).toBe(
      "0x000000000000000000000000000000000000000000000000000000000000001d"
    );
    expect(bet!.settlementStatus).toBe("live");
    // DD-137 纯方案 B：bet_id + 数值编码齐 → Cancel 按钮亮，报价字段透传
    expect(bet!.cashoutAvailable).toBe(true);
    expect(bet!.cashoutFixtureId).toBe(993021780890000);
    expect(bet!.cashoutOutcome).toBe(2);
    expect(bet!.claimable).toBe(false); // LIVE 时 Claim 按钮也不显示
    // parseFixtureName 现已支持 "对" 中文分隔符,homeTeam/awayTeam name 正确解析
    expect(bet!.homeTeam.name).toBe("巴黎圣日耳曼");
    expect(bet!.awayTeam.name).toBe("阿森纳");
    expect(bet!.betAmount).toBe("500");
    expect(bet!.odds).toBe("3.26");
    expect(bet!.potentialWin).toBe("1630");
    // betId(链下 ref_id parse 数字)— "onchain:14" parseInt → NaN → undefined
    expect(bet!.betId).toBeUndefined();
    // homeTeam / awayTeam 由 parseFixtureName("巴黎圣日耳曼 对 阿森纳") 拆出
    expect(bet!.homeTeam.iconUrl).toContain("sportmonks");
    expect(bet!.awayTeam.iconUrl).toContain("sportmonks");
  });

  it("PENDING → pending + cashoutAvailable + 不可 claim（DD-087 §3.1）", () => {
    const bet = ledgerToBet(buildBetLedger(), null)!;
    expect(bet.settlementStatus).toBe("pending");
    expect(bet.cashoutAvailable).toBe(true);
    expect(bet.claimable).toBe(false);
    expect(bet.claimAmount).toBeUndefined();
  });

  it("live → live + cashoutAvailable（active 列表小写 status）", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.status = "live";
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.settlementStatus).toBe("live");
    expect(bet.cashoutAvailable).toBe(true);
    expect(bet.claimable).toBe(false);
  });

  it("PUSH → push + 可 claim（走水退本金）", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.status = "PUSH";
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.settlementStatus).toBe("push");
    expect(bet.claimable).toBe(true);
    expect(bet.cashoutAvailable).toBe(false);
  });

  it("VOID → void + 可 claim（赛事取消退款）", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.status = "VOID";
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.settlementStatus).toBe("void");
    expect(bet.claimable).toBe(true);
    expect(bet.cashoutAvailable).toBe(false);
  });

  it("LOST → lost + 不可 claim 不可 cancel", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.status = "LOST";
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.settlementStatus).toBe("lost");
    expect(bet.claimable).toBe(false);
    expect(bet.cashoutAvailable).toBe(false);
  });

  it("WON + actual_payout 优先用作 claimAmount（DD-087 §2.1）", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.status = "WON";
    ledger.event_info!.payout = "142"; // 老 potential
    ledger.event_info!.actual_payout = "112"; // 新真实派彩
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.claimAmount).toBe("112");
  });

  it("WON + actual_payout 缺失时 fallback 到 payout", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.status = "WON";
    ledger.event_info!.payout = "250";
    delete ledger.event_info!.actual_payout;
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.claimAmount).toBe("250");
  });

  it("settled_at 透传到 PortfolioBet.settledAt", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.status = "WON";
    ledger.event_info!.settled_at = "2026-04-29T10:09:32.264Z";
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.settledAt).toBe("2026-04-29T10:09:32.264Z");
  });

  it("WON → won + 可 claim + claimAmount == payout", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.status = "WON";
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.settlementStatus).toBe("won");
    expect(bet.claimable).toBe(true);
    expect(bet.claimAmount).toBe("250");
  });

  it("CLAIMED → won + 不可 claim", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.status = "CLAIMED";
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.settlementStatus).toBe("won");
    expect(bet.claimable).toBe(false);
    expect(bet.claimAmount).toBeUndefined();
  });

  it("LOST → lost + 不可 claim", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.status = "LOST";
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.settlementStatus).toBe("lost");
    expect(bet.claimable).toBe(false);
  });

  it("CANCELLED → void", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.status = "CANCELLED";
    expect(ledgerToBet(ledger, null)!.settlementStatus).toBe("void");
  });

  it("parlay 类型（小写或大写）→ isMulti = true", () => {
    const lower = buildBetLedger();
    lower.event_info!.type = "parlay";
    expect(ledgerToBet(lower, null)!.isMulti).toBe(true);

    const upper = buildBetLedger();
    upper.event_info!.type = "PARLAY";
    expect(ledgerToBet(upper, null)!.isMulti).toBe(true);
  });

  // DD-115 · business_type 是 isMulti 的首选源（对齐后端 Lark 文档 R06DdokoXoodjNxf08UlBUjvgXe）
  it("business_type === 'parlay' → isMulti = true（即使 event_info.type 是 single）", () => {
    const ledger = buildBetLedger({ business_type: "parlay" });
    ledger.event_info!.type = "single";
    expect(ledgerToBet(ledger, null)!.isMulti).toBe(true);
  });

  it("single 类型 → isMulti = false", () => {
    expect(ledgerToBet(buildBetLedger(), null)!.isMulti).toBe(false);
  });

  // DD-115 · 比分 / 盘口数（后端待补，optional 接住）
  it("home_score / away_score / handicap_line 缺省 → 字段 undefined（不阻塞渲染）", () => {
    const bet = ledgerToBet(buildBetLedger(), null)!;
    expect(bet.homeScore).toBeUndefined();
    expect(bet.awayScore).toBeUndefined();
    expect(bet.handicapLine).toBeUndefined();
  });

  it("home_score / away_score 透传（含 0 主队失利场景）", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.home_score = 0;
    ledger.event_info!.away_score = 3;
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.homeScore).toBe(0);
    expect(bet.awayScore).toBe(3);
  });

  it("home_score null（后端显式空）→ 转 undefined", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.home_score = null;
    ledger.event_info!.away_score = null;
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.homeScore).toBeUndefined();
    expect(bet.awayScore).toBeUndefined();
  });

  it("handicap_line 透传（亚盘场景）", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.handicap_line = "0.5";
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.handicapLine).toBe("0.5");
  });

  // DD-115 · 串关父单字段
  it("parlay 行透传 parlay_group_id / parlay_parent_id / leg_count / parlay_legs（按 leg_index 排序）", () => {
    const legs: ParlayLeg[] = [
      {
        bet_id: 284,
        odd_id: 235707634176,
        status: "LIVE",
        odds: "3.28",
        fixture_name: "巴黎圣日耳曼 对 阿森纳",
        fixture_time: "2026-05-30T16:00:00Z",
        home_team_logo: "https://cdn.sportmonks.com/images/soccer/teams/15/591.png",
        away_team_logo: "https://cdn.sportmonks.com/images/soccer/teams/19/19.png",
        market_type: "Fulltime Result",
        selection: "Draw 3.28",
        leg_index: 1,
      },
      {
        bet_id: 283,
        odd_id: 9920000109,
        status: "WON",
        odds: "1.35",
        fixture_name: "葡萄牙 vs 阿根廷",
        fixture_time: "2026-05-23T15:27:32Z",
        home_team_logo: "https://cdn.sportmonks.com/images/soccer/teams/13/18701.png",
        away_team_logo: "https://cdn.sportmonks.com/images/soccer/teams/20/18644.png",
        market_type: "Asian Handicap",
        selection: "Away",
        leg_index: 0,
      },
    ];

    const ledger = buildBetLedger({ business_type: "parlay" });
    ledger.event_info!.type = "parlay";
    ledger.event_info!.parlay_group_id = "5b8c27cf-4a9c-4f05-8284-70c475259fcb";
    ledger.event_info!.parlay_parent_id = 283;
    ledger.event_info!.leg_count = 2;
    ledger.event_info!.parlay_total_odds = "4.428";
    ledger.event_info!.parlay_legs = legs;

    const bet = ledgerToBet(ledger, null)!;
    expect(bet.isMulti).toBe(true);
    expect(bet.parlayGroupId).toBe("5b8c27cf-4a9c-4f05-8284-70c475259fcb");
    expect(bet.parlayParentId).toBe(283);
    expect(bet.legCount).toBe(2);
    expect(bet.legs).toHaveLength(2);
    // 按 leg_index 升序排序后第一条应是 leg_index=0 的 Asian Handicap
    expect(bet.legs![0].marketTag).toBe("Asian Handicap");
    expect(bet.legs![0].settlementStatus).toBe("won");
    expect(bet.legs![1].marketTag).toBe("Fulltime Result");
    expect(bet.legs![1].settlementStatus).toBe("live");
    // 子腿 fixture 解析（"vs" 与中文"对"都支持）
    expect(bet.legs![0].homeTeam.name).toBe("葡萄牙");
    expect(bet.legs![0].awayTeam.name).toBe("阿根廷");
    expect(bet.legs![1].homeTeam.name).toBe("巴黎圣日耳曼");
    expect(bet.legs![1].awayTeam.name).toBe("阿森纳");
    // ⚠️ 子腿金额维度字段被填空串（UI 必须显式渲染 "--"，不能信任 leg.betAmount）
    expect(bet.legs![0].betAmount).toBe("");
    expect(bet.legs![0].potentialWin).toBe("");
    // 父单 ref_id 拼到 leg id 里保证 React key 唯一
    expect(bet.legs![0].id).toMatch(/^bet-001-leg-0-283$/);
    expect(bet.legs![1].id).toMatch(/^bet-001-leg-1-284$/);
  });

  it("非 parlay 行 → legs / parlayGroupId / parlayParentId / legCount 均 undefined", () => {
    const bet = ledgerToBet(buildBetLedger(), null)!;
    expect(bet.legs).toBeUndefined();
    expect(bet.parlayGroupId).toBeUndefined();
    expect(bet.parlayParentId).toBeUndefined();
    expect(bet.legCount).toBeUndefined();
  });

  it("iconUrl 读取后端返回的真实 logo（缺失回退空串，由 UI 组件处理 fallback）", () => {
    const ledger = buildBetLedger();
    ledger.event_info!.home_team_logo = "https://cdn.example.com/home.png";
    ledger.event_info!.away_team_logo = "https://cdn.example.com/away.png";
    const bet = ledgerToBet(ledger, null)!;
    expect(bet.homeTeam.iconUrl).toBe("https://cdn.example.com/home.png");
    expect(bet.awayTeam.iconUrl).toBe("https://cdn.example.com/away.png");

    const missing = ledgerToBet(buildBetLedger(), null)!;
    expect(missing.homeTeam.iconUrl).toBe("");
    expect(missing.awayTeam.iconUrl).toBe("");
  });

  it("解析 fixture_name", () => {
    const bet = ledgerToBet(buildBetLedger(), null)!;
    expect(bet.homeTeam.name).toBe("Argentina");
    expect(bet.awayTeam.name).toBe("Brazil");
  });

  it("id 拼接 ref_id + odd_id + created_at 兜底唯一性（防后端 ref_id 重复）", () => {
    const ledger = buildBetLedger({ ref_id: undefined });
    expect(ledgerToBet(ledger, null)!.id).toBe("no-ref-42-2026-04-18T10:00:00Z");
  });

  // betId 派生：ref_id 是 bet_id 的字符串形态，需要 parseInt 还原为 number 给 cancel/claim API
  // 防御 Number(bet.id) 拼接字符串 → NaN → JSON 序列化为 null 的 bug
  it("betId 来自 ref_id parseInt — 数字字符串 → number", () => {
    const bet = ledgerToBet(buildBetLedger({ ref_id: "12345" }), null)!;
    expect(bet.betId).toBe(12345);
  });

  it("betId — 非数字字符串 ref_id → undefined（防 NaN 序列化为 null）", () => {
    const bet = ledgerToBet(buildBetLedger({ ref_id: "bet-001" }), null)!;
    expect(bet.betId).toBeUndefined();
  });

  it("betId — ref_id 缺失 → undefined", () => {
    const bet = ledgerToBet(buildBetLedger({ ref_id: undefined }), null)!;
    expect(bet.betId).toBeUndefined();
  });
});

// DD-115 · 串关子腿映射器
describe("parlayLegToBetLeg", () => {
  const baseLeg: ParlayLeg = {
    bet_id: 283,
    odd_id: 9920000109,
    status: "LIVE",
    odds: "1.35",
    fixture_name: "葡萄牙 vs 阿根廷",
    fixture_time: "2026-05-23T15:27:32Z",
    home_team_logo: "https://cdn.example.com/home.png",
    away_team_logo: "https://cdn.example.com/away.png",
    market_type: "Asian Handicap",
    selection: "Away",
    leg_index: 0,
  };

  it("透传 bet_id / odds / market / selection", () => {
    const leg = parlayLegToBetLeg(baseLeg);
    expect(leg.betId).toBe(283);
    expect(leg.odds).toBe("1.35");
    expect(leg.marketTag).toBe("Asian Handicap");
    expect(leg.selectionTag).toBe("Away");
  });

  it("解析 fixture_name 拆 home/away", () => {
    const leg = parlayLegToBetLeg(baseLeg);
    expect(leg.homeTeam.name).toBe("葡萄牙");
    expect(leg.awayTeam.name).toBe("阿根廷");
    expect(leg.homeTeam.iconUrl).toBe("https://cdn.example.com/home.png");
    expect(leg.awayTeam.iconUrl).toBe("https://cdn.example.com/away.png");
  });

  it("子腿 status WON → settlementStatus=won", () => {
    expect(parlayLegToBetLeg({ ...baseLeg, status: "WON" }).settlementStatus).toBe("won");
  });

  it("子腿 status LIVE → settlementStatus=live", () => {
    expect(parlayLegToBetLeg(baseLeg).settlementStatus).toBe("live");
  });

  it("logo 缺失回退空串", () => {
    const leg = parlayLegToBetLeg({
      ...baseLeg,
      home_team_logo: undefined,
      away_team_logo: undefined,
    });
    expect(leg.homeTeam.iconUrl).toBe("");
    expect(leg.awayTeam.iconUrl).toBe("");
  });

  // 子腿不携带金额维度真实值（后端 parlay_legs 不含 stake/payout/settled_at），
  // adapter 把这些字段填空串，UI 必须按"展开行规约"渲染 "--"
  it("子腿金额维度字段填空串（UI 必须显式渲染 -- 而不是信任此字段）", () => {
    const leg = parlayLegToBetLeg(baseLeg);
    expect(leg.betAmount).toBe("");
    expect(leg.betAmountUsd).toBe("");
    expect(leg.potentialWin).toBe("");
    expect(leg.potentialWinUsd).toBe("");
    expect(leg.settledAt).toBeUndefined();
  });

  // 后端 parlay_legs[].score — 子腿终场比分（规则同父单 event_info.score）
  it('子腿 score="1-3" → homeScore=1 awayScore=3', () => {
    const leg = parlayLegToBetLeg({ ...baseLeg, status: "LOST", score: "1-3" });
    expect(leg.homeScore).toBe(1);
    expect(leg.awayScore).toBe(3);
  });

  it("子腿 score 缺省（未结算）→ homeScore/awayScore undefined（UI 渲染 --）", () => {
    const leg = parlayLegToBetLeg(baseLeg);
    expect(leg.homeScore).toBeUndefined();
    expect(leg.awayScore).toBeUndefined();
  });

  // REV-v1 Major-2：取消/作废子腿的占位 "0-0" 同样过滤（与父单口径对称）
  it.each(["CANCELLED", "VOID", "REFUNDED"] as const)(
    '%s 子腿 score="0-0" 占位 → homeScore/awayScore undefined',
    (status) => {
      const leg = parlayLegToBetLeg({ ...baseLeg, status, score: "0-0" });
      expect(leg.homeScore).toBeUndefined();
      expect(leg.awayScore).toBeUndefined();
    }
  );

  it("拼接 id 用 parentRefId + leg_index + bet_id 保证 React key 唯一", () => {
    expect(parlayLegToBetLeg(baseLeg, "283").id).toBe("283-leg-0-283");
    expect(parlayLegToBetLeg({ ...baseLeg, leg_index: 1, bet_id: 999 }, "283").id).toBe(
      "283-leg-1-999"
    );
    // parentRefId 缺省 → 用 "parlay" 占位
    expect(parlayLegToBetLeg(baseLeg).id).toBe("parlay-leg-0-283");
  });
});

// ledgerToTransaction 非 null 断言辅助 — bet_placed 之外的类型恒返回记录
function ledgerToTx(
  ...args: Parameters<typeof ledgerToTransaction>
): NonNullable<ReturnType<typeof ledgerToTransaction>> {
  const tx = ledgerToTransaction(...args);
  if (tx === null) throw new Error("unexpected null TransactionRecord");
  return tx;
}

describe("ledgerToTransaction", () => {
  it("bet_placed → 返回 null（链上扣款流水与 onchain_single 成对，不展示）", () => {
    const tx = ledgerToTransaction(
      {
        business_type: "bet_placed",
        amount: "-101",
        ref_id: "0x3e142e6997822087a2abcd47cb80bcb234b253f722c42a0cd569abc429deb0d0",
        status: 3,
        enable_claim: false,
        event_info: null,
        created_at: "2026-06-05T17:18:44Z",
      },
      null
    );
    expect(tx).toBeNull();
  });

  it("bet_settle → 返回 null（结算 worker 可领奖入账流水，已由 Claim 按钮体现，不展示）", () => {
    const tx = ledgerToTransaction(
      {
        business_type: "bet_settle",
        amount: "202",
        ref_id: "12345",
        status: 3,
        enable_claim: false,
        event_info: null,
        created_at: "2026-06-05T17:20:00Z",
      },
      null
    );
    expect(tx).toBeNull();
  });

  it("liquidity_deposited（event_info=null）→ type=add_lp + 金额绝对值", () => {
    const tx = ledgerToTx(
      {
        business_type: "liquidity_deposited",
        amount: "-1000",
        ref_id: "0x91cc72165d996d7a170d316586af784c93a81a9a3292ae6aeeb3b17b87755fea",
        status: 3,
        enable_claim: false,
        event_info: null,
        created_at: "2026-06-06T04:09:19Z",
      },
      null
    );
    expect(tx.type).toBe("add_lp");
    expect(tx.isPositive).toBe(false);
    expect(tx.amount).toBe("1000");
    expect(tx.homeTeam).toBeUndefined();
  });

  it("onchain_cashout（ENH-037）→ type=cashout + 正金额 + 赛事信息（撤单兑现入账）", () => {
    const tx = ledgerToTx(
      {
        business_type: "onchain_cashout",
        amount: "12.5", // 后端透出的兑现额，正数
        ref_id: "onchain:14",
        status: 3,
        enable_claim: false,
        event_info: {
          odd_id: 0,
          stake: "500",
          status: "CASHED_OUT",
          type: "single",
          odds: "3.26",
          payout: "1630",
          actual_payout: "12.5",
          fixture_name: "巴黎圣日耳曼 对 阿森纳",
          fixture_time: "2026-05-30T16:00:00Z",
          home_team_logo: "https://cdn.example.com/home.png",
          away_team_logo: "https://cdn.example.com/away.png",
          market_type: "1X2",
          selection: "Away",
          fixture_id: 993021780890000,
          outcome: 2,
          market_type_code: 0,
          line_code: 0,
        },
        created_at: "2026-06-10T08:00:00Z",
      },
      null
    );
    expect(tx.type).toBe("cashout");
    expect(tx.isPositive).toBe(true); // +兑现额 → 绿色
    expect(tx.amount).toBe("12.5");
    expect(tx.homeTeam?.name).toBeTruthy(); // 赛事信息回填（与下注行同 ref 复用 event_info）
    expect(tx.homeTeam?.iconUrl).toBe("https://cdn.example.com/home.png");
  });

  it("stake_created（event_info=null）→ type=stake + 金额绝对值", () => {
    const tx = ledgerToTx(
      {
        business_type: "stake_created",
        amount: "-10000",
        ref_id: "0xb80e91f4b803670eac57392ab330409a4d8d2d2bfdde047b86392f513f78b692",
        status: 3,
        enable_claim: false,
        event_info: null,
        created_at: "2026-06-05T09:14:26Z",
      },
      null
    );
    expect(tx.type).toBe("stake");
    expect(tx.isPositive).toBe(false);
    expect(tx.amount).toBe("10000");
  });

  it("bet 负数 amount → isPositive = false + 展示绝对值", () => {
    const tx = ledgerToTx(buildBetLedger(), null);
    expect(tx.isPositive).toBe(false);
    expect(tx.amount).toBe("100");
    expect(tx.type).toBe("bet");
    expect(tx.homeTeam?.name).toBe("Argentina");
  });

  it("claim_prize + event_info == null → claim 兜底（DD-087 §4.4）", () => {
    const tx = ledgerToTx(
      {
        business_type: "claim_prize",
        amount: "250",
        ref_id: "claim-001",
        event_info: null,
        created_at: "2026-04-18T11:00:00Z",
      },
      null
    );
    expect(tx.isPositive).toBe(true);
    expect(tx.amount).toBe("250");
    expect(tx.type).toBe("claim");
    expect(tx.homeTeam).toBeUndefined();
    expect(tx.awayTeam).toBeUndefined();
    expect(tx.marketTag).toBeUndefined();
  });

  it("claim_prize + event_info.status=WON → 始终为 claim（不再派生 won）", () => {
    const tx = ledgerToTx(
      {
        business_type: "claim_prize",
        amount: "250",
        ref_id: "claim-002",
        event_info: {
          odd_id: 42,
          stake: "100",
          status: "WON",
          type: "single",
          odds: "2.50",
          payout: "250",
          fixture_name: "Argentina vs Brazil",
          fixture_time: "2026-04-18T10:00:00Z",
          market_type: "Fulltime Result",
          selection: "Home",
        },
        created_at: "2026-04-18T11:00:00Z",
      },
      null
    );
    expect(tx.type).toBe("claim");
    // claim_prize 金额仍取自 ledger.amount（已是结算到账金额），不被 payout 替换
    expect(tx.amount).toBe("250");
    expect(tx.isPositive).toBe(true);
  });

  it("single + WON → 派生 won，金额取 event_info.payout（+ 绿色）", () => {
    const tx = ledgerToTx(
      buildBetLedger({
        amount: "-100",
        event_info: {
          odd_id: 42,
          stake: "100",
          status: "WON",
          type: "single",
          odds: "2.50",
          payout: "250",
          fixture_name: "Argentina vs Brazil",
          fixture_time: "2026-04-18T10:00:00Z",
          market_type: "Fulltime Result",
          selection: "Home",
        },
      }),
      null
    );
    expect(tx.type).toBe("won");
    expect(tx.amount).toBe("250");
    expect(tx.isPositive).toBe(true);
  });

  it("single + LOST → 派生 lost，金额取 event_info.payout（- 红色）", () => {
    const tx = ledgerToTx(
      buildBetLedger({
        amount: "-100",
        event_info: {
          odd_id: 42,
          stake: "100",
          status: "LOST",
          type: "single",
          odds: "2.50",
          payout: "250",
          fixture_name: "Argentina vs Brazil",
          fixture_time: "2026-04-18T10:00:00Z",
          market_type: "Fulltime Result",
          selection: "Home",
        },
      }),
      null
    );
    expect(tx.type).toBe("lost");
    expect(tx.amount).toBe("250");
    expect(tx.isPositive).toBe(false);
  });

  it("parlay + PENDING（未结算）→ 仍为 bet，金额走 ledger.amount", () => {
    const tx = ledgerToTx(
      buildBetLedger({
        business_type: "parlay",
        amount: "-100",
        event_info: {
          odd_id: 42,
          stake: "100",
          status: "PENDING",
          type: "parlay",
          odds: "2.50",
          payout: "250",
          fixture_name: "Argentina vs Brazil",
          fixture_time: "2030-01-01T12:00:00Z",
          market_type: "Fulltime Result",
          selection: "Home",
        },
      }),
      null
    );
    expect(tx.type).toBe("bet");
    expect(tx.amount).toBe("100");
    expect(tx.isPositive).toBe(false);
  });

  it("cancel_bet → cancel（DD-087 §4.4）", () => {
    const tx = ledgerToTx(
      {
        business_type: "cancel_bet",
        amount: "100",
        ref_id: "cancel-001",
        event_info: null,
        created_at: "2026-04-18T11:00:00Z",
      },
      null
    );
    expect(tx.type).toBe("cancel");
  });

  it("withdraw 无 event_info → 无 match 字段", () => {
    const tx = ledgerToTx(
      {
        business_type: "withdraw",
        amount: "-500",
        ref_id: "ORDER-123",
        event_info: null,
        created_at: "2026-04-18T09:00:00Z",
      },
      null
    );
    expect(tx.type).toBe("withdraw");
    expect(tx.isPositive).toBe(false);
    expect(tx.amount).toBe("500");
  });

  it("status 固定 completed（本接口只返回已落账）", () => {
    expect(ledgerToTx(buildBetLedger(), null).status).toBe("completed");
  });

  it("banner_single → 填充 banner.title（market_type 已知）+ home=selection / away=空", () => {
    const tx = ledgerToTx(
      buildBetLedger({
        business_type: "banner_single",
        event_info: {
          odd_id: 99,
          stake: "50",
          status: "PENDING",
          type: "banner_single",
          odds: "11",
          payout: "550",
          fixture_name: "",
          fixture_time: "",
          market_type: "champion_winner",
          selection: "德国",
        },
      }),
      null
    );
    expect(tx.banner).toEqual({
      code: "champion_winner",
      title: "2026 FIFA World Cup Winner",
    });
    expect(tx.homeTeam?.name).toBe("德国");
    expect(tx.awayTeam?.name).toBe("");
  });

  it("banner_single market_type 未识别 → banner.title 回退 selection", () => {
    const tx = ledgerToTx(
      buildBetLedger({
        business_type: "banner_single",
        event_info: {
          odd_id: 99,
          stake: "50",
          status: "PENDING",
          type: "banner_single",
          odds: "5",
          payout: "250",
          fixture_name: "",
          fixture_time: "",
          market_type: "unknown_banner",
          selection: "Brazil",
        },
      }),
      null
    );
    expect(tx.banner).toEqual({ code: "unknown_banner", title: "Brazil" });
  });

  it("非 banner 流水 → banner = undefined", () => {
    const tx = ledgerToTx(buildBetLedger(), null);
    expect(tx.banner).toBeUndefined();
  });

  it("id 拼接 ref_id + business_type + created_at 兜底唯一性", () => {
    const tx = ledgerToTx(
      {
        business_type: "withdraw",
        amount: "-100",
        event_info: null,
        created_at: "2026-04-18T09:00:00Z",
      },
      null
    );
    expect(tx.id).toBe("no-ref-withdraw-2026-04-18T09:00:00Z");
  });
});
