/**
 * DD-104: MoneylinePanel 专用 teaser 统计数据（迁出自 lib/moneyline-mocks.ts）。
 *
 * 后端不返回 teaserStats，由前端本地保留（AI hint 统计数值）。
 * MoneylinePanel 改为从此模块导入，不再依赖 lib/moneyline-mocks.ts。
 * Batch 7 删除 lib/moneyline-mocks.ts 时此文件继续存在。
 */

import type { TeaserStats } from "@/types/moneyline";

export const teaserStatsMock: TeaserStats = {
  teamCode: "MCI",
  userBetPct: 48,
  impliedPct: 20,
  odds: "2.25",
};
