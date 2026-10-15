import { describe, it, expect } from "vitest";
import { mapLpPosition, derivePoolDisplay } from "./useLpPositions";
import { LP_POSITION_STATE } from "@/lib/abi/liquidityPool";
import type { LiquidityPositionItem } from "@/types/onchain-liquidity";

function item(over: Partial<LiquidityPositionItem>): LiquidityPositionItem {
  return {
    position_id: "65",
    pool_type: "global",
    plan_id: 0,
    amount_wei: "1000000000000000000000",
    amount_odd: "1000",
    status: "locked",
    start_time: 1_779_970_000,
    unlock_at: 1_779_978_860,
    unbond_at: 0,
    withdrawable_at: 0,
    withdrawn_at: 0,
    net_pnl_wei: "",
    tx_hash: "0xabc",
    ...over,
  };
}

describe("mapLpPosition", () => {
  it("maps global position with bigint conversions", () => {
    const p = mapLpPosition(item({}));
    expect(p).toEqual({
      positionId: 65n,
      poolId: 0n,
      principal: 1000000000000000000000n,
      weight: 0n,
      unlockAt: 1779978860n,
      planId: 0,
      state: LP_POSITION_STATE.Active, // locked → Active
      poolType: "global",
      matchId: undefined,
      fixtureName: undefined,
      homeTeamLogo: undefined,
      awayTeamLogo: undefined,
      matchStartTime: undefined,
    });
  });

  it("match pool → poolId = BigInt(match_id)", () => {
    const p = mapLpPosition(item({ pool_type: "match", match_id: "0x6a185104" }));
    expect(p.poolId).toBe(BigInt("0x6a185104"));
  });

  it("match pool 保留 poolType/matchId + 赛事四件套（后端回填时）", () => {
    const p = mapLpPosition(
      item({
        pool_type: "match",
        match_id: "0x6a185104",
        fixture_id: 19155555,
        fixture_name: "Mexico vs South Africa",
        home_team_logo: "https://cdn.example.com/mex.png",
        away_team_logo: "https://cdn.example.com/rsa.png",
        match_start_time: 1_781_204_400,
      })
    );
    expect(p.poolType).toBe("match");
    expect(p.matchId).toBe("0x6a185104");
    expect(p.fixtureName).toBe("Mexico vs South Africa");
    expect(p.homeTeamLogo).toBe("https://cdn.example.com/mex.png");
    expect(p.awayTeamLogo).toBe("https://cdn.example.com/rsa.png");
    expect(p.matchStartTime).toBe(1_781_204_400);
  });

  it("match pool spider 数据缺失 → 四件套 undefined 但 poolType 仍是 match（禁止用展示信息推断类型）", () => {
    const p = mapLpPosition(item({ pool_type: "match", match_id: "0x6a185104" }));
    expect(p.poolType).toBe("match");
    expect(p.fixtureName).toBeUndefined();
    expect(p.matchStartTime).toBeUndefined();
  });

  describe("derivePoolDisplay（PositionRow/PositionCard 共用三态）", () => {
    const GLOBAL_LABEL = "All Match Pools"; // 组件实际传 t("allPoolsTitle")

    it("global → 调用方传入的 All Match Pools 文案 + #positionId（不再显示 Plan #N）", () => {
      const d = derivePoolDisplay(mapLpPosition(item({ plan_id: 2 })), GLOBAL_LABEL);
      expect(d).toEqual({ isMatch: false, title: "All Match Pools", subline: "#65" });
    });

    it("match 有四件套 → 比赛名 + #id · 开赛时间", () => {
      const d = derivePoolDisplay(
        mapLpPosition(
          item({
            pool_type: "match",
            match_id: "0x6a185104",
            fixture_name: "Mexico vs South Africa",
            match_start_time: 1_781_204_400,
          })
        ),
        GLOBAL_LABEL
      );
      expect(d.isMatch).toBe(true);
      expect(d.title).toBe("Mexico vs South Africa");
      expect(d.subline).toMatch(/^#65 · /);
    });

    it("match spider 缺失 → fallback match_id 截断串，绝不显示 global 文案", () => {
      const d = derivePoolDisplay(
        mapLpPosition(
          item({
            pool_type: "match",
            match_id: "0x2f99e260c8a47b909f82a85bcb2c2b80f7331f7595166b4e08aac4b22bf6",
          })
        ),
        GLOBAL_LABEL
      );
      expect(d.isMatch).toBe(true);
      expect(d.title).toBe("0x2f99...2bf6");
      expect(d.title).not.toBe(GLOBAL_LABEL);
      expect(d.subline).toBe("#65");
    });
  });

  it.each([
    ["locked", LP_POSITION_STATE.Active],
    ["redeemable", LP_POSITION_STATE.Ready],
    ["unbonding", LP_POSITION_STATE.Unbonding],
    ["withdrawable", LP_POSITION_STATE.Withdrawable],
    ["withdrawn", LP_POSITION_STATE.Withdrawn],
    ["liquidated", LP_POSITION_STATE.Liquidated],
  ] as const)("status %s → state enum %d", (status, expected) => {
    expect(mapLpPosition(item({ status })).state).toBe(expected);
  });
});
