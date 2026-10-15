"use client";

/**
 * DD-148 §3.2 — 解绑（幂等）。
 *
 * 成功后失效整个 ['twitter'] 前缀（binding + follow 一起重取，回到未绑定态）。
 * 注意：后端对同号解绑后强制 30 天冷却（前端不实现，仅在确认弹窗文案提示）。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { twitterKeys } from "@/lib/query-keys";
import { unbindTwitter } from "../api";

export function useUnbindTwitter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: unbindTwitter,
    onSuccess: () => qc.invalidateQueries({ queryKey: twitterKeys.all }),
  });
}
