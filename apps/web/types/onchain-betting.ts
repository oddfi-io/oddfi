/**
 * DD-105 链上下注数据契约
 *
 * 后端：oddfi-web-api dev 分支 ded4dc0
 * 合约：BettingPool (BSC Testnet 0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F)
 *
 * 所有金额字段为 ODD wei 字符串（1e18 精度）。
 * 所有 odds 为万分位整数字符串（10100 = 1.01）。
 */

export type OnchainMarketStatus = "OPENED" | "LOCKED" | "SETTLED" | (string & {});

/**
 * 后端 onchain `bet_market` 玩法标识（0528 发版）。
 * `(string & {})` 逃生阀：后端新增玩法时不破坏既有类型推断。
 * 前后端术语映射见 CONTEXT.md §2「前后端命名映射」。
 */
export type OnchainBetMarket =
  | "fulltime_result"
  | "asian_handicap"
  | "asian_over_under"
  | (string & {});

export interface OnchainMarket {
  fixture_id: number;
  match_id: string; // 0x...
  market_id: string; // 0x...
  /** 0=1X2, 1=亚让, 2=大小 */
  market_type: number;
  /**
   * ⚠️ 合约 line 编号 0-9（uint8 lineID），不是 basis points 也不是业务线值。
   * AH: 0=-0.5, 1=-1, 2=-1.5, 3=-0.25, 4=-0.75, 5=-1.25, 6=+0, 7=+0.25, 8=+0.5, 9=+0.75
   * OU: 0=1.5, 1=2.5, 2=3.5
   * 不要用于前端匹配 — 用 line_value 字符串等价（见 DD-124 / DD-118）。
   * 透传给 placeBet 时仍是该字段。
   */
  line: number;
  /** 万分位整数；下标按 market_type 语义见 oddfi-ODD api.md §3.2 */
  base_odds: number[];
  /**
   * DD-119 — WCL 压缩/上浮后的展示赔率（万分位整数），下标与 base_odds 同序。
   * 后端 5/30 起返回；刚开盘无快照时后端用 base_odds 兜底填充，前端优先读它。
   * 可选：旧后端 / 老缓存可能缺失。
   */
  quoted_odds?: number[];
  /**
   * DD-119 — 链上信号灯：0=绿 / 1=黄 / 2=橙 / 3=红。来自合约 OddsUpdated 快照，
   * 前端禁止用 base_odds 自行推导。可选：后端 `*uint8 + omitempty`，缺失即无信号。
   */
  signal?: SignalLevel;
  status: OnchainMarketStatus;
  quote_version: number;
  /**
   * DD-118 line 字段语义对齐（防御性 forward-compat，optional 兼容老 API）。
   *
   * 后端的 `line` 字段是合约 uint8 lineID（0/1/2 三档索引），不是实际盘口值，
   * 与前端从 SportMonks 拿到的盘口字符串无法直接匹配。后端发版补此字段后会返回
   * SportMonks 原始 line 字符串（如 "-0.5" / "2.5"），前端用它精确匹配。
   *
   * - 字段缺失时（旧后端 / dev_0521 当前部署） → 前端 AH/Total 优雅回退到 REST 不订阅
   * - 字段存在时 → 前端自动启用 AH/Total live odds，无需前端发版
   *
   * 详见 `.progress/stash/backend-req-onchain-market-line-encoding.md`。
   */
  line_value?: string;
}

export interface OnchainMarketRes {
  fixture_id: number;
  markets: OnchainMarket[];
}

/**
 * 后端 approve 白名单用途（onchain_tx.go ApproveTarget*）；后端据此映射协议合约地址，前端不再传裸 spender（DD-127）。
 * `"tiersale"`（DD-146）：授权 **USDT** 给 TierSale 合约（其余 target 授权的是 ODD）。后端 ApproveTargetTierSale 已接受。
 */
export type ApproveTarget = "liquidity" | "betting" | "staking" | "tiersale";

export interface OnchainApproveReq {
  /** 授权用途；下注固定 "betting"。后端 approveSpenderByTarget 解析为 BettingPool 地址（DD-127）。 */
  target: ApproveTarget;
  /** ODD wei string；下注税 1%，授权额必须 ≥ stake × 1.01 */
  amount_wei: string;
}

export interface OnchainPlaceBetReq {
  match_id: string;
  market_type: number;
  line: number;
  /** market_type=0 时：0=主胜,1=平局,2=客胜 */
  outcome: number;
  amount_wei: string;
  min_accepted_amount_wei: string;
  /** 万分位整数字符串，下限滑点 */
  min_odds: string;
  /** 必须等到 receipt status=success 的 approve tx_hash */
  approve_tx_hash: string;
  /** DD-141 — 随机幂等 nonce（UUID v4，max 64）。一次点击一个、retry 复用、新点击重生成。后端据此区分网络重试 vs 用户再次下注。 */
  nonce: string;
}

export interface OnchainClaimPayoutReq {
  /** 后端 chainclient.ParseBetID 接受 0x 前缀或裸 64 位 hex，前端透传 */
  bet_id: string;
}

/**
 * POST /account/onchain/cash_out 入参（DD-137 · oddfi-backend@dev onchain_tx.go:232）。
 *
 * 与 claim_payout 的关键差异：**前端不传 idempotency_key** —— 一笔注单只能兑现一次，
 * 服务端直接用规范化 onchain_bet_id 作幂等键（重复点击/重试天然去重）。
 * deadline 同样不传，后端统一给 5 分钟窗口（真正卡时间的是合约 30s 报价 TTL）。
 */
export interface OnchainCashOutReq {
  /** 链上 betId（0x 前缀或裸 64 位 hex），= LedgerRecord.bet_id（事件索引回填后才有） */
  bet_id: string;
  /** 用户看到的报价版本号 = getMarketOdds(marketId).quoteVersion，十进制整数字符串；陈旧报价合约 revert QuoteVersionMismatch */
  expected_quote_version: string;
  /** 前端生成兑现报价的时间戳（unix 秒）；合约强制 30s TTL：quoted_at <= block.timestamp <= quoted_at + 30s */
  quoted_at: number;
  /** 用户可接受的最低兑现额，**人类可读 ODD 非 wei**（如 "10.5"）；缺省 "0" 不设滑点下限，合约自身另有硬下限 >= 10 ODD */
  min_amount_out?: string;
}

/** 所有 onchain 写操作的统一响应 data */
export interface OnchainTxRes {
  order_id: number;
  tx_hash: string;
  action_id: number;
  idempotency_key: string;
  /** 后端 949a5f3：claim_payout 同步回显 bet_id；其它 op 不返回 */
  bet_id?: string;
}

/**
 * GET /account/onchain/orders/:id 响应 data（oddfi-backend@dev 949a5f3）。
 *
 * 关键字段：
 * - `bet_id` 由事件索引服务异步回填，回填前为空字符串
 * - `bet_ready` = 是否可作为 claim_payout 的 bet_id 入参（true 才能领奖）
 *
 * 用途：place_bet 拿到 order_id 后轮询本接口，直到 bet_ready=true 再触发 claim。
 */
export interface OnchainOrderResponse {
  order_id: number;
  user_id: number;
  /** "approve" | "place_bet" | "claim_payout" | "deposit_global" | "deposit_match" | ... */
  op: string;
  status: string;
  tx_hash: string;
  action_id?: number;
  idempotency_key: string;
  match_id?: string;
  market_type?: number;
  line?: number;
  outcome?: number;
  amount_wei?: string;
  /** ODD wei string — 链上实际接受的本金（部分成交时 < amount_wei）；事件索引回填后才有（DD-137） */
  accepted_amount?: string;
  /** 万分位整数字符串 — 下注时合约锁定的赔率（如 "23500" = 2.35）；事件索引回填后才有（DD-137） */
  locked_odds?: string;
  /** ODD wei string — 部分成交退回的未成交金额；全额成交为 "0" / 空（DD-137） */
  refund_amount?: string;
  /** 是否部分成交（DD-137） */
  partial_fill?: boolean;
  /** place_bet 订单：事件索引回填后非空；其它 op 始终为空 */
  bet_id?: string;
  /** 关键就绪标记：true 表示 claim_payout 可用 bet_id 作为入参 */
  bet_ready: boolean;
  created_at: string;
  updated_at: string;
}

// ─── DD-117 信号灯预览（POST /market/{marketId}/preview-signal） ───────────────

export interface PreviewSignalReq {
  /** 0/1/2，按 market_type 语义；后端 gin binding 强制 max=2 */
  outcome: number;
  /** ODD wei 十进制大整数字符串，必须 > 0 */
  requestedAmount: string;
}

/** 0=Green / 1=Yellow / 2=Orange / 3=Red — 与合约 BettingPool.previewSignal 对齐 */
export type SignalLevel = 0 | 1 | 2 | 3;

export interface PreviewSignalRes {
  signal: SignalLevel;
  /** ODD wei string — 当前金额下合约实际可接受额 */
  acceptedAmount: string;
  /** 万分位整数字符串 — 锁价回显；degraded=true 时为 "0" */
  lockedOdds: string;
  partialFill: boolean;
  /** ODD wei string — 该 outcome 当前最大可下注额；degraded=true 时为 "0" */
  maxAcceptableAmount: string;
  /** 大整数字符串（big.Int.String）；与 OnchainMarket.quote_version 是同一逻辑值，比较时统一用 BigInt() */
  quoteVersion: string;
  /** 后端 Redis 缓存命中时间戳（秒），debug 用 */
  cachedAt: number;
  /** 后端 Redis 缓存 TTL（毫秒），debug 用 */
  cacheTtlMs: number;
  /** RPC 失败兜底；前端必须显式识别并走 fallback 路径（不能用 lockedOdds） */
  degraded?: boolean;
}
