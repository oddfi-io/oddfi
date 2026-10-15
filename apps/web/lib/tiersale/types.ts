/**
 * DD-146 TierSale 公开发售数据契约。
 *
 * 后端：oddfi-web-api dev 分支（handler/onchain.go + service/tiersale_estimate.go）。
 * 合约：TierSale（BSC Mainnet 0x6FF56E20308647868811089906687fB7706d6517）。
 * 契约权威：Lark《【接口文档】预售接口》(contracts-business-layer v0.9.7)。
 *
 * 金额约定：
 * - `usdt_amount` / `usdt_cost` / `odd_amount` / `budget_left` 为人类可读十进制字符串（非 wei）。
 * - `*_wei` 后缀字段为最小单位字符串（18 位精度）。
 * 一律字符串承接，禁止原生 float（api-conventions.md §金额）。
 */

/** POST /account/onchain/tiersale/estimate 入参（只读预估，按链上实时阶梯定价）。 */
export interface TierSaleEstimateReq {
  /** 计划投入的 USDT 金额，人类可读十进制字符串（如 "100"）。 */
  usdt_amount: string;
}

/**
 * POST /account/onchain/tiersale/estimate 返回。
 *
 * 关键语义（已逐条核对 Lark 文档 / DD §2.1）：
 * - `odd_amount === "0"` → 售罄 / 预算太小，禁用购买。
 * - `capped_by_sale === true` → 预算没花完（剩余阶梯不足），`budget_left > 0`。
 * - `crosses_tier === true` → 本次买入跨越多个档位（start_tier..end_tier）。
 * 字段顺序与后端 TierSaleEstimateResponse 逐字一致。
 */
export interface TierSaleEstimateRes {
  /** 预计获得 ODD，人类可读十进制串；"0" = 售罄 / 预算太小。 */
  odd_amount: string;
  /** 预计获得 ODD，wei（18 位）—— buy 入参取此值。 */
  odd_amount_wei: string;
  /** 实际花费 USDT，人类可读十进制串；capped_by_sale 时 < 输入 usdt_amount。 */
  usdt_cost: string;
  /** 未花完的 USDT 预算，人类可读十进制串。 */
  budget_left: string;
  /** 起始档位 1~10。 */
  start_tier: number;
  /** 结束档位 1~10。 */
  end_tier: number;
  /** 本次买入是否跨档。 */
  crosses_tier: boolean;
  /** 是否因售罄 / 剩余不足被限额（预算没花完）。 */
  capped_by_sale: boolean;
}

/**
 * POST /account/onchain/tiersale/buy 入参。
 *
 * ⚠️ 入参是 **ODD 数量**（`odd_amount_wei`，取 estimate 返回的 `odd_amount_wei`），
 * 不是 USDT。USDT 由合约 transferFrom 按档位定价扣除。
 *
 * `nonce`：幂等键（UUID v4）。后端按 `odd_amount_wei + nonce` 派生定长去重键。
 * 一次购买意图锁定，retry（含 503 / 超时重发）复用同值；仅用户显式新购买才换新。
 */
export interface TierSaleBuyReq {
  /** 购买 ODD 数量，wei（18 位）—— 来自 estimate 的 odd_amount_wei。 */
  odd_amount_wei: string;
  /** 幂等 nonce（UUID v4）。 */
  nonce: string;
}
