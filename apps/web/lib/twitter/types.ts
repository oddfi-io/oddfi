/**
 * DD-148 推特(X)账号绑定 — 类型定义。
 *
 * 对应后端 dd-141（web-api，路由前缀 account/twitter/*）。
 * 字段逐字对齐后端契约（twitter.go + frontend-integration.md）。
 */

/** check_follow 返回的核验状态枚举（后端 data.status，6 值）。 */
export type FollowStatus =
  | "verified"
  | "not_following"
  | "unverified"
  | "unverifiable_protected"
  | "unverifiable_too_many_follows"
  | "unverifiable_error";

/** 绑定成功后返回的推特账号信息（binding.twitter）。 */
export interface TwitterInfo {
  twitter_id: string;
  username: string;
  name: string;
  avatar_url: string;
  description: string;
  verified: boolean;
  verified_type: string;
}

/**
 * GET account/twitter/binding 归一结果。
 * 503（功能未就绪）由数据层归一为 `{bound:false, disabled:true}`，UI 单分支置灰。
 */
export interface TwitterBinding {
  bound: boolean;
  twitter?: TwitterInfo;
  follows_official?: boolean;
  follow_checked_at?: string | null;
  bound_at?: string | null;
  /** 前端归一：503 → disabled=true（后端功能未就绪），非后端字段。 */
  disabled?: boolean;
}

/** GET account/twitter/check_follow 返回。 */
export interface CheckFollowResult {
  bound: boolean;
  following: boolean;
  status: FollowStatus;
  follow_checked_at: string | null;
}

/** bind_url 失败归一种类（供 useBindTwitter onError 分支）。 */
export type BindUrlErrorKind = "user_already_bound" | "disabled" | "unknown";

/** check_follow 失败归一种类（429 限流退避）。 */
export type CheckFollowErrorKind = "rate_limited" | "unknown";

/** getTwitterBindUrl 抛出的 typed 错误，UI 按 kind 走文案分支。 */
export class TwitterBindUrlError extends Error {
  constructor(public kind: BindUrlErrorKind) {
    super(`[Twitter] bind_url failed — ${kind}`);
    this.name = "TwitterBindUrlError";
  }
}

/** checkTwitterFollow(refresh) 抛出的 typed 错误（限流退避）。 */
export class TwitterCheckFollowError extends Error {
  constructor(public kind: CheckFollowErrorKind) {
    super(`[Twitter] check_follow failed — ${kind}`);
    this.name = "TwitterCheckFollowError";
  }
}
