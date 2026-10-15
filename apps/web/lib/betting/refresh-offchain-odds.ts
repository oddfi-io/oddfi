/**
 * BUG-022：中心化下注提交前，用最新 SportMonks 赔率刷新投注单快照。
 *
 * 背景：betSlipStore 里的 `selection.odds` 是加入瞬间的快照，加入后永不更新
 * （stores/betSlipStore.ts addSelection）。中心化 `placeBet` 直接把该快照作为
 * ClientOdds 发后端，后端按 |server-client| > 0.05 绝对阈值判 ODDS_CHANGED
 * （oddfi-odds-engine/internal/odds.go:228,249）。久置漂移破阈 → 拒单；用户"删除卡片
 * 再重新添加"之所以能恢复，正是因为重加时从当前行情 entry.value 重新构造了快照。
 *
 * 本 helper = 把"删除重加"程序化：提交前按 fixture 重新拉 `/v1/detail/fixture/:id?type=statis`
 * （make1x2Sel 当初读 entry.value 的同一来源、同口径——快照来自 MatchDetailPanel/BetCard 的
 * `"statis"` fetch，"preview" 不带 odds 数组，故此处必须 statis），按 oddId 找最新 value。
 *
 * 注意：链上 quoted_odds（WCL 压缩口径）≠ SportMonks 口径，故此处只用于中心化路径，
 * 不能用 onchainOddsStore 的实时值覆盖（口径不匹配会被后端用另一个理由拒）。
 *
 * 取不到（网络失败 / oddId 已下架）→ 该项不在返回 Map 中，调用方回退快照（零 regression）。
 */

import { getMarketFixtureDetail } from "@/lib/api";
import type { BetSelection } from "@/types/betting";

export interface RefreshOffchainOddsDeps {
  getMarketFixtureDetail: typeof getMarketFixtureDetail;
}

const defaultDeps: RefreshOffchainOddsDeps = { getMarketFixtureDetail };

/**
 * 按 fixtureId 去重拉取最新赔率，返回 `selectionId -> 最新赔率字符串` 的 Map。
 * 仅包含成功刷新到的项；缺失项由调用方回退快照。
 */
export async function refreshOffchainOdds(
  selections: BetSelection[],
  deps: RefreshOffchainOddsDeps = defaultDeps
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (selections.length === 0) return result;

  const fixtureIds = [...new Set(selections.map((s) => s.fixtureId))];

  // fixtureId -> (oddId -> 最新 value)
  const byFixture = new Map<number, Map<number, string>>();
  await Promise.all(
    fixtureIds.map(async (fid) => {
      try {
        // type=statis 才返回 odds 数组（与快照源 BetCard/MatchDetailPanel 同口径）
        const fixtures = await deps.getMarketFixtureDetail(fid, "statis");
        const fixture = fixtures.find((f) => f.id === fid);
        if (!fixture?.odds) return;
        const oddMap = new Map<number, string>();
        for (const entry of fixture.odds) {
          if (typeof entry.value === "string" && entry.value !== "") {
            oddMap.set(entry.id, entry.value);
          }
        }
        byFixture.set(fid, oddMap);
      } catch (e) {
        // 外部网络不确定性：该 fixture 刷新失败 → 不写入，调用方回退快照
        console.warn(`[refreshOffchainOdds] Failed to refresh odds for fixture ${fid}`, e);
      }
    })
  );

  for (const sel of selections) {
    const fresh = byFixture.get(sel.fixtureId)?.get(sel.oddId);
    if (fresh != null) result.set(sel.id, fresh);
  }
  return result;
}
