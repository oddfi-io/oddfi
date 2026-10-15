// useRiskDecision — 红灯人工决策 mutation（DD002 T08，§3.3 决策态状态机）。
// 幂等：X-Idempotency-Key 由 ConfirmMutationModal 的 useIdempotencyKey 生成并按其生命周期轮换。
// 终态错误码（重试无意义）单独分支：toast + invalidate 后视作"完成"关闭确认弹窗；
// 其余错误原样抛回，由 ConfirmMutationModal 内联展示、保持打开。
import { useCallback } from "react";
import { useInvalidate } from "@refinedev/core";
import { App } from "antd";
import { api, unwrap } from "@/lib/api";
import { ApiError } from "@/types/api";
import type { RiskDecisionAction, RiskDecisionResult } from "@/types/events";

export interface RiskDecisionArgs {
  action: RiskDecisionAction;
  remark: string;
  idempotencyKey: string;
}

// 决策结果：decided=正常落库；terminal=终态错误（已 toast + 刷新，调用方按成功路径关闭弹窗）。
export type DecisionOutcome =
  | { kind: "decided"; result: RiskDecisionResult }
  | { kind: "terminal" };

// 终态错误 → 提示文案；null = 非终态（交还弹窗内联报错）。
// ★ UPSTREAM_UNAVAILABLE 刻意不进终态（Step 0-3 口径）：上游瞬断属可重试场景 →
//   返回 null → decide() 原样抛出 → ConfirmMutationModal 内联展示 ERROR_MAP 文案
//   「上游服务暂不可用，请稍后重试」并保持弹窗打开，用户可原地重试。
//   重试安全性：弹窗对 ApiError 会轮换幂等 key（body 未变也安全——若首次实际已落库，
//   重试会撞 admin_risk_decisions 唯一约束 → RISK_DECISION_CONFLICT → 走上面的终态分支收敛）。
export function terminalDecisionNotice(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  switch (err.errorCode) {
    case "EVENT_NOT_RED_SIGNAL":
      return "该赛事已不是红灯，列表已刷新";
    case "RISK_DECISION_CONFLICT":
      return "已有其他管理员处理过该赛事，列表已刷新";
    default:
      return null;
  }
}

// 纯请求函数（供测试直测，不依赖 React 上下文）。
export async function submitRiskDecision(
  eventId: string,
  args: RiskDecisionArgs,
): Promise<RiskDecisionResult> {
  return unwrap<RiskDecisionResult>(
    api.post(`admin/events/${encodeURIComponent(eventId)}/risk-decision`, {
      json: { action: args.action, remark: args.remark },
      headers: { "X-Idempotency-Key": args.idempotencyKey },
    }),
  );
}

export function useRiskDecision(): {
  decide: (eventId: string, args: RiskDecisionArgs) => Promise<DecisionOutcome>;
} {
  const invalidate = useInvalidate();
  const { message } = App.useApp();

  const decide = useCallback(
    async (eventId: string, args: RiskDecisionArgs): Promise<DecisionOutcome> => {
      const refreshList = () =>
        invalidate({ resource: "events", invalidates: ["list"] });
      try {
        const result = await submitRiskDecision(eventId, args);
        void refreshList();
        return { kind: "decided", result };
      } catch (e) {
        const notice = terminalDecisionNotice(e);
        if (notice) {
          message.warning(notice);
          void refreshList();
          return { kind: "terminal" };
        }
        throw e;
      }
    },
    [invalidate, message],
  );

  return { decide };
}
