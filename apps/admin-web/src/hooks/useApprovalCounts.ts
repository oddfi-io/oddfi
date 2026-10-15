// useApprovalCounts — 铃铛 badge 计数 30s 轮询（DD002 T08）。
// 失败降级（M-Arch-4）：counts 失败保持上次成功值，不弹错不归零——
// TanStack Query 出错时保留旧 data；这里关闭 Refine 错误通知，仅 console.warn。
import { useEffect } from "react";
import { useCustom } from "@refinedev/core";
import type { ApprovalCounts } from "@/types/events";

export function useApprovalCounts(): {
  counts: ApprovalCounts | undefined;
  refetch: () => void;
} {
  const q = useCustom<ApprovalCounts>({
    url: "admin/approval/counts",
    method: "get",
    errorNotification: false,
    queryOptions: { refetchInterval: 30000 },
  });

  const isError = q.query.isError;
  useEffect(() => {
    if (isError) {
      console.warn("[useApprovalCounts] counts fetch failed — keeping last value");
    }
  }, [isError]);

  return {
    counts: q.result?.data,
    refetch: () => {
      void q.query.refetch();
    },
  };
}

// 乐观更新后的 badge 展示值：服务端计数 − 本地已决策数，钳 ≥0。
// 服务端未返回过任何值（首载失败）→ 0（不弹错，铃铛无红点）。
export function badgeValue(
  serverCount: number | undefined,
  locallyDecided: number,
): number {
  if (serverCount == null) return 0;
  return Math.max(0, serverCount - locallyDecided);
}
