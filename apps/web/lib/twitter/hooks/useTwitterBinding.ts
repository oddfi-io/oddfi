"use client";

/**
 * DD-148 §3.2 — 当前推特绑定态查询（权威源）。
 *
 * enabled = 登录态 && modal 打开（由调用方传入）。key 按 address 隔离，
 * 避免切账号 30s staleTime 窗口内闪现上个用户的绑定态。
 * 503（功能未就绪）已在数据层归一为 `{bound:false, disabled:true}`，不会进入 error 分支。
 */
import { useQuery } from "@tanstack/react-query";
import { twitterKeys } from "@/lib/query-keys";
import { getTwitterBinding } from "../api";

export function useTwitterBinding(opts: { enabled: boolean; address: string | undefined }) {
  return useQuery({
    queryKey: twitterKeys.binding(opts.address),
    queryFn: getTwitterBinding,
    enabled: opts.enabled,
    staleTime: 30_000,
  });
}
