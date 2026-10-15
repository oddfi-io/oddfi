/** Odds filter type for market display */
export type OddsFilter = "winner" | "handicap" | "total";

/** Banner 玩法枚举（DD-085 §3.5 决策 #12，对齐后端 banner_bet_place 文档） */
export type BannerMarket =
  | "champion_winner"
  | "total_goals"
  | "golden_ball"
  | "golden_boot"
  | "golden_glove";

/** Banner selection 携带的下注元数据（仅 banner-* selection 有值） */
export interface BannerMeta {
  /** banner_id 短 ID（bnr_xxx），下注请求 `banner_code` 字段实际期望此值 */
  bannerId: string;
  marketId: number;
  selectionId: number;
  market: BannerMarket;
  /** ISO 3166-1 alpha-2 国家码；BetCard 国旗渲染使用（夺冠盘 / 金球可用） */
  countryCode?: string;
}

/** Bet selection item — one odds pick from a fixture (or a banner item) */
export interface BetSelection {
  id: string; // makeSelectionId() 生成：1X2 "${fid}-1-${label}", 让球/大小 "${fid}-${marketId}-${label}-${lineValue}"
  oddId: number; // backend odd_id = SportmonksOddsEntry.id
  fixtureId: number;
  fixtureName: string; // "Braga VS Ferencvarosi"
  leagueName: string;
  marketType: "1x2" | "asian_handicap" | "asian_total";
  marketDescription: string; // "Fulltime Result"
  selection: string; // "Home" | "Draw" | "Away" | "Over" | "Under" | banner item name
  displayLabel: string; // "Braga" | "Draw" | "Over 2.5"
  odds: string; // decimal odds, e.g. "1.53"
  /**
   * AH 盘口线，**用户所选方视角**（Home 选项存主队线 "-1"，Away 选项存客队线 "+1"/"1"）。
   * ⚠️ 与链上/后端的「主队视角」`line_value` 互为相反数 —— 跨端匹配前需按 selection 归一，
   * 见 lib/betting/submit-onchain-from-selection.ts findOnchainMarket（DD-128）。
   */
  handicap?: string;
  total?: string;
  /**
   * 主/客队徽 URL（赛事卡 participants[].image_path）。
   * 仅用于「上链中」乐观注单卡兜底展示队徽 —— BetSelection 本身不强依赖，缺省时
   * buildPendingPortfolioBet 回退占位图，~10s 后被后端 history 权威队徽替换。
   */
  homeLogo?: string;
  awayLogo?: string;
  /** 仅 banner-* selection 有值；走 placeBannerBet 而非 placeBet */
  bannerMeta?: BannerMeta;
}

/** Bet Slip settings */
export interface BetSettings {
  oddsAcceptance: "any" | "higher_only" | "none";
}

export type BetMarket = "fulltime_result" | "asian_handicap" | "asian_over_under";
export type BetLabel = "1" | "2" | "draw" | "over" | "under";

/** POST /account/bet_place 请求 */
export interface PlaceBetReq {
  odd_ids: number[];
  stakes: string[];
  type: "single" | "parlay";
  market: BetMarket[];
  label: BetLabel[];
  handicapline: string[];
  odds: string[];
  /** 幂等 key：同一笔下注的唯一业务请求号。仅"网络错/超时/自动 retry"复用，拿到明确响应后必须换新。 */
  ref_id: string;
}

/** POST /account/bet_place 响应 data */
export interface PlaceBetRes {
  msg: "ALL_SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
  results: PlaceBetResult[];
}

export interface PlaceBetResult {
  odd_id: number;
  bet_id: number;
  status: "SUCCESS" | "INSUFFICIENT_BALANCE" | "BET_NUM_TOO_LARGE" | "ODDS_CHANGED";
}

/** POST /account/banner_bet_place 请求（DD-085 §3.5 决策 #12） */
export interface PlaceBannerBetReq {
  banner_code: string; // banner_id 短 ID（bnr_xxx），与后端契约对齐
  market_id: number;
  selection_id: number;
  market: BannerMarket;
  selection: string; // 用户实际下注对象，如 "Argentina" / "Messi"
  stake: string; // decimal string > 0
  odds: string; // decimal string > 0
  ref_id: string; // 客户端幂等键，每次点击唯一
}

/** POST /account/banner_bet_place 响应 data */
export interface PlaceBannerBetRes {
  bet_id: number;
  status: string; // "SUCCESS" | ...
  banner_code: string;
  market_id: number;
  selection_id: number;
  stake: string;
  odds: string;
  payout: string;
}

export interface CancelBetReq {
  bet_ids: number[];
}

export interface CancelBetRes {
  final_status: "ALL_SUCCESS" | "PARTIAL_SUCCESS";
  results: Array<{ bet_id: number; status: "SUCCESS" | "FAILED"; error?: string }>;
}

export interface ClaimPrizeReq {
  bet_id: number;
  // DD-087 §5.2：amount 不传，由后端 actual_payout 单一源
}

/**
 * POST /account/bet_claim 响应 data（DD-087 §2.1，对齐 web-api/internal/repository/user.go:1008-1135）
 * - status 始终 "CLAIMED"；幂等命中也是 CLAIMED + already_claimed=true
 * - amount 单位与 stake 一致（actual_payout）
 */
export interface ClaimPrizeRes {
  status: string; // "CLAIMED"
  bet_id: number;
  amount: number;
  already_claimed: boolean;
}

/**
 * @deprecated Mock order record (local tracking only) — will be removed in Batch 5
 */
export interface MockOrder {
  id: string;
  selections: {
    fixtureId: number;
    fixtureName: string;
    displayLabel: string;
    odds: string;
    // ─── My Bets 展示所需 ───
    marketType: string; // "1x2" | "asian_handicap" | "asian_total"
    leagueName: string; // "Champions League"
    selection: string; // "Home" | "Draw" | "Over" 等
  }[];
  mode: "single" | "multi";
  totalBet: string;
  potentialWin: string;
  placedAt: string;
  status: "placed" | "won" | "lost" | "cashedout";
}
