// 审批中心弹窗（DD002 T08）。顶栏铃铛呼出，任何页面可用。
// 队列口径（D4）：只收 red 且未决策（orange 仅列表可筛不入队）；
// Claim Tab 本期占位置灰（badge 0，「待接入」）。
// 决策成功乐观更新（§3.3 状态机）：该卡退队（本地过滤）+ badge−1（onDecided 上抛）
// + invalidate events list（行内降级 orange +「已人工处理」由服务端字段驱动）。
import { useState } from "react";
import { useList } from "@refinedev/core";
import { Badge, Card, Collapse, Empty, Modal, Skeleton, Space, Tabs, Typography, Button } from "antd";
import { AmountText } from "@/components/AmountText";
import { ConfirmMutationModal } from "@/components/ConfirmMutationModal";
import { RoleGuard } from "@/components/RoleGuard";
import { SignalTag } from "@/components/SignalTag";
import { useRiskDecision } from "@/hooks/useRiskDecision";
import { formatTs } from "@/lib/time";
import type { RiskDecisionAction, RiskEvent } from "@/types/events";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 服务端红灯未决策计数（badge 数据源，AdminHeader 的 useApprovalCounts） */
  eventCount: number;
  /** 本地已决策 event_id（乐观退队；与 AdminHeader 的 badge 减扣同源） */
  locallyDecided: string[];
  onDecided: (eventId: string) => void;
  /** 决策后立刻刷新 counts（invalidate 兜底之外的即时校准） */
  refetchCounts: () => void;
}

interface PendingAction {
  event: RiskEvent;
  action: RiskDecisionAction;
}

const ACTION_META: Record<RiskDecisionAction, { label: string; danger: boolean; impact: string }> = {
  approve_continue: {
    label: "恢复开盘",
    danger: false,
    impact: "人工评估后恢复该赛事开盘展示。一期仅落库决策记录与退出审批队列，不触发链上操作（链上停单由合约自治）。",
  },
  stop: {
    label: "维持停单",
    danger: true,
    impact: "确认维持停单状态。该赛事将退出审批队列，列表行降级标注「已人工处理」；链上 signal 重新升红会自动重新入队。",
  },
};

// 规则说明折叠区 —— ★ 纯展示文案，非判级源（D1 边界）：判级只在 web-api 一处；
// 合约/后端阈值配置变更时，必须人工同步修改此文案。
const RULES_TEXT = (
  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
    单方向最坏敞口 L：≤ $8,000 绿灯 ／ ≤ $18,000 黄灯 ／ ≤ $28,000 橙灯 ／ &gt; $28,000
    红灯（红灯时合约自动停止接单）。赔率调整按「重注方向压缩、轻注方向上浮」执行压缩率。
    以上为展示口径，实际判级以后端返回的 signal 为准。
  </Typography.Paragraph>
);

export function ApprovalCenterModal({
  open,
  onClose,
  eventCount,
  locallyDecided,
  onDecided,
  refetchCounts,
}: Props) {
  const { decide } = useRiskDecision();
  const [pending, setPending] = useState<PendingAction | null>(null);

  // 红灯未决策队列；仅弹窗打开时拉取/轮询。
  const queueQuery = useList<RiskEvent>({
    resource: "events",
    filters: [
      { field: "signal", operator: "in", value: ["red"] },
      { field: "pending_decision", operator: "eq", value: true },
    ],
    pagination: { currentPage: 1, pageSize: 50 },
    errorNotification: false,
    queryOptions: { enabled: open, refetchInterval: open ? 30000 : false },
  });

  // 客户端兜底（M-Code-5）：pending_decision 作为列表筛选参数未经契约确认（服务端可能忽略），
  // 且缓存窗口期可能返回已决策行 —— 双保险按响应字段再过滤一次。
  const queue = (queueQuery.result?.data ?? []).filter(
    (e) => e.pending_decision && !locallyDecided.includes(e.event_id),
  );

  const eventsTab = (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Collapse
        size="small"
        items={[{ key: "rules", label: "判级规则说明", children: RULES_TEXT }]}
      />
      {queueQuery.query.isLoading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : queue.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有待审批的红灯赛事" />
      ) : (
        queue.map((e) => (
          <Card key={e.event_id} size="small">
            <Space style={{ width: "100%", justifyContent: "space-between" }} align="start">
              <Space direction="vertical" size={2}>
                <Space size={8}>
                  <SignalTag signal={e.signal} opened={e.opened} />
                  <Typography.Text strong>{e.event_name}</Typography.Text>
                </Space>
                <Typography.Text type="secondary">
                  {e.sport} · {e.league} · 开赛 {formatTs(e.times.kickoff)}
                </Typography.Text>
                <Space size="large">
                  <span>
                    最大敞口 <AmountText value={e.max_exposure} />
                  </span>
                  <span>
                    投注总额 <AmountText value={e.bet_amount_total} />
                  </span>
                </Space>
              </Space>
              {/* 决策按钮仅 operator/super_admin 可见；finance/cs 卡片可见按钮隐藏（后端 403 兜底） */}
              <RoleGuard allow={["operator", "super_admin"]}>
                <Space>
                  <Button onClick={() => setPending({ event: e, action: "approve_continue" })}>
                    恢复开盘
                  </Button>
                  <Button danger onClick={() => setPending({ event: e, action: "stop" })}>
                    维持停单
                  </Button>
                </Space>
              </RoleGuard>
            </Space>
          </Card>
        ))
      )}
    </Space>
  );

  const claimTab = (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Claim 审批待接入" />
  );

  const meta = pending ? ACTION_META[pending.action] : null;

  return (
    <>
      <Modal open={open} onCancel={onClose} footer={null} width={760} title="审批中心">
        <Tabs
          items={[
            {
              key: "events",
              label: (
                <Space size={6}>
                  赛事审批
                  <Badge count={eventCount} size="small" />
                </Space>
              ),
              children: eventsTab,
            },
            {
              key: "claim",
              label: (
                // 占位置灰：无 badge（计数恒 0），文字 secondary
                <Typography.Text type="secondary">Claim 审批（0）</Typography.Text>
              ),
              children: claimTab,
            },
          ]}
        />
      </Modal>

      {pending && meta ? (
        <ConfirmMutationModal
          open
          title={`${meta.label} — ${pending.event.event_name}`}
          danger={meta.danger}
          target={[
            { label: "赛事", value: pending.event.event_name },
            { label: "联赛", value: `${pending.event.sport} · ${pending.event.league}` },
            { label: "动作", value: meta.label },
          ]}
          impact={meta.impact}
          notePlaceholder="请输入决策备注（≥10 字符，落审计与决策记录）"
          onConfirm={async ({ note, idempotencyKey }) => {
            const outcome = await decide(pending.event.event_id, {
              action: pending.action,
              remark: note,
              idempotencyKey,
            });
            // decided：乐观退队 + badge−1；terminal：已 toast + invalidate，按完成关闭。
            // 弹窗关闭由 ConfirmMutationModal 成功路径回调 onCancel（→ setPending(null)）完成。
            if (outcome.kind === "decided") {
              onDecided(pending.event.event_id);
            }
            refetchCounts();
          }}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </>
  );
}
