"use client";

/**
 * DD-148 §3.2 — 发起绑定（整页跳转 OAuth）。
 *
 * 成功拿到后端授权 URL → window.location.assign 整页跳转（弃 popup：后端 302 整页回跳更稳）。
 * 失败抛 TwitterBindUrlError（kind: user_already_bound / disabled / unknown），
 * 调用方读 mutation.error 走 i18n 文案分支（toast 需翻译，留在组件层）。
 */
import { useMutation } from "@tanstack/react-query";
import { getTwitterBindUrl } from "../api";

export function useBindTwitter() {
  return useMutation({
    mutationFn: getTwitterBindUrl,
    onSuccess: (url: string) => {
      window.location.assign(url);
    },
  });
}
