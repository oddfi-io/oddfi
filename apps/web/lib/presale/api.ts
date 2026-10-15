/**
 * DD-119 Presale / Referral API 封装。
 *
 * 走 lib/api.ts 的 authClient（prefixUrl="/api"，beforeRequest 自动加 Bearer + 401 refresh）。
 * path 写 `v1/presale/config` → 实际请求 `/api/v1/presale/config` → 命中专用代理
 * （app/api/v1/presale/[...path]）→ BACKEND_URL/api/v1/presale/config。
 *
 * config 公开（无需登录），但走同一代理；带 token 也无害（后端忽略）。
 * 列表/me 接口返回经 adapter 归一，组件拿到稳定 shape（DD §2.2）。
 */
import { authGet, authPost } from "@/lib/api";
import {
  adaptDepositList,
  adaptReferralList,
  adaptReferralMe,
  type BindReq,
  type BindRes,
  type Deposit,
  type DepositListResult,
  type DepositListWire,
  type ListQuery,
  type Position,
  type PresaleConfig,
  type ReferralListResult,
  type ReferralListWire,
  type ReferralMe,
  type ReferralMeWire,
  type ReportTxReq,
  type ReportTxRes,
} from "./types";

/** searchParams 只接受 string|number，构造时丢弃 undefined（DD §3.2）。 */
function listSearchParams(q: ListQuery): Record<string, string | number> {
  const sp: Record<string, string | number> = { page: q.page ?? 1, size: q.size ?? 20 };
  if (q.status) sp.status = q.status;
  if (q.business) sp.business = q.business;
  return sp;
}

// ── presale ──────────────────────────────────────────────────────
export const getPresaleConfig = () => authGet<PresaleConfig>("v1/presale/config");

export const reportDepositTx = (body: ReportTxReq) =>
  authPost<ReportTxRes>("v1/presale/deposit/report-tx", body);

export const getDeposit = (txHash: string) => authGet<Deposit>(`v1/presale/deposit/${txHash}`);

export const getDepositList = async (q: ListQuery = {}): Promise<DepositListResult> =>
  adaptDepositList(
    await authGet<DepositListWire>("v1/presale/deposit/list", { searchParams: listSearchParams(q) })
  );

export const getPosition = () => authGet<Position>("v1/presale/position");

// ── referral（站点级） ────────────────────────────────────────────
export const getReferralMe = async (): Promise<ReferralMe> =>
  adaptReferralMe(await authGet<ReferralMeWire>("v1/referral/me"));

export const bindReferral = (body: BindReq) => authPost<BindRes>("v1/referral/bind", body);

export const getReferralList = async (q: ListQuery = {}): Promise<ReferralListResult> =>
  adaptReferralList(
    await authGet<ReferralListWire>("v1/referral/list", { searchParams: listSearchParams(q) })
  );
