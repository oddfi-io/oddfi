// ============================================================
// Unified API Response Types
// ============================================================

export interface ApiResponse<T> {
  code: number; // 0 = success
  message: string;
  data: T;
}

export type PagedResponse<T> = ApiResponse<{
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}>;

// ============================================================
// Early Access (oddfi-web-api POST /api/v1/early_access/register)
// ============================================================

export type ReferralSource =
  | "x_twitter"
  | "telegram"
  | "discord"
  | "friend"
  | "kol"
  | "crypto_media"
  | "task_platform"
  | "other";

export type EarlyAccessSource = "market_page" | "lp_page" | "stake_page" | "home" | "other";

export interface RegisterEarlyAccessReq {
  email: string;
  wallet_address: string;
  expected_feature?: string;
  referral_source?: ReferralSource | "";
  referral_source_other?: string;
  source?: EarlyAccessSource;
  utm_source?: string;
  utm_campaign?: string;
}

export interface RegisterEarlyAccessRes {
  id: string;
  rank: number;
  created_at: string;
}

// ============================================================
// Swap Types
// ============================================================

export type SwapToken = "USDT" | "USDC" | "BNB";

export interface SwapQuote {
  fromToken: SwapToken;
  toToken: SwapToken;
  fromAmount: string;
  toAmount: string;
  rate: string;
  priceImpact: string; // percent string, e.g. "0.05"
  minReceived: string;
  fee: string;
}

export interface SwapReq {
  fromToken: SwapToken;
  toToken: SwapToken;
  amount: string;
  slippage: string; // percent string, e.g. "0.5"
}

// ============================================================
// Invite Types
// ============================================================

export interface InviteInfo {
  myCode: string;
  myLink: string;
  referrer?: string; // referrer address
  totalInvited: number;
}

export interface InviteReward {
  type: "trade" | "invite" | "market_make" | "stake";
  label: string;
  amount: string;
  claimable: string;
}

export interface InviteRecord {
  address: string;
  joinedAt: string;
  contributed: string; // USDT contributed by this invitee
  reward: string;
}

export interface InviteStats {
  inviteCount: number; // 邀请地址数
  inviteIncome: string; // 邀请收益 PTK decimal string
  communityLevel: number; // 社区级别
  directCount: number; // 直推地址数
  indirectCount: number; // 间推地址数
  totalPerf: string; // 总业绩 PTK decimal string
  smallZonePerf: string; // 小区业绩 PTK decimal string
  contribution: string; // 贡献数值
  availableContrib: string; // 可用贡献值
}

// ============================================================
// Kline Types
// ============================================================

export interface KlineBar {
  time: number; // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type KlineInterval = "1H" | "4H" | "1D" | "1W";

// ============================================================
// Market API Response (v2 backend — /v1/detail/*)
// ============================================================

export interface MarketApiResponse<T> {
  code: number; // 200=success, 400=param error, 500=data source failure
  msg: string;
  data: T;
}

// ============================================================
// SportMonks Types
// ============================================================

export interface SportmonksOddsEntry {
  id: number;
  fixture_id: number;
  market_id: number;
  bookmaker_id: number;
  label: string; // "Home" | "Draw" | "Away" | "Over" | "Under"
  value: string; // decimal string, e.g. "2.10"
  name: string | null;
  market_description: string; // "Fulltime Result" | "Asian Handicap" | "Asian Total"
  probability: string; // "38.02%"
  total: string | null; // Over/Under line, e.g. "2.5"
  handicap: string | null; // Handicap value, e.g. "-0.5"
  sort_order: number;
  winning: boolean;
  stopped: boolean;
}

/** 球队球衣 CDN URL（仅 `league.has_jerseys=true` 时由 `/api/v1/detail/fixture/:id` 接口提供）。 */
export interface SportmonksTeamKit {
  type: "home" | "away" | "combi";
  url: string;
}

export interface SportmonksParticipant {
  id: number;
  name: string;
  short_code: string;
  image_path: string;
  country_id: number;
  type: "domestic" | "national";
  meta: { location: "home" | "away"; winner: boolean | null; position: number };
  /** 仅 `/api/v1/detail/fixture/:id` 在世界杯联赛下发；列表接口与 4 个 match-detail 接口均不含此字段。 */
  team_kits?: SportmonksTeamKit[];
}

export interface SportmonksLeague {
  id: number;
  sport_id: number;
  country_id: number;
  name: string;
  short_code: string;
  image_path: string;
  type: "league" | "cup";
  sub_type: string;
  category: number;
  active: boolean;
  last_played_at: string;
  has_jerseys: boolean;
}

export interface SportmonksStatistic {
  id: number;
  fixture_id: number;
  type_id: number;
  participant_id: number;
  data?: { value: number };
  location: "home" | "away";
}

export interface SportmonksFixture {
  id: number;
  league_id: number;
  stage_id: number;
  /** Stage name (often empty string from backend, included for shape parity) */
  stage_name?: string;
  name: string;
  starting_at: string;
  starting_at_timestamp: number;
  state_id: number;
  has_odds: boolean;
  odds: SportmonksOddsEntry[];
  participants: SportmonksParticipant[];
  league?: {
    id: number;
    name: string;
    image_path?: string;
    country_id?: number;
    sub_type?: string;
  };
  statistics?: SportmonksStatistic[];
  /**
   * 赛事级禁投开关（DD-087 §4.1）。
   * 后端 sports_all / fixture detail 两条接口均返回此字段；缺省视为 true 向下兼容。
   */
  enable_bet?: boolean;
  /** 后端 mock 测试赛事标记，存在即为测试比赛 */
  mock_activity?: {
    activity_id: string;
    period_sec: number;
    bet_close_sec: number;
    settle_at_sec: number;
    phase: string;
    remaining_sec: number;
    bet_close_at: string;
    settle_at: string;
  };
}

// ─── League grouping (used by match list rendering) ─────────────────────

export interface LeagueGroup {
  leagueId: number;
  leagueName: string;
  leagueImage: string;
  countryId: number | null;
  fixtures: SportmonksFixture[];
}
