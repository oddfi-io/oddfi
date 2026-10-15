import ky from "ky";
import type {
  ApiResponse,
  PagedResponse,
  MarketApiResponse,
  KlineBar,
  SwapQuote,
  SwapToken,
  SwapReq,
  InviteInfo,
  InviteReward,
  InviteRecord,
  InviteStats,
  SportmonksFixture,
  RegisterEarlyAccessReq,
  RegisterEarlyAccessRes,
} from "@/types/api";
import type {
  PlaceBetReq,
  PlaceBetRes,
  PlaceBannerBetReq,
  PlaceBannerBetRes,
  CancelBetReq,
  CancelBetRes,
  ClaimPrizeReq,
  ClaimPrizeRes,
} from "@/types/betting";
import type { CollateralPosition, ActiveBorrow } from "@/types/lending";
import type {
  OnchainMarketRes,
  OnchainApproveReq,
  OnchainPlaceBetReq,
  OnchainClaimPayoutReq,
  OnchainCashOutReq,
  OnchainTxRes,
  OnchainOrderResponse,
  PreviewSignalReq,
  PreviewSignalRes,
} from "@/types/onchain-betting";
import type {
  OnchainStakeReq,
  OnchainUnstakeReq,
  StakeHistoryRes,
  StakeStatsRes,
} from "@/types/onchain-stake";
import type {
  OnchainDepositGlobalReq,
  OnchainDepositMatchReq,
  OnchainLpPositionReq,
  LiquidityMatchPoolsRes,
  LiquidityGlobalPlansRes,
  LiquidityPositionsRes,
  LiquidityWithdrawableRes,
} from "@/types/onchain-liquidity";
import type { MoneylineHistoryResponse, StandingsScope } from "@/types/moneyline";
import type { FixtureStreamsResponse } from "@/types/streams";
import type {
  MatchDetailOverviewWire,
  MatchDetailH2HWire,
  MatchDetailStandingsWire,
  MatchDetailLineupsWire,
} from "@/types/match-detail";
import type { HomeBannerData, BannerItemDetail, TemplateId } from "@/types/home-banner";
import type {
  LoginStep1Req,
  LoginStep1Res,
  LoginStep2Req,
  LoginStep2Res,
  RefreshRes,
  AccountBalanceRes,
  DepositAddressRes,
  WithdrawApplyReq,
  WithdrawApplyRes,
  WithdrawFeeReq,
  WithdrawFeeRes,
  WithdrawRecordsRes,
  WithdrawRecordInfoRes,
  WithdrawCancelReq,
  PortfolioHistoryParams,
  PortfolioHistoryRes,
} from "@/types/auth";
import { toSearchParams } from "@/lib/http/searchParams";
import { useAuthStore } from "@/stores/authStore";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

// DD-123 Critical fix: ky 原生 HTTPError 只有 .response/.request/.options，
// 项目惯例（useClaimBet.ts:88 / useWithdrawTx 内 isHttp409NonceUsed）依赖 .responseJSON.code
// 取业务错误码。需统一在 beforeError 把 response.json() 解析挂到 error.responseJSON 上，
// 否则所有按业务 code 分支的 catch 在生产环境永远落到 fallback 路径。
async function attachResponseJSON(error: { response?: Response }): Promise<void> {
  if (!error.response) return;
  try {
    // clone 后再 json()，避免消费原 body 影响调用方
    (error as { responseJSON?: unknown }).responseJSON = await error.response.clone().json();
  } catch {
    // body 不是 JSON / 空 body / 已被消费 — 留 undefined，catch 端按 status 走 fallback
  }
}

const client = ky.create({
  prefixUrl: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
  hooks: {
    beforeError: [
      async (error) => {
        await attachResponseJSON(error);
        return error;
      },
    ],
  },
});

// Helper to unwrap ApiResponse
async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const res = await client.get(path, { searchParams: params }).json<ApiResponse<T>>();
  return res.data;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await client.post(path, { json: body }).json<ApiResponse<T>>();
  return res.data;
}

// ============================================================
// 后端认证 Client（/api/account/* + /api/v1/* → Next.js 代理 → 后端服务）
// ============================================================

// Refresh 专用 client — 不带 Bearer header，避免过期 token 触发 401 循环
const refreshClient = ky.create({
  prefixUrl: "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// ── Token Refresh (并发安全单例) ──────────────────────────────

let refreshPromise: Promise<void> | null = null;
const REFRESH_HARD_TIMEOUT_MS = 20_000;

async function doRefresh(refreshToken: string, startEpoch: number) {
  const res = await refreshClient
    .post("account/refresh_access_token_by_refresh", { json: { refresh_token: refreshToken } })
    .json<ApiResponse<RefreshRes>>();

  // BUG-011: 网络请求返回后再写 token 前，校验 sessionEpoch 是否被 clearAuth 增加过。
  // 不一致 = 用户在 refresh 飞行期间显式 logout（断开钱包），丢弃本次结果避免幽灵复活。
  const currentEpoch = useAuthStore.getState().sessionEpoch;
  if (currentEpoch !== startEpoch) {
    throw new Error(
      `[Auth] Refresh discarded — sessionEpoch changed during flight (${startEpoch} → ${currentEpoch})`
    );
  }

  const data = res.data;
  useAuthStore.getState().setAccessToken({ token: data.access_token, expire_at: data.expire_at });

  if (data.refresh_token) {
    // Token rotation: 推算新的 30 天过期时间（后端未返回 refresh expire_at）
    const refreshExpireAt = Math.floor(Date.now() / 1000) + 30 * 86400;
    useAuthStore.getState().setRefreshToken(data.refresh_token, refreshExpireAt);
  }
}

/**
 * 并发安全的 token refresh：同一时刻只有一个 refresh 请求在飞行，
 * 所有并发调用者共享同一个 Promise（token rotation 下防止旧 refresh_token 重放）。
 *
 * DD-072 Round 5：
 * - 进入前设 `refreshInFlight=true`，finally 回 false（UI "session yes" 短窗口判定）
 * - 20s 硬超时兜底
 * - 成功：`refreshFailed=false`
 * - 401/403：`setRefreshFailed(false)` + `clearAuth()` → Effect 2 (f) 级联 disconnect
 * - 网络/超时：`setRefreshFailed(true)` + `clearAuth()` → 同上
 */
export async function doRefreshSingleton(): Promise<void> {
  if (refreshPromise) return refreshPromise;

  const { refreshToken, sessionEpoch: startEpoch } = useAuthStore.getState();
  if (!refreshToken) throw new Error("[Auth] No refresh token available");

  const store = useAuthStore.getState();
  store.setRefreshInFlight(true);

  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("[Auth] Refresh timeout after 20s")),
      REFRESH_HARD_TIMEOUT_MS
    );
  });

  refreshPromise = Promise.race([doRefresh(refreshToken, startEpoch), timeoutPromise])
    .then(() => {
      useAuthStore.getState().setRefreshFailed(false);
    })
    .catch((err) => {
      // BUG-011: epoch 变化导致的丢弃不是真失败 —— 用户已显式 logout，不要再 clearAuth/setRefreshFailed
      const currentEpoch = useAuthStore.getState().sessionEpoch;
      if (currentEpoch !== startEpoch) {
        throw err;
      }
      const isHttpError = err && typeof err === "object" && "response" in err;
      const status = isHttpError ? (err as { response: Response }).response.status : 0;
      if (status === 401 || status === 403) {
        // refresh_token 已被后端废弃 —— 保持 refreshFailed=false（非网络错误）
        useAuthStore.getState().setRefreshFailed(false);
      } else {
        useAuthStore.getState().setRefreshFailed(true);
      }
      // Round 5: 无论 401/403 还是网络/超时失败，都清空 auth。
      // Effect 2 重入命中 (f) 分支强制 disconnect，UI 回落 connect 态。
      useAuthStore.getState().clearAuth();
      throw err;
    })
    .finally(() => {
      if (timer) clearTimeout(timer);
      // BUG-011: epoch 已变化时不要 setRefreshInFlight —— clearAuth 已置 false，再写一次会触发额外 render
      if (useAuthStore.getState().sessionEpoch === startEpoch) {
        useAuthStore.getState().setRefreshInFlight(false);
      }
      refreshPromise = null;
    });

  return refreshPromise;
}

// beforeRequest hook 自动读取最新 token 并附加 Bearer header，避免各函数重复读取
const authClient = ky.create({
  prefixUrl: "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
  hooks: {
    beforeRequest: [
      (request) => {
        const token = useAuthStore.getState().accessToken;
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
        // BUG-010 探针：客户端发送时间戳，供 proxy / 后端日志关联，复现时直接看 RTT
        request.headers.set("X-Client-Sent-At", String(Date.now()));
      },
    ],
    beforeError: [
      async (error) => {
        // BUG-010 探针：TimeoutError / AbortError 时打印 url + method + 实际耗时，
        // 让"偶现 timeout"复现一次就能锁定 ky duplex 上传 race 假设
        if (error.name === "TimeoutError" || error.name === "AbortError") {
          const sentAt = Number(error.request?.headers.get("X-Client-Sent-At") ?? 0);
          const duration = sentAt ? Date.now() - sentAt : 0;
          console.error(
            `[ky-authClient] ${error.name} — url=${error.request?.url} method=${error.request?.method} duration=${duration}ms`
          );
        }
        // DD-123 Critical fix：同 client，统一挂 responseJSON 给业务 catch 分支用
        await attachResponseJSON(error);
        return error;
      },
    ],
    afterResponse: [
      async (_request, _options, response, { retryCount }) => {
        if (response.status !== 401 || retryCount > 0) return;
        try {
          await doRefreshSingleton();
        } catch {
          return;
        }
        // Token refreshed — retry (beforeRequest hook picks up new token)
        return ky.retry();
      },
    ],
  },
});

// DD-119: presale/referral 数据层（lib/presale/api.ts）复用这两个底层 helper。
export async function authPost<T>(path: string, body: unknown): Promise<T> {
  const res = await authClient.post(path, { json: body }).json<ApiResponse<T>>();
  return res.data;
}

export async function authGet<T>(
  path: string,
  options?: { searchParams?: Record<string, string | number> }
): Promise<T> {
  const res = await authClient
    .get(path, options?.searchParams ? { searchParams: options.searchParams } : undefined)
    .json<ApiResponse<T>>();
  return res.data;
}

// ============================================================
// Auth API — EOA 钱包登录（两步）
// ============================================================

export const loginByWalletStep1 = (body: LoginStep1Req) =>
  authPost<LoginStep1Res>("account/login_by_wallet", body);

export const loginByWalletStep2 = (body: LoginStep2Req) =>
  authPost<LoginStep2Res>("account/login_by_wallet", body);

// logout 端点无 data 字段，直接 fire-and-forget（best effort）
export async function logoutApi(): Promise<void> {
  await authClient.post("account/logout", { json: {} });
}

export const getAccountBalance = () => authGet<AccountBalanceRes>("account/balance");

export const getDepositAddress = () => authGet<DepositAddressRes>("account/deposit_address");

// ============================================================
// Betting API（真实后端）
// ============================================================

export const placeBet = (req: PlaceBetReq) => authPost<PlaceBetRes>("account/bet_place", req);

// Banner 单注下单（DD-085 §3.5 #12，对齐 banner_bet_place 文档）
// 不支持 parlay；每次 1 leg，前端可循环并发；ref_id 客户端幂等
export const placeBannerBet = (req: PlaceBannerBetReq) =>
  authPost<PlaceBannerBetRes>("account/banner_bet_place", req);

export const cancelBets = (req: CancelBetReq) => authPost<CancelBetRes>("account/bet_cancel", req);

export const claimPrize = (req: ClaimPrizeReq) => authPost<ClaimPrizeRes>("account/bet_claim", req);

// ============================================================
// Onchain Betting API (DD-105 · oddfi-web-api dev ded4dc0)
// 仅 testnet 环境下启用；走 BSC Testnet BettingPool 合约，后端代签。
// ============================================================

/**
 * GET /market/onchain?fixture_id
 *
 * DD-105 修复(2026-05-21):后端把 onchain market 接口注册在 account 服务(BACKEND_URL,
 * 不是 MARKET_API_URL)的 /market/onchain 路由下(web-api/internal/router/group.go:71),
 * 不在 market-api 服务的 /v1/market/* 下。新增 /api/market/[...path] 代理对应转发。
 */
export const getOnchainMarkets = (fixtureId: number) =>
  authGet<OnchainMarketRes>("market/onchain", { searchParams: { fixture_id: fixtureId } });

export const onchainApprove = (req: OnchainApproveReq) =>
  authPost<OnchainTxRes>("account/onchain/approve", req);

export const onchainPlaceBet = (req: OnchainPlaceBetReq) =>
  authPost<OnchainTxRes>("account/onchain/place_bet", req);

export const onchainClaimPayout = (req: OnchainClaimPayoutReq) =>
  authPost<OnchainTxRes>("account/onchain/claim_payout", req);

/**
 * POST /account/onchain/cash_out (DD-137 · oddfi-backend@dev onchain_tx.go:232)
 * 链上注单提前兑现/撤单。幂等键 = bet_id 服务端自动生成（与 claim 不同，前端不传）。
 * 合约 30s 报价 TTL —— 拿到报价后必须立即提交，调用编排见 lib/betting/onchain-cashout.ts。
 */
export const onchainCashOut = (req: OnchainCashOutReq) =>
  authPost<OnchainTxRes>("account/onchain/cash_out", req);

/**
 * GET /account/onchain/orders/:id (oddfi-backend@dev 949a5f3)
 * 用于轮询事件索引服务是否已把 BetPlaced 的 bet_id 回填到 place_bet 订单上。
 * `bet_ready=true` 后才能调用 onchainClaimPayout({bet_id}).
 */
export const getOnchainOrder = (orderId: number) =>
  authGet<OnchainOrderResponse>(`account/onchain/orders/${orderId}`);

/**
 * POST /market/{marketId}/preview-signal (DD-117)
 *
 * 同步链上 view 查询信号灯 + lockedOdds + maxAcceptableAmount。
 * 后端 web-api@642895c · service/market.go:PreviewSignal — Redis 500ms 缓存 + RPC 失败 degraded 兜底。
 * 无需鉴权（注册在 RegisterMarketRoutes 而非 account 路由组）。
 */
export const previewSignal = (marketId: string, req: PreviewSignalReq) =>
  post<PreviewSignalRes>(`market/${marketId}/preview-signal`, req);

// ============================================================
// Onchain Stake API (DD-130 · oddfi-web-api web-api)
// 仅 testnet 环境启用；后端代理钱包代签到 StakingPool 合约。
// 写接口内部自动 approve max，前端无需手动 approve。
// ============================================================

export const onchainStake = (req: OnchainStakeReq) =>
  authPost<OnchainTxRes>("account/onchain/stake", req);

/** 到期解押（返本金 + 收益）；后端不校验 end_time，前端按 status+end_time 放按钮 */
export const onchainUnstake = (req: OnchainUnstakeReq) =>
  authPost<OnchainTxRes>("account/onchain/unstake", req);

/** 提前解押（只返本金，放弃收益） */
export const onchainEarlyUnstake = (req: OnchainUnstakeReq) =>
  authPost<OnchainTxRes>("account/onchain/early_unstake", req);

/** 我的质押（持仓 + 历史合一，含终态，需前端过滤） */
export const getStakeHistory = () => authGet<StakeHistoryRes>("account/onchain/stake/history");

/** 质押网络统计（带 JWT，全局口径：total_staked / reward_pool / min_stake / plans）REQ-005 */
export const getStakeStats = () => authGet<StakeStatsRes>("account/onchain/stake/stats");

// ============================================================
// Onchain Liquidity API (DD-130 · oddfi-web-api web-api)
// 公开读走新建 /api/liquidity/* 代理（免鉴权）；
// 写 + 我的持仓走 /api/account/onchain/* 现有代理（带 token）。
// ============================================================

/** 公开：可加流动性的比赛池列表（5s 缓存，按 deposit_close_at 升序） */
export const getLiquidityMatchPools = () =>
  authGet<LiquidityMatchPoolsRes>("liquidity/match/pools");

/** 公开：全局池档位（完全后端驱动，禁止前端硬编码档位） */
export const getLiquidityGlobalPlans = () =>
  authGet<LiquidityGlobalPlansRes>("liquidity/global/plans");

/** 全局池加流动性（无需手动 approve） */
export const onchainDepositGlobal = (req: OnchainDepositGlobalReq) =>
  authPost<OnchainTxRes>("account/onchain/deposit_global", req);

/** 比赛池加流动性（match_id 只能取自 getLiquidityMatchPools） */
export const onchainDepositMatch = (req: OnchainDepositMatchReq) =>
  authPost<OnchainTxRes>("account/onchain/deposit_match", req);

/** 取钱第一步：申请赎回（仓位需 status=redeemable，否则合约 revert 500） */
export const onchainRequestUnbond = (req: OnchainLpPositionReq) =>
  authPost<OnchainTxRes>("account/onchain/request_unbond", req);

/** 取钱第二步：提取（仓位需 status=withdrawable，否则合约 revert 500） */
export const onchainWithdrawLp = (req: OnchainLpPositionReq) =>
  authPost<OnchainTxRes>("account/onchain/withdraw", req);

/** 我的流动性持仓（持仓 + 历史合一，含终态，需前端过滤） */
export const getLiquidityPositions = () =>
  authGet<LiquidityPositionsRes>("account/onchain/liquidity/positions");

/** 现在真实可提取总额（本金 ± 盈亏汇总） */
export const getLiquidityWithdrawable = () =>
  authGet<LiquidityWithdrawableRes>("account/onchain/liquidity/withdrawable");

// ============================================================
// Withdraw API（DD-063）
// ============================================================

export const withdrawApply = (req: WithdrawApplyReq) =>
  authPost<WithdrawApplyRes>("account/withdraw/apply", req);

export const getWithdrawFee = (req: WithdrawFeeReq) =>
  authGet<WithdrawFeeRes>("account/withdraw/fee", { searchParams: { amount: req.amount } });

export const getWithdrawRecords = () => authGet<WithdrawRecordsRes>("account/withdraw/get_record");

export const getWithdrawRecordInfo = (orders: string[]) =>
  authPost<WithdrawRecordInfoRes>("account/withdraw/get_record_info", { orders });

export const cancelWithdraw = (req: WithdrawCancelReq) =>
  authPost<{ status: string }>("account/withdraw/cancel", req);

// ============================================================
// Portfolio History（DD-073 — 统一 bet_holding / asset_ledger）
// ============================================================

/**
 * 归一化请求参数：
 * 1. search 小写化 — 规避后端 service/auth.go:635 对 FixtureName ToLower
 *    但 QSearch 未做的 bug（后端修复后可移除此兜底）
 */
function normalizePortfolioParams(p?: PortfolioHistoryParams): PortfolioHistoryParams | undefined {
  if (!p) return undefined;
  if (!p.search) return p;
  return { ...p, search: p.search.toLowerCase() };
}

export function getPortfolioHistory(params?: PortfolioHistoryParams) {
  return authGet<PortfolioHistoryRes>("account/portfolio/history", {
    searchParams: toSearchParams(normalizePortfolioParams(params)),
  });
}

// ============================================================
// Swap
// ============================================================

export const getSwapQuote = (fromToken: SwapToken, toToken: SwapToken, amount: string) =>
  get<SwapQuote>("swap/quote", { fromToken, toToken, amount });

export const executeSwap = (req: SwapReq) =>
  post<{ txHash: string; toAmount: string }>("swap", req);

export const getKlineData = (pair: string, interval: string) =>
  get<KlineBar[]>("swap/kline", { pair, interval });

// ============================================================
// Invite
// ============================================================

export const getInviteInfo = () => get<InviteInfo>("invite/info");

export const getInviteRewards = () => get<InviteReward[]>("invite/rewards");

export const getInviteStats = () => get<InviteStats>("invite/stats");

export const getInviteRecords = (page = 1, pageSize = 20) =>
  get<PagedResponse<InviteRecord>["data"]>("invite/records", { page, pageSize });

export const claimReward = (rewardType: string) =>
  post<{ txHash: string }>("invite/claim", { rewardType });

// ============================================================
// Market Data API (DD-052 — backend03.oddfi.io /api/v1/detail/*)
// ============================================================

/** Business error (code != 200) — should NOT be retried by TanStack Query */
export class MarketApiError extends Error {
  constructor(
    public code: number,
    message: string
  ) {
    super(`[MarketAPI] ${message} (code: ${code})`);
    this.name = "MarketApiError";
  }
}

/** Generic market API GET via backend proxy, unwraps { code, msg, data } */
async function marketGet<T>(
  path: string,
  params?: Record<string, string | number | boolean>
): Promise<T> {
  const res = await authClient
    .get(path, { searchParams: params, retry: { limit: 0 } })
    .json<MarketApiResponse<T>>();
  if (res.code !== 200) throw new MarketApiError(res.code, res.msg);
  if (res.data === null || res.data === undefined) {
    throw new Error(`[MarketAPI] Received null data from ${path} — transient backend issue`);
  }
  return res.data;
}

/**
 * Match-detail 系列接口专用 GET（DD-104 · 后端 commit 873beed）。
 *
 * 与 marketGet 的唯一差异：success code 约定为 `0`（其余 market-api 路径仍是 `200`）。
 * 这是后端 web-api 内部不同 handler 组的输出契约不一致历史遗留 —
 * match-detail/* 由新 handler 组维护，使用 `{code:0,message:"ok",data:T}`。
 * 待后端统一为 200 后可回归 marketGet。
 */
async function marketGetMatch<T>(
  path: string,
  params?: Record<string, string | number | boolean>
): Promise<T> {
  const res = await authClient
    .get(path, { searchParams: params, retry: { limit: 0 } })
    .json<MarketApiResponse<T>>();
  if (res.code !== 0) throw new MarketApiError(res.code, res.msg);
  if (res.data === null || res.data === undefined) {
    throw new Error(`[MarketAPI] Received null data from ${path} — transient backend issue`);
  }
  return res.data;
}

/** Get all fixtures for a league (paginated) */
export const getMarketFixtures = (params: {
  league?: number;
  type?: string;
  page?: number;
  app_lang?: string;
  locale?: string;
  /** DD-market-chips Phase 3：worldcup tab 服务端按球队过滤 */
  team_id?: number;
  /** DD-market-chips Phase 3：other tab 服务端按国家过滤 */
  league_country_id?: number;
}) => marketGet<SportmonksFixture[]>("v1/detail/sports_all", params);

// ─── DD-market-chips · 市场页二级 chip 后端化 ───────────────────────────────

/** worldcup tab team chip（带 team_id 供服务端过滤） */
export interface TeamChipWire {
  team_id: number;
  name: string;
  logo: string;
  count: number;
}

/** other tab 国家 chip（带 league_ids 供服务端过滤） */
export interface LeagueCountryWire {
  country_id: number;
  name: string;
  image_path: string;
  count: number;
  league_ids: number[];
}

/** market_chips 统一返回：按 league 只填其一 */
export interface MarketChipsResponse {
  teams: TeamChipWire[];
  league_countries: LeagueCountryWire[];
}

/**
 * 市场页二级 chip 列表（DD-market-chips §5.1）。
 * league=732 → teams；league=0 → league_countries；另一边为空。
 */
export const getMarketChips = (p: {
  league: number;
  type?: string;
  app_lang?: string;
  locale?: string;
}) => marketGet<MarketChipsResponse>("v1/detail/market_chips", p);

/** Get single fixture detail */
export const getMarketFixtureDetail = (
  fixtureId: number,
  type: "preview" | "statis" = "preview",
  params?: { locale?: string }
) => marketGet<SportmonksFixture[]>(`v1/detail/fixture/${fixtureId}`, { type, ...params });

/** Get fixtures by date (YYYY-MM-DD, UTC) */
export const getMarketFixturesByDate = (
  date: string,
  params?: { league?: number; app_lang?: string; locale?: string }
) => marketGet<SportmonksFixture[]>(`v1/detail/fixture_date/${date}`, params);

/**
 * 链上测试赛事发现接口（DD-138 · 后端 20260607 发版闭环验收 SOP）。
 *
 * 返回当前轮 2 个测试 fixture（99301/99302 系，每 10 分钟一轮滚动），
 * 活动窗口外返回空数组。
 *
 * ⚠️ 原始响应 odds[].id 为 17 位整数（> Number.MAX_SAFE_INTEGER），
 * JSON.parse 后同 fixture 内 7 条 odds 的 id 坍缩为同一值 —— 消费方必须
 * 经 useMarketData 的 remapOnchainTestOddsIds 重映射后使用。
 */
export const getOnchainTestFixtures = (params?: { locale?: string }) =>
  marketGet<SportmonksFixture[]>("v1/detail/onchain_test_fixtures", params);

/**
 * Get Moneyline 历史 Home/Draw/Away 时序快照（oddfi-web-api commit 0ffc071）。
 * downsample=auto（默认）：赛前每标签最多 100 点；赛中点位全量返回。
 * downsample=none：返回原始全量点位。
 */
export const getMoneylineHistory = (fixtureId: number, params?: { downsample?: "auto" | "none" }) =>
  marketGet<MoneylineHistoryResponse>(
    `v1/moneyline/history/${fixtureId}`,
    params?.downsample ? { downsample: params.downsample } : undefined
  );

/**
 * DD-126 · 获取 fixture 直播流（oddfi-web-api/handler/fixture_streams.go）。
 * 懒加载只读接口，独立于 /detail 主响应；成功 code 200，走 marketGet。
 * 错误：body code 400（id 非法）/ 429（限流）/ 500（后端错）均由 marketGet 抛 MarketApiError。
 */
export const getFixtureStreams = (fixtureId: number) =>
  marketGet<FixtureStreamsResponse>(`v1/fixture/${fixtureId}/streams`);

// ============================================================
// Match Detail (DD-104 · oddfi-backend commit 873beed)
// ============================================================

/**
 * 赛事详情 Overview 聚合（顶部信息 + 6 个 venue 卡片）。
 * 后端 TTL：赛前 5min / 赛中 10s / 赛后 1h。
 */
export const getMatchDetailOverview = (fixtureId: number) =>
  marketGetMatch<MatchDetailOverviewWire>(`v1/match-detail/overview/${fixtureId}`);

/**
 * 赛事 H2H（历史对决）数据。
 * 后端 TTL：24h（含 h2h 样本 + 双方 top scorers + average goals + form）。
 */
export const getMatchDetailH2H = (fixtureId: number) =>
  marketGetMatch<MatchDetailH2HWire>(`v1/match-detail/h2h/${fixtureId}`);

/**
 * 联赛积分榜。scope: "overall" | "home" | "away"，默认 overall。
 * 后端 TTL：30min。
 */
export const getMatchDetailStandings = (fixtureId: number, scope?: StandingsScope) =>
  marketGetMatch<MatchDetailStandingsWire>(
    `v1/match-detail/standings/${fixtureId}`,
    scope ? { scope } : undefined
  );

/**
 * 赛事阵容。赛前 ≥ 1h 时后端返回 lineups: null + available_at。
 * 后端 TTL：5min。
 */
export const getMatchDetailLineups = (fixtureId: number) =>
  marketGetMatch<MatchDetailLineupsWire>(`v1/match-detail/lineups/${fixtureId}`);

// ============================================================
// Token Prices (DD-068)
// ============================================================

export const getPrices = () => get<Record<string, string>>("prices");

export interface BatchPriceReq {
  tokens: { chain_id: string; address: string }[];
}

export interface BatchPriceItem {
  chain_id: string;
  address: string;
  price: string;
  symbol: string;
  chain_image_url: string;
  token_image_url: string;
}

/** Generic market API POST via backend proxy, unwraps { code, msg, data } */
async function marketPost<T>(path: string, body: unknown): Promise<T> {
  const res = await authClient
    .post(path, { json: body, retry: { limit: 0 } })
    .json<MarketApiResponse<T>>();
  if (res.code !== 200) throw new MarketApiError(res.code, res.msg);
  // batch_price returns data: null when no tokens match — treat as empty array
  return (res.data ?? ([] as unknown)) as T;
}

/** Batch query token USD prices via market-api (POST /api/v1/token/batch_price) */
export const getBatchTokenPrices = (req: BatchPriceReq) =>
  marketPost<BatchPriceItem[]>("v1/token/batch_price", req);

// ============================================================
// Early Access (oddfi-web-api POST /api/v1/early_access/register)
// ============================================================

export type EarlyAccessErrorKind =
  | "email_invalid"
  | "email_taken"
  | "wallet_invalid"
  | "wallet_taken"
  | "wish_too_long"
  | "required_missing"
  | "captcha_failed"
  | "source_invalid"
  | "too_many_requests"
  | "server"
  | "network";

export class EarlyAccessError extends Error {
  constructor(
    public code: number,
    public kind: EarlyAccessErrorKind,
    message: string
  ) {
    super(message);
    this.name = "EarlyAccessError";
  }
}

interface EarlyAccessBackendResponse {
  code: number;
  msg: string;
  data: RegisterEarlyAccessRes | null;
}

/**
 * 后端错误码 → 前端 kind 映射。
 * 优先按 PRD §5.5 新错误码（40001/40002/40901/...）精确匹配；
 * 落不到新码时按 HTTP 大类（400/409/429/500）+ msg 字符串兜底，兼容旧后端。
 */
function mapErrorCode(code: number, msg: string): EarlyAccessErrorKind {
  switch (code) {
    case 40001:
      return "email_invalid";
    case 40002:
      return "wallet_invalid";
    case 40003:
      return "wish_too_long";
    case 40004:
      return "required_missing";
    case 40005:
      return "captcha_failed";
    case 40006:
      return "source_invalid";
    case 40901:
      return "email_taken";
    case 40902:
      return "wallet_taken";
    case 42901:
      return "too_many_requests";
    case 50001:
      return "server";
  }
  const m = msg.toLowerCase();
  if (code === 409) return m.includes("email") ? "email_taken" : "wallet_taken";
  if (code === 429) return "too_many_requests";
  if (code === 400) {
    if (m.includes("valid email")) return "email_invalid";
    if (m.includes("wallet")) return "wallet_invalid";
    if (m.includes("too long") || m.includes("max 500")) return "wish_too_long";
    if (m.includes("captcha") || m.includes("turnstile")) return "captcha_failed";
    if (m.includes("source") || m.includes("specify") || m.includes("referral_source"))
      return "source_invalid";
    if (m.includes("required") || m.includes("missing")) return "required_missing";
    return "required_missing";
  }
  return "server";
}

export async function registerEarlyAccess(
  req: RegisterEarlyAccessReq
): Promise<RegisterEarlyAccessRes> {
  let res: EarlyAccessBackendResponse;
  try {
    res = await authClient
      .post("v1/early_access/register", {
        json: req,
        throwHttpErrors: false,
        retry: { limit: 0 },
      })
      .json<EarlyAccessBackendResponse>();
  } catch {
    throw new EarlyAccessError(0, "network", "Network error");
  }
  if (res.code === 0 && res.data) return res.data;
  throw new EarlyAccessError(res.code, mapErrorCode(res.code, res.msg ?? ""), res.msg ?? "");
}

/**
 * Query 当前平台币价格 via api.oddfi.io (GET /api/market/price?chain=bsc&symbol=odd).
 *
 * 契约：返回"当前平台币"USD 价格，由后端配置驱动。
 * `symbol=odd` 是历史命名遗留，后端并不据此筛选；切换平台币时前端零改动。
 */
export async function getOddTokenPrice(): Promise<string> {
  const res = await authClient
    .get("market/price", { searchParams: { chain: "bsc", symbol: "odd" } })
    .json<ApiResponse<{ price: string }>>();
  return res.data.price;
}

// ============================================================
// Lending
// ============================================================

export const getLendingPositions = () => get<CollateralPosition[]>("lending/positions");

export const getLendingBorrows = () => get<ActiveBorrow[]>("lending/borrows");

export const borrowFromPosition = (positionId: string, amount: number) =>
  post<{ orderId: string }>("lending/borrow", { positionId, amount });

export const repayBorrow = (borrowId: string) =>
  post<{ txHash: string }>("lending/repay", { borrowId });

// ============================================================
// Home Banner (Market_Banner v1.0 §三接口契约)
// 真后端: GET /api/v1/market/banners?lang=xx → market-api.oddfi.io
// 经 app/api/v1/[...path] 代理；走 authClient（绕过 MSW）
// ============================================================

// 前端内部 TemplateId 与后端契约统一为 5 个语义 snake_case 键，无需边界映射。
export const getMarketBanners = (lang?: string) =>
  authGet<HomeBannerData[]>("v1/market/banners", lang ? { searchParams: { lang } } : undefined);

// ============================================================
// Banner Detail API（DD-085）
// 真后端: GET /api/v1/market/banners/{backend_template_id}?lang=xx
// 返回扁平 BannerItemDetail[]，不含 banner 元数据
// 元数据（title/tag_text/decoration_key/subtitle）从 getMarketBanners list 接口取
// ============================================================

export const getMarketBannerDetail = (code: TemplateId, lang?: string) =>
  authGet<BannerItemDetail[]>(
    `v1/market/banners/${code}`,
    lang ? { searchParams: { lang } } : undefined
  );
