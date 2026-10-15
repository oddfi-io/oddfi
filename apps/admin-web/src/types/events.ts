// 赛事风险（DD002 信号灯）类型定义。
// 契约：admin-backend docs/dd002-risk-signal/DD.md §3.3（docs/api.md §3.12 落地前以方案为准）。
// 铁律：ID 全链路 string（后端 int64 带 ,string 序列化），前端不做 Number() 转换；
//       金额一律 string（shopspring/decimal），展示走 AmountText，禁 parseFloat。

// 信号灯四色（后端 uint8 → 字符串枚举序列化；判级只在 web-api，一端实现，前端零判级）。
export type Signal = "green" | "yellow" | "orange" | "red";

// 赛事状态（列表筛选 Tab：进行中/待开始/已结算）。
export type EventStatus = "active" | "pending" | "settled";

// 红灯人工决策动作：恢复开盘 / 维持停单。
export type RiskDecisionAction = "approve_continue" | "stop";

// 终场比分（api.md §3.12：仅 settled 非空；OPS-01d 前真上游恒 null）。
// 联调 A 实测（2026-06-06）：对象形态非字符串，直接渲染会崩 React 树。
export interface EventScore {
  home: number;
  away: number;
}

// 时间四点。settle 数据源未落库（D6 null 组）→ null，前端显示「—」。
export interface EventTimes {
  open: string | null;
  lock: string | null;
  kickoff: string | null;
  settle: string | null;
}

// 已落库的人工决策记录（list 行内「已人工处理」标注数据源）。
export interface RiskDecisionRecord {
  action: RiskDecisionAction;
  decided_by: string;
  decided_at: string;
  remark?: string;
}

// GET /admin/events/risk/list 单条（赛事行折叠态）。
// null 组字段（score/lp_pool_amount/settle_pl/yield_ratio/times.settle）是 D6 预期行为，
// 显示「—」，不是 bug；未开盘（opened=false）时 signal/bet/exposure/yield 全 null。
export interface RiskEvent {
  event_id: string;
  sport: string;
  league: string;
  event_name: string;
  status: EventStatus;
  opened: boolean;
  score: EventScore | null;
  times: EventTimes;
  lp_pool_amount: string | null;
  bet_amount_total: string | null;
  // 展示量 adjMaxL（Σ 各玩法最坏方向敞口）；与 signal 的判级量 maxL 来源不同 ★
  max_exposure: string | null;
  settle_pl: string | null;
  signal: Signal | null;
  market_count: number;
  direction_count: number;
  yield_ratio: number | null;
  // 红灯且无决策记录 = true（审批队列口径，D4：队列只收 red）
  pending_decision: boolean;
  decision: RiskDecisionRecord | null;
  // ENH-008：测试体验盘标记，仅 include_test=true 时才会出现 true 行（前端打「测试」Tag）。
  // 可选：web-api ENH-008 部署前缺失 → 渲染必须空值兜底。
  is_test?: boolean;
}

// GET /admin/events/risk/summary（四色计数不含未开盘 + 全局最大单场敞口）。
// 注意命名双义：summary 的 max_event_exposure=全局最大单场；list 行内 max_exposure=该场 adjMaxL。
export interface RiskSummary {
  total_bet_amount: string | null;
  total_events: number;
  active_count: number;
  pending_count: number;
  settled_count: number;
  // ENH-008 在售可下注口径：market OPENED/UPDATED 且未到锁盘，与 active_count（比赛进行中 live）
  // 是不同维度——live=0 ≠ 没开盘。可选：web-api ENH-008 部署前缺失 → 卡片显示「—」兜底。
  on_sale_event_count?: number;
  on_sale_market_count?: number;
  green_count: number;
  yellow_count: number;
  orange_count: number;
  red_count: number;
  red_pending_count: number;
  max_event_exposure: string | null;
  max_exposure_event_id: string | null;
  max_exposure_event_name: string | null;
  // 去重 + 升序的赛事类型清单（DD004 #2），供列表 league 筛选下拉填充。
  leagues: string[];
}

// GET /admin/events/:event_id 明细 — market 级结算条（仅已结算非空）。
export interface MarketSettle {
  winners: string[];
  payout: string | null;
  platform_pl: string | null; // 正=平台盈利
}

// 方向行（markets[].directions[]）。direction_name 由后端带胜负态标注
// （已结算「✓ 胜出 / 未中 / 走盘」，接口设计 V2 :692），前端原样渲染不再判定。
// 联调 A schema diff（2026-06-05）：odds_diff / adjust_ratio 实际为 number（mock 与 web-api 一致），
// 前端负责正负号/百分比格式化（_format.ts）。
export interface EventDirection {
  direction_id: string;
  direction_name: string;
  bet_amount: string | null;
  original_odds: number | null;
  third_party_odds: number | null;
  third_party_source: string | null;
  odds_diff: number | null; // 第三方 − 当前（base=新赔率，未调整=开盘）
  adjusted_odds: number | null;
  original_exposure: string | null;
  adjusted_exposure: string | null;
  adjust_ratio: number | null; // 压缩率/上浮率（比率，负=压缩）
  signal: Signal | null;
  adjust_history_count: number;
}

export interface EventMarket {
  market_id: string;
  market_name: string;
  settle: MarketSettle | null;
  directions: EventDirection[];
}

// GET /admin/events/:event_id 响应（赛事行字段 + markets 明细）。
export interface RiskEventDetail extends RiskEvent {
  markets: EventMarket[];
}

// GET /admin/events/:event_id/adjust-history 单条。
// exposure/lp_ratio 依赖 C 端 OPS-01a 落库，落库前 null →「—」；source 本期恒 "Auto"。
export interface AdjustHistoryItem {
  seq: number;
  time: string;
  odds: number;
  exposure: string | null;
  lp_ratio: number | null;
  source: string;
}

// GET /admin/approval/counts（claim/withdraw 本期占位恒 0）。
export interface ApprovalCounts {
  event_count: number;
  claim_count: number;
  withdraw_count: number;
}

// POST /admin/events/:event_id/risk-decision 请求/响应（§3.3 决策态状态机）。
export interface RiskDecisionPayload {
  action: RiskDecisionAction;
  remark: string;
}

export interface RiskDecisionResult {
  event_id: string;
  action: RiskDecisionAction;
  decided_by: string;
  decided_at: string;
  // 链上仍 red 且已决策 → 展示降级 orange（一期不触链上）
  effective_signal: Signal;
  queue_cleared: boolean;
}
