"use client";

/**
 * DD-148 §3.4 — OAuth 回跳结果处理。
 *
 * 后端 callback 302 回 `<locale>/home?bind=success&twitter_username=x`。本 hook 在
 * TopNavActions（layout 级）挂载，读 `window.location.search`（**不用 useSearchParams**，
 * 避免 Next 15 layout 级组件需 Suspense 边界 / app shell 退化 CSR）。
 *
 * 登录态门控（M1）：登出态返回不强开 modal（开了也是空 profile + binding 401）。
 * 等 auth hydrate 完成（isHydrated）再判定，避免 hydrate 窗口误判为登出。
 * twitter_username 仅装饰（来自 URL，用户可改），权威值以随后的 binding 重取为准。
 */
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { twitterKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/stores/authStore";
import { toastSuccess, toastInfo, toastError } from "@/lib/toast";

export type BindResultAction =
  | { kind: "success-open"; username: string }
  | { kind: "success-toast-only" }
  | { kind: "cancelled" }
  | { kind: "failed" }
  | { kind: "none" };

/**
 * 纯决策：解析 query → 行动 + 是否需清掉 query。
 * 后端 callback 现无论成功/失败都 302 回 `<locale>/home?bind=<result>`（DD-148 契约新增）：
 * - 无 bind 参数 → none，不清（避免无谓 replace）
 * - bind=success：登录 → success-open（开 modal）；未登录 → success-toast-only
 * - bind=cancelled：用户在 X 授权页取消 → cancelled（info 轻提示，非错误，无登录门控）
 * - bind=failed：其它失败（粗粒度收敛）→ failed（error toast，请重试）
 * - 其它脏 query / 非法值 → none，但清掉（不弹任何 toast）
 */
export function decideBindResult(
  search: string,
  isAuthenticated: boolean
): { action: BindResultAction; clean: boolean } {
  const params = new URLSearchParams(search);
  const bind = params.get("bind");
  if (bind === null) return { action: { kind: "none" }, clean: false };
  if (bind === "success") {
    const username = params.get("twitter_username") ?? "";
    return {
      action: isAuthenticated ? { kind: "success-open", username } : { kind: "success-toast-only" },
      clean: true,
    };
  }
  if (bind === "cancelled") return { action: { kind: "cancelled" }, clean: true };
  if (bind === "failed") return { action: { kind: "failed" }, clean: true };
  return { action: { kind: "none" }, clean: true };
}

export function useTwitterBindResult(opts: { onBound: () => void }) {
  const t = useTranslations("userSettings");
  const router = useRouter();
  const qc = useQueryClient();
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const processed = useRef(false);
  const onBoundRef = useRef(opts.onBound);
  onBoundRef.current = opts.onBound;

  useEffect(() => {
    if (processed.current) return;
    if (!isHydrated) return; // 等 auth hydrate 完成再判定登录态
    const { action, clean } = decideBindResult(window.location.search, isAuthenticated);
    if (action.kind === "none" && !clean) return;
    processed.current = true;

    if (action.kind === "success-open") {
      toastSuccess(t("twitter.bindSuccess", { username: action.username }));
      qc.invalidateQueries({ queryKey: twitterKeys.all });
      onBoundRef.current();
    } else if (action.kind === "success-toast-only") {
      toastSuccess(t("twitter.bindSuccessLoginToView"));
    } else if (action.kind === "cancelled") {
      toastInfo(t("twitter.bindCancelled"));
    } else if (action.kind === "failed") {
      toastError(t("twitter.bindFailed"));
    }

    if (clean) router.replace(window.location.pathname);
  }, [isHydrated, isAuthenticated, qc, router, t]);
}
