/**
 * DD-140 — BetSelection + 下注参数 → 乐观 PortfolioBet（MyBetCard 直接渲染）。
 *
 * 链上 place_bet relay 返回 200 后，用此 adapter 把投注车选项即时转成展示态 PortfolioBet
 * 插入 pendingOnchainBetsStore，MyBets 立即可见。乐观卡为短时态（~10s 后被后端
 * portfolio history 权威数据替换）：
 *   - 队徽用占位图（BetSelection 不携带队徽 URL）
 *   - USD 孪生额按显示汇率换算（无汇率回退 ODD 值）
 *   - potentialWin = stake × 锁定赔率（decimal.mul，禁原生浮点）
 *   - settlementStatus 固定 "pending"（待结算），cashoutAvailable=false（未确认不可兑现）
 */
import type { BetSelection } from "@/types/betting";
import type { PortfolioBet } from "@/types/portfolio";
import { parseFixtureName } from "@/lib/format/fixture";
import { mul, convertOdd } from "@/lib/decimal";

/** BetSelection 不带队徽 → 占位图（设计师导出，static-assets.md placeholder 目录） */
const TEAM_ICON_PLACEHOLDER = "/images/placeholder/team-default.svg";

export interface PendingBetDisplayInput {
  selection: BetSelection;
  /** 下注本金（ODD decimal 字符串） */
  stakeOdd: string;
  /** ODD→USD 显示换算汇率（null=无汇率，USD 字段回退 ODD 原值）；来自 useCurrencyDisplay.rate */
  rate: string | null;
  /** 当前时间戳 ms（调用方传 Date.now()，便于测试注入） */
  now: number;
}

export function buildPendingPortfolioBet(input: PendingBetDisplayInput): PortfolioBet {
  const { selection, stakeOdd, rate, now } = input;
  const { home, away } = parseFixtureName(selection.fixtureName);
  const potentialWin = mul(stakeOdd, selection.odds);

  return {
    id: `pending-${selection.id}`,
    isOnchain: true,
    // 队徽优先用选注携带的赛事卡资源（participants[].image_path），缺省回退占位图
    homeTeam: { name: home, iconUrl: selection.homeLogo || TEAM_ICON_PLACEHOLDER },
    awayTeam: { name: away, iconUrl: selection.awayLogo || TEAM_ICON_PLACEHOLDER },
    leagueTag: selection.leagueName,
    marketTag: selection.marketDescription,
    selectionTag: selection.displayLabel,
    betAmount: stakeOdd,
    betAmountUsd: convertOdd(stakeOdd, rate),
    potentialWin,
    potentialWinUsd: convertOdd(potentialWin, rate),
    odds: selection.odds,
    matchStatus: "upcoming",
    settlementStatus: "pending",
    cashoutAvailable: false,
    matchTime: "",
    createdAt: new Date(now).toISOString(),
  };
}
