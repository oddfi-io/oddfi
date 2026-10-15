/**
 * 投注业务常量
 *
 * 与合约 `src/shared/constants/BettingConstants.sol` 同步：
 *   `MIN_BET_AMOUNT = 100 * ODD_WAD`
 *
 * 单位：ODD（不是 wei）。所有 UI 校验以 ODD 为基准。
 *
 * V1 中心化下注由后端校验；V2 / testnet onchain 走合约，
 * 合约会以 `BetAmountBelowMinimum(amount, minimum)` 直接 revert。
 * 前端做一致校验，避免上链才发现失败。
 *
 * 该常量改动概率低（需合约重部署），暂不接入"读链/读后端"动态获取。
 */
import { div, isGt, isValidAmount } from "@/lib/decimal";

export const MIN_BET_ODD = 100;

/**
 * 用户下注滑点容忍（万分位整数），DD-117 §3.4。
 *
 * 默认 100 = 1%，与合约 `_validateBetLimits` 中的 1% drift 同量级。
 * 用户在 BetSettings Preferences 中可调（0/0.5/1/2/5%）；当前未挂 UI，
 * 全局走默认值。挂 UI 后通过 store 注入到 BetSummary。
 */
export const USER_SLIPPAGE_BPS_DEFAULT = 100;

/**
 * 测试赛事 fixture id 集合。
 *
 * 这些赛事即使在 testnet 也强制走中心化 placeBet（链下），不走 onchain BettingPool。
 * 用途：QA / 演示场景需要在不依赖合约市场配置的情况下走完完整下注/结算流程。
 */
export const TEST_FIXTURE_IDS: ReadonlySet<number> = new Set([99200001]);

export function isTestFixtureId(fixtureId: number): boolean {
  return TEST_FIXTURE_IDS.has(fixtureId);
}

/**
 * 链上测试赛事 fixture id 区间（DD-138 · 后端 onchain_test_fixtures 接口）。
 *
 * fixture_id = base(99301/99302) × 10^10 + round_start_unix，每 10 分钟一轮滚动。
 * 区间两端均为安全整数（≈9.93e14 < 2^53）。
 *
 * ⚠️ 与 TEST_FIXTURE_IDS 语义相反：链上测试赛事在 testnet 必须走 onchain
 * BettingPool（approve / place_bet / claim_payout 链上闭环验收），
 * **不得**加入 TEST_FIXTURE_IDS（那会强制改走中心化 placeBet）。
 */
export const ONCHAIN_TEST_FIXTURE_ID_MIN = 99301e10;
/** exclusive 上界（覆盖 base 99301 / 99302 两个系列） */
export const ONCHAIN_TEST_FIXTURE_ID_MAX = 99303e10;

export function isOnchainTestFixture(fixtureId: number): boolean {
  return fixtureId >= ONCHAIN_TEST_FIXTURE_ID_MIN && fixtureId < ONCHAIN_TEST_FIXTURE_ID_MAX;
}

/**
 * 是否为任意测试赛事（链上测试 99301/99302 系 **或** 演示测试 99200001）。
 * 市场页「测试」分组统一归类入口——两个口径合一只此一处，避免分桶 / 完整性判定
 * 多处各写 `isOnchainTestFixture || isTestFixtureId` 产生漂移。
 */
export function isAnyTestFixture(fixtureId: number): boolean {
  return isOnchainTestFixture(fixtureId) || isTestFixtureId(fixtureId);
}

/**
 * 把"用户输入金额"（可能是 USD 也可能是 ODD）折算成 ODD。
 *
 * 合约校验在 ODD 维度，UI 同步校验（BetCard 红边 / BetSummary 按钮 disable）
 * 必须用同一份折算逻辑——故抽到这里集中维护。两处独立写 `div(amount, rate)`
 * 在未来 fee/slippage 调整时容易漂移导致 UI 不一致（REV-feat-bet-min-amount M-01）。
 *
 * 规则：
 * - `canConvert=true` 且 `rate` 非空 → div(amount, rate)
 * - 其他情况（ODD 模式 / rate 未加载）→ 返回 amount 原值
 * - amount 为空时返回 "0"（避免下游 isValidAmount 误判）
 */
export function toOddAmount(
  userAmount: string | undefined | null,
  canConvert: boolean,
  rate: string | null | undefined
): string {
  const v = userAmount || "0";
  if (canConvert && rate) return div(v, rate);
  return v;
}

/**
 * 判断"已折算为 ODD"的投注金额是否落在 `(0, MIN_BET_ODD)` 区间。
 *
 * 不处理货币换算 —— 调用方负责把 USD/CNY 等显示币种先转回 ODD。
 * 空串 / 非法字符串 / "0" 都返回 false（不算"低于最低"，由"金额为空"分支拦截）。
 */
export function isStakeBelowMin(stakeOdd: string | undefined | null): boolean {
  if (!stakeOdd || !isValidAmount(stakeOdd)) return false;
  return isGt(stakeOdd, "0") && isGt(String(MIN_BET_ODD), stakeOdd);
}
