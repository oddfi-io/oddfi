"use client";

/**
 * DD-148 §3.3 — X(推特) 连接行（状态机）。
 *
 * 后端 binding 驱动（与 localStorage 假 profile 解耦）。状态：
 *  loading（骨架，防误点）/ disabled（503 置灰 coming-soon）/ 未绑定（Connect）/
 *  已绑定（@username + 关注核验行 + 刷新 + Disconnect → 行内 30 天冷却确认）。
 *
 * 视觉沿用现有 X 行语言：border-[#212124] / h-11 / text-[12px] / text-brand-default。
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SealCheckIcon, ArrowClockwiseIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import { useAuthStore } from "@/stores/authStore";
import { toastInfo, toastError } from "@/lib/toast";
import Skeleton from "@/components/ui/Skeleton";
import { useTwitterBinding } from "@/lib/twitter/hooks/useTwitterBinding";
import { useTwitterFollow } from "@/lib/twitter/hooks/useTwitterFollow";
import { useBindTwitter } from "@/lib/twitter/hooks/useBindTwitter";
import { useUnbindTwitter } from "@/lib/twitter/hooks/useUnbindTwitter";
import { TwitterBindUrlError, type FollowStatus } from "@/lib/twitter/types";

const X_ICON = "/images/footer/social-twitter.svg";

/** 官方 X 账号（与 footer SOCIAL_LINKS / i18n @OddFiLabs 文案同口径）。 */
const OFFICIAL_X_URL = "https://x.com/OddFiLabs";
const OFFICIAL_X_HANDLE = "@OddFiLabs";
const OFFICIAL_X_NAME = "OddFi";
const OFFICIAL_X_AVATAR = "/images/logo-icon-mint.svg";

/** 解绑冷却天数：后端强制，前端仅文案提示（产品改数字只改这一处 + i18n 文案）。 */
const UNBIND_COOLDOWN_DAYS = 30;

/** follow status → i18n key（twitter.follow.*）。 */
const FOLLOW_KEY: Record<FollowStatus, string> = {
  verified: "twitter.follow.verified",
  not_following: "twitter.follow.notFollowing",
  unverified: "twitter.follow.unverified",
  unverifiable_protected: "twitter.follow.protected",
  unverifiable_too_many_follows: "twitter.follow.tooMany",
  unverifiable_error: "twitter.follow.error",
};

/** 行级动作按钮基础样式（disabled / 未绑两态共用，仅追加 hover/opacity 差异）。 */
const ROW_BTN_BASE =
  "flex items-center justify-between h-11 px-4 rounded-8 border border-[#212124] bg-transparent cursor-pointer touch-manipulation w-full";

/** 解绑确认区按钮基础样式（cancel / confirm 共用，仅文字色不同）。 */
const CONFIRM_BTN_BASE =
  "text-[12px] leading-[18px] font-medium min-h-[44px] px-3 cursor-pointer touch-manipulation disabled:opacity-50";

function XAvatar() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={X_ICON} alt="X" width={20} height={20} className="invert shrink-0" />
  );
}

export default function TwitterConnectRow() {
  const t = useTranslations("userSettings");
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const address = useAuthStore((s) => s.sessionAddress ?? undefined);

  const { data: binding, isLoading } = useTwitterBinding({ enabled: isAuthenticated, address });
  const bound = Boolean(binding?.bound);

  const { follow, refresh, isRefreshing, refreshError, resetRefreshError } = useTwitterFollow({
    enabled: isAuthenticated && bound,
    address,
  });

  const bindMutation = useBindTwitter();
  const unbindMutation = useUnbindTwitter();
  const [confirmingUnbind, setConfirmingUnbind] = useState(false);

  // 绑定失败 → 按 kind 走 i18n toast，随后 reset 避免重复触发。
  // 只跟踪 error/reset 字段（非整个 mutation 对象），与下方 refresh effect 写法对齐，
  // 避免 mutation 每次渲染换引用导致 effect 无谓重跑（REV M-1）。
  const bindError = bindMutation.error;
  const resetBind = bindMutation.reset;
  useEffect(() => {
    if (!bindError) return;
    const kind = bindError instanceof TwitterBindUrlError ? bindError.kind : "unknown";
    if (kind === "user_already_bound") toastError(t("twitter.bindError.alreadyBound"));
    else if (kind === "disabled") toastInfo(t("twitter.bindError.disabled"));
    else toastError(t("twitter.bindError.unknown"));
    resetBind();
  }, [bindError, resetBind, t]);

  // 刷新核验 429/失败 → 退避提示
  useEffect(() => {
    if (!refreshError) return;
    toastInfo(t("twitter.rateLimited"));
    resetRefreshError();
  }, [refreshError, resetRefreshError, t]);

  // ── loading：骨架占位（mobile-h5 skeleton 优于 spinner），不显示 Connect 防误点 ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-between h-11 px-4 rounded-8 border border-[#212124]">
        <span className="flex items-center gap-2">
          <XAvatar />
          <Skeleton className="w-[64px] h-[14px]" />
        </span>
        <Skeleton className="w-[48px] h-[14px]" />
      </div>
    );
  }

  // ── disabled（503 功能未就绪）：置灰 + coming soon，与 telegram 一致 ──
  if (binding?.disabled) {
    return (
      <button
        type="button"
        onClick={() => toastInfo(t("socialComingSoon"))}
        style={{ touchAction: "manipulation" }}
        className={`${ROW_BTN_BASE} opacity-50`}
        aria-label="X: coming soon"
      >
        <span className="flex items-center gap-2">
          <XAvatar />
          <span className="text-[12px] leading-[18px] font-medium text-primary">X</span>
        </span>
        <span className="text-[12px] leading-[18px] font-medium text-secondary">
          {t("connect")}
        </span>
      </button>
    );
  }

  // ── 未绑定：Connect → 整页跳转 OAuth ──
  if (!bound) {
    return (
      <button
        type="button"
        onClick={() => bindMutation.mutate()}
        disabled={bindMutation.isPending}
        style={{ touchAction: "manipulation" }}
        className={`${ROW_BTN_BASE} hover:bg-white/[0.04] transition-colors disabled:opacity-50`}
        aria-label={`X: ${t("connect")}`}
      >
        <span className="flex items-center gap-2">
          <XAvatar />
          <span className="text-[12px] leading-[18px] font-medium text-primary">X</span>
        </span>
        <span className="text-[12px] leading-[18px] font-medium text-brand-default">
          {t("connect")}
        </span>
      </button>
    );
  }

  // ── 已绑定：username + 关注核验 + 刷新 + Disconnect（行内冷却确认） ──
  const tw = binding?.twitter;
  const username = tw?.username ?? "";
  const followStatus = follow?.status;
  const followColor =
    followStatus === "verified"
      ? "text-green"
      : followStatus === "not_following"
        ? "text-brand-default"
        : "text-secondary";

  return (
    <div className="flex flex-col gap-2 px-4 py-3 rounded-8 border border-[#212124]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0">
          <XAvatar />
          <span className="flex items-center gap-1 min-w-0">
            <span className="text-[12px] leading-[18px] font-medium text-primary truncate">
              @{username}
            </span>
            {tw?.verified && (
              <SealCheckIcon size={14} weight="fill" className="text-brand-default shrink-0" />
            )}
          </span>
        </span>
        {!confirmingUnbind && (
          <button
            type="button"
            onClick={() => setConfirmingUnbind(true)}
            style={{ touchAction: "manipulation" }}
            className="text-[12px] leading-[18px] font-medium text-secondary min-h-[44px] px-1 cursor-pointer touch-manipulation hover:text-primary transition-colors shrink-0"
          >
            {t("disconnect")}
          </button>
        )}
      </div>

      {/* 关注核验行 */}
      {followStatus && (
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[12px] leading-[18px] ${followColor} truncate`}>
            {t(FOLLOW_KEY[followStatus])}
          </span>
          <button
            type="button"
            onClick={() => refresh()}
            disabled={isRefreshing}
            style={{ touchAction: "manipulation" }}
            className="flex items-center gap-1 text-[12px] leading-[18px] font-medium text-secondary hover:text-primary transition-colors min-h-[44px] px-1 cursor-pointer touch-manipulation disabled:opacity-50 shrink-0"
            aria-label={t("twitter.refresh")}
          >
            {/* animation.md exception: 在途旋转纯状态指示，无 onfinish/状态清理依赖，等同 loading 指示器 */}
            <ArrowClockwiseIcon size={14} className={isRefreshing ? "animate-spin" : undefined} />
            {t("twitter.refresh")}
          </button>
        </div>
      )}

      {/* 未关注 / 待关注 → 官号 Follow chip（推特样式：mint 头像 + 蓝标 + handle + Follow 胶囊，点击外跳官号）。
          已核验或不可核验态（protected/tooMany/error）不引导关注。 */}
      {(followStatus === "not_following" || followStatus === "unverified") && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#212124]">
          <a
            href={OFFICIAL_X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 min-w-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_X_AVATAR}
              alt={OFFICIAL_X_NAME}
              width={28}
              height={28}
              className="rounded-full shrink-0"
            />
            <span className="flex flex-col min-w-0">
              <span className="flex items-center gap-1">
                <span className="text-[12px] leading-[16px] font-semibold text-primary truncate">
                  {OFFICIAL_X_NAME}
                </span>
                <SealCheckIcon size={14} weight="fill" className="text-brand-default shrink-0" />
              </span>
              <span className="text-[12px] leading-[16px] text-secondary truncate">
                {OFFICIAL_X_HANDLE}
              </span>
            </span>
          </a>
          <a
            href={OFFICIAL_X_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ touchAction: "manipulation" }}
            className="flex items-center gap-1 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-static-black text-[12px] leading-[18px] font-semibold px-4 min-h-[44px] cursor-pointer touch-manipulation shrink-0 transition-colors"
            aria-label={`${t("twitter.follow.cta")} ${OFFICIAL_X_HANDLE}`}
          >
            {t("twitter.follow.cta")}
            <ArrowUpRightIcon size={14} weight="bold" />
          </a>
        </div>
      )}

      {/* 行内解绑确认（不嵌套 Modal，移动端 Bottom Sheet 套 Modal 会叠层） */}
      {confirmingUnbind && (
        <div className="flex flex-col gap-2 pt-2 border-t border-[#212124]">
          <span className="text-[12px] leading-[18px] text-secondary">
            {t("twitter.unbindConfirm.cooldown", { days: UNBIND_COOLDOWN_DAYS })}
          </span>
          <div className="flex items-center gap-2 self-end">
            <button
              type="button"
              onClick={() => setConfirmingUnbind(false)}
              disabled={unbindMutation.isPending}
              style={{ touchAction: "manipulation" }}
              className={`${CONFIRM_BTN_BASE} text-secondary`}
            >
              {t("twitter.unbindConfirm.cancel")}
            </button>
            <button
              type="button"
              onClick={() =>
                unbindMutation.mutate(undefined, {
                  onSuccess: () => setConfirmingUnbind(false),
                  onError: () => toastError(t("twitter.bindError.unknown")),
                })
              }
              disabled={unbindMutation.isPending}
              style={{ touchAction: "manipulation" }}
              className={`${CONFIRM_BTN_BASE} text-red`}
            >
              {t("twitter.unbindConfirm.confirm")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
