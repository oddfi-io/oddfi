import { describe, it, expect } from "vitest";
import { assemblePoolsData } from "./useLiquidityFeaturedPools";
import { LP_POSITION_STATE } from "@/lib/abi/liquidityPool";
import type { LpPositionData } from "./useLpPositions";
import type { LiquidityMatchPool } from "@/types/onchain-liquidity";

const NOW_SEC = 1762000000n;

function pool(over: Partial<LiquidityMatchPool>): LiquidityMatchPool {
  return {
    pool_id: "42",
    match_id: "0x00000000000000000000000000000000000000000000000000000000000000ab",
    fixture_id: 100,
    fixture_name: "Real Madrid vs Man City",
    home_team_logo: "https://cdn/home.png",
    away_team_logo: "https://cdn/away.png",
    match_start_time: 1762800000,
    match_end_time: 1762810000,
    deposit_close_at: Number(NOW_SEC) + 3600,
    min_deposit_wei: "1000000000000000000000",
    min_deposit_odd: "1000",
    total_deposited_wei: "3000000000000000000000",
    total_deposited_odd: "3000",
    total_bet_wei: "16500000000000000000000",
    total_bet_odd: "16500",
    ...over,
  };
}

function pos(over: Partial<LpPositionData>): LpPositionData {
  return {
    positionId: 1n,
    poolId: 42n,
    principal: 100n,
    weight: 0n,
    unlockAt: 0n,
    planId: 0,
    state: LP_POSITION_STATE.Active,
    poolType: "match",
    matchId: "0x00000000000000000000000000000000000000000000000000000000000000ab",
    ...over,
  };
}

describe("assemblePoolsData (REQ-004 后端驱动)", () => {
  it("映射后端 total_deposited_wei / total_bet_wei + canDeposit=true（now < deposit_close_at）", () => {
    const [r] = assemblePoolsData([pool({})], [], NOW_SEC);
    expect(r.poolId).toBe(42n);
    expect(r.matchId).toBe(pool({}).match_id);
    expect(r.match).toBe("Real Madrid vs Man City");
    expect(r.homeTeamLogo).toBe("https://cdn/home.png");
    expect(r.totalDeposited).toBe(3_000_000_000_000_000_000_000n); // 后端 total_deposited_wei
    expect(r.totalBet).toBe(16_500_000_000_000_000_000_000n); // 后端 total_bet_wei（总下注量）
    expect(r.canDeposit).toBe(true);
    expect(r.depositOpen).toBe(true);
  });

  it("后端缺数据返回 '0' → totalDeposited / totalBet 为 0n", () => {
    const [r] = assemblePoolsData(
      [pool({ total_deposited_wei: "0", total_bet_wei: "0" })],
      [],
      NOW_SEC
    );
    expect(r.totalDeposited).toBe(0n);
    expect(r.totalBet).toBe(0n);
  });

  it("缺省字段（旧缓存无 total_*_wei）兜底 0n 不抛错", () => {
    const raw = pool({});
    // 模拟后端旧响应未带新字段
    delete (raw as Partial<LiquidityMatchPool>).total_deposited_wei;
    delete (raw as Partial<LiquidityMatchPool>).total_bet_wei;
    const [r] = assemblePoolsData([raw], [], NOW_SEC);
    expect(r.totalDeposited).toBe(0n);
    expect(r.totalBet).toBe(0n);
  });

  it("canDeposit=false 当 now ≥ deposit_close_at", () => {
    const [r] = assemblePoolsData([pool({ deposit_close_at: Number(NOW_SEC) - 1 })], [], NOW_SEC);
    expect(r.canDeposit).toBe(false);
  });

  it("myBalance: 该 poolId 非终态仓位 principal 累加", () => {
    const positions = [
      pos({ positionId: 1n, poolId: 42n, principal: 100n }),
      pos({ positionId: 2n, poolId: 42n, principal: 50n }),
      pos({ positionId: 3n, poolId: 43n, principal: 999n }),
    ];
    const [r] = assemblePoolsData([pool({})], positions, NOW_SEC);
    expect(r.myBalance).toBe(150n);
  });

  it("myBalance: Withdrawn/Liquidated 不计入", () => {
    const positions = [
      pos({ positionId: 1n, principal: 100n, state: LP_POSITION_STATE.Withdrawn }),
      pos({ positionId: 2n, principal: 200n, state: LP_POSITION_STATE.Liquidated }),
      pos({ positionId: 3n, principal: 50n, state: LP_POSITION_STATE.Active }),
    ];
    const [r] = assemblePoolsData([pool({})], positions, NOW_SEC);
    expect(r.myBalance).toBe(50n);
  });

  it("hot=true 仅前 3 条", () => {
    const pools = [
      pool({ pool_id: "1" }),
      pool({ pool_id: "2" }),
      pool({ pool_id: "3" }),
      pool({ pool_id: "4" }),
      pool({ pool_id: "5" }),
    ];
    const result = assemblePoolsData(pools, [], NOW_SEC);
    expect(result.map((p) => p.hot)).toEqual([true, true, true, false, false]);
  });

  it("fixture_name 缺失 → match 回落到 matchId", () => {
    const [r] = assemblePoolsData(
      [pool({ fixture_name: "", home_team_logo: undefined, away_team_logo: undefined })],
      [],
      NOW_SEC
    );
    expect(r.match).toBe(pool({}).match_id);
    expect(r.homeTeamLogo).toBe("");
    expect(r.awayTeamLogo).toBe("");
  });
});
