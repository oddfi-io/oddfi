import type { BetSelection } from "@/types/betting";
import { useMarketsLayoutStore } from "@/stores/marketsLayoutStore";
import { runBetClick } from "@/hooks/useBetSelectionToggle";

/**
 * 创建赔率按钮点击处理器（markets / match-detail 共用）
 *
 * 核心动画+状态逻辑已抽至 `runBetClick` (hooks/useBetSelectionToggle.ts)，
 * 此函数在其上叠加 markets 页专属副作用：联动 selectedFixture。
 *
 * 兼容历史签名：`toggleSelection` 参数保留以减少调用方改动，
 * 内部不再使用 — runBetClick 通过 store.getState() 直接拿当前 store。
 */
export function handleOddsClickAction(
  e: React.MouseEvent,
  sel: BetSelection,
  fixtureId: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _toggleSelection: (sel: BetSelection) => void,
  /** 赛事级禁投开关（DD-087 §4.1）；false 时 store 层拒绝加入并 toast */
  enableBet = true
) {
  runBetClick(e, sel, "toggle", enableBet);

  // markets 页专属：选中后联动右侧 fixture detail
  const { selectedFixtureId, selectFixture } = useMarketsLayoutStore.getState();
  if (selectedFixtureId !== null && selectedFixtureId !== fixtureId) {
    selectFixture(fixtureId);
  }
}
