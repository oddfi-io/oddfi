/**
 * DD-148 推特(X)账号绑定 — 数据层。
 *
 * 走 lib/api.ts 的 authGet/authPost（authClient：prefixUrl="/api"，beforeRequest 自动加 Bearer，
 * beforeError 把响应体挂到 error.responseJSON）。path 写 `account/twitter/*` →
 * 命中 app/api/account/[...path] 代理 → BACKEND_URL/account/twitter/*。
 *
 * 错误归一（DD §3.1）：读 error.response.status + error.responseJSON.data.reason，
 * 转成 typed 结果给 UI 单分支消费，不向上抛裸 ky HTTPError。
 */
import { authGet, authPost } from "@/lib/api";
import {
  TwitterBindUrlError,
  TwitterCheckFollowError,
  type BindUrlErrorKind,
  type CheckFollowResult,
  type TwitterBinding,
} from "./types";

// ── 错误解析 helper（纯函数，可单测） ─────────────────────────────
/** 从 ky HTTPError 读 HTTP status；非 HTTPError 返回 undefined。 */
export function statusOf(err: unknown): number | undefined {
  if (err && typeof err === "object" && "response" in err) {
    return (err as { response?: Response }).response?.status;
  }
  return undefined;
}

/** 从 ky HTTPError 读 responseJSON.data.reason（lib/api beforeError 已挂）。 */
export function reasonOf(err: unknown): string | undefined {
  if (err && typeof err === "object" && "responseJSON" in err) {
    const json = (err as { responseJSON?: { data?: { reason?: string } } }).responseJSON;
    return json?.data?.reason;
  }
  return undefined;
}

/** bind_url 错误分类：409+user_already_bound / 503 disabled / 其余 unknown。 */
export function classifyBindUrlError(
  status: number | undefined,
  reason: string | undefined
): BindUrlErrorKind {
  if (status === 409 && reason === "user_already_bound") return "user_already_bound";
  if (status === 503) return "disabled";
  return "unknown";
}

// ── API ──────────────────────────────────────────────────────────
interface BindUrlRes {
  authorize_url: string;
}

/**
 * GET account/twitter/bind_url — 获取后端主导的 OAuth2 授权 URL。
 * 成功返 authorize_url；失败抛 TwitterBindUrlError（kind 分类供 UI 文案）。
 */
export async function getTwitterBindUrl(): Promise<string> {
  try {
    const res = await authGet<BindUrlRes>("account/twitter/bind_url");
    return res.authorize_url;
  } catch (err) {
    throw new TwitterBindUrlError(classifyBindUrlError(statusOf(err), reasonOf(err)));
  }
}

/**
 * GET account/twitter/binding — 当前绑定态（权威源）。
 * 503（功能未就绪）归一为 `{bound:false, disabled:true}`，不抛，供 UI 单分支置灰。
 * 其余错误（401 等）向上抛，交 TanStack Query 处理。
 */
export async function getTwitterBinding(): Promise<TwitterBinding> {
  try {
    return await authGet<TwitterBinding>("account/twitter/binding");
  } catch (err) {
    if (statusOf(err) === 503) return { bound: false, disabled: true };
    throw err;
  }
}

/**
 * POST account/twitter/unbind — 解绑（幂等软删）。
 * 注意：后端对同号解绑后有 30 天冷却（任何账号不可重绑），前端不实现冷却逻辑，仅文案提示。
 */
export async function unbindTwitter(): Promise<void> {
  await authPost<{ unbound: boolean }>("account/twitter/unbind", {});
}

/**
 * GET account/twitter/check_follow — 关注核验。
 * refresh=true 触发实时复查（压第三方限流）；后端 429 → 抛 TwitterCheckFollowError("rate_limited")。
 * 功能未就绪后端也返 200（status="unverifiable_error"），前端无需判 503。
 */
export async function checkTwitterFollow(refresh = false): Promise<CheckFollowResult> {
  try {
    return await authGet<CheckFollowResult>(
      "account/twitter/check_follow",
      refresh ? { searchParams: { refresh: "1" } } : undefined
    );
  } catch (err) {
    if (statusOf(err) === 429) throw new TwitterCheckFollowError("rate_limited");
    if (statusOf(err) === 401) throw err; // 鉴权错误透传，交 Query/afterResponse refresh 处理（与 getTwitterBinding 一致）
    throw new TwitterCheckFollowError("unknown");
  }
}
