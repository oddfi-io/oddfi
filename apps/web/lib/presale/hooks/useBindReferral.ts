"use client";

/**
 * DD-119 §7.2 POST /referral/bind（站点级）。URL 自动绑（source:link）/ 手动绑（source:manual）。
 * 成功后失效 referral 查询。错误码处理（40903 静默 / 40404 / 40004）由调用方按场景决定。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { referralKeys } from "@/lib/query-keys";
import { bindReferral } from "../api";
import type { BindReq } from "../types";

export function useBindReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BindReq) => bindReferral(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: referralKeys.all }),
  });
}
