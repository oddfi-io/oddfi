// /anomaly/:id — 异常事件详情（M1 只读 + M3-T21 resolve 处置）。
// 契约：03-pages.md §5，04-components.md §1，06-acceptance-and-tasks.md M3-T21。
// RBAC — presale_routes.go: resolve → readRoles = ["customer_service", "operator", "super_admin"]
import { useState } from "react";
import { Show } from "@refinedev/antd";
import { useInvalidate, useList, useShow } from "@refinedev/core";
import { Button, Card, Descriptions, Form, Select, Tag, Typography, theme } from "antd";
import type { AnomalyEvent, AnomalyStatus, Round } from "@/types/presale";
import { ROUND_NAMES } from "@/types/presale";
import { formatTs } from "@/lib/time";
import { formatAmount } from "@/lib/amount";
import { TxHashLink } from "@/components/TxHashLink";
import { RoleGuard } from "@/components/RoleGuard";
import { ConfirmMutationModal } from "@/components/ConfirmMutationModal";
import { useAnomalyActions } from "@/hooks/useAnomalyActions";
import type { AnomalyResolution } from "@/hooks/useAnomalyActions";

const STATUS_TAG: Record<AnomalyStatus, { color: string; text: string }> = {
  pending: { color: "warning", text: "待处理" },
  notified: { color: "processing", text: "已通知" },
  resolved: { color: "success", text: "已处理" },
  rejected: { color: "default", text: "已拒绝" },
};

// Resolution options — enum values from web-api service/presale_admin_anomaly.go
const RESOLUTION_OPTIONS: { value: AnomalyResolution; label: string }[] = [
  { value: "convert_to_deposit", label: "转为认购记录（convert_to_deposit）" },
  { value: "partial_credit", label: "部分确认（partial_credit）" },
  { value: "reject", label: "拒绝处理（reject）" },
];

// Resolutions that require a targetRoundId — web-api convertToDeposit enforces this.
const REQUIRES_TARGET_ROUND: AnomalyResolution[] = ["convert_to_deposit"];

export function AnomalyShow() {
  const { query } = useShow<AnomalyEvent>({ resource: "anomaly" });
  const record = query.data?.data;
  const invalidate = useInvalidate();
  const { token } = theme.useToken();

  // resolve action hook — anomalyId may be undefined while loading; safe to pass 0 as placeholder
  const anomalyActions = useAnomalyActions(record?.id ?? 0);

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<AnomalyResolution | "">("");
  const [targetRoundId, setTargetRoundId] = useState<string>("");

  // ── Rounds list for targetRoundId dropdown ───────────────────────────────────
  // Always fetch (hook must not be conditional); data is only consumed when modal is open
  // and resolution requires targetRoundId. rounds has no server-side pagination.
  const roundsQuery = useList<Round>({
    resource: "rounds",
    pagination: { mode: "off" },
  });
  const rounds: Round[] = roundsQuery.result?.data ?? [];

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const needsTargetRound = resolution !== "" && REQUIRES_TARGET_ROUND.includes(resolution as AnomalyResolution);

  const openModal = () => {
    setResolution("");
    setTargetRoundId("");
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setResolution("");
    setTargetRoundId("");
  };

  // resolve 后才有处理结果字段。
  const resolved = record ? record.status === "resolved" || record.status === "rejected" : false;
  const statusTag = record ? (STATUS_TAG[record.status] ?? { color: "default", text: record.status }) : null;

  // ── Extra fields injected into ConfirmMutationModal ───────────────────────────
  const extraFields = (
    <>
      <Form.Item
        label="处置方式"
        required
        style={{ marginBottom: token.marginSM }}
      >
        <Select<AnomalyResolution>
          options={RESOLUTION_OPTIONS}
          value={resolution === "" ? undefined : resolution}
          onChange={(v) => {
            setResolution(v);
            // Clear targetRoundId whenever resolution changes (e.g. switching away from convert_to_deposit)
            setTargetRoundId("");
          }}
          placeholder="请选择处置方式"
          style={{ width: "100%" }}
        />
      </Form.Item>
      {needsTargetRound && (
        <Form.Item
          label="目标轮次"
          required
          style={{ marginBottom: token.marginSM }}
        >
          <Select
            options={rounds.map((r) => ({
              value: r.id,
              label: ROUND_NAMES[r.id] ?? r.id,
            }))}
            value={targetRoundId === "" ? undefined : targetRoundId}
            onChange={(v: string) => setTargetRoundId(v)}
            placeholder="请选择目标轮次"
            style={{ width: "100%" }}
          />
        </Form.Item>
      )}
    </>
  );

  return (
    <Show isLoading={query.isLoading} title={record ? `异常事件 #${record.id}` : "异常事件详情"}>
      {record && (
        <>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="类型">
              <Tag>{record.eventType}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {statusTag && <Tag color={statusTag.color}>{statusTag.text}</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="TxHash" span={2}>
              <TxHashLink value={record.txHash} kind="tx" />
            </Descriptions.Item>
            <Descriptions.Item label="EOA 地址">
              <TxHashLink value={record.eoaAddress} kind="address" />
            </Descriptions.Item>
            <Descriptions.Item label="金额">
              {formatAmount(record.amountUsdt, { decimals: 2, suffix: "USDT" })}
            </Descriptions.Item>
            {resolved && (
              <>
                <Descriptions.Item label="处理方式">{record.resolution || "—"}</Descriptions.Item>
                <Descriptions.Item label="操作人">{record.operatorId || "—"}</Descriptions.Item>
                <Descriptions.Item label="备注" span={2}>
                  {record.note || "—"}
                </Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="创建时间">{formatTs(record.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatTs(record.updatedAt)}</Descriptions.Item>
            <Descriptions.Item label="说明" span={2}>
              <Typography.Text type="secondary">
                ⓘ payloadJson 后端未透出，请按类型 + 链上 tx 人工研判
              </Typography.Text>
            </Descriptions.Item>
          </Descriptions>

          {/* ── 操作区 — customer_service / operator / super_admin ──────────── */}
          {!resolved && (
            <Card title="操作" style={{ marginTop: token.marginLG }} size="small">
              <RoleGuard allow={["customer_service", "operator", "super_admin"]}>
                <Button type="primary" onClick={openModal}>
                  处置异常
                </Button>
              </RoleGuard>
            </Card>
          )}

          {/* ── Confirm modal ──────────────────────────────────────────────── */}
          <ConfirmMutationModal
            open={open}
            title="处置异常事件"
            target={[
              { label: "事件 ID", value: String(record.id) },
              { label: "EOA 地址", value: record.eoaAddress },
              { label: "金额", value: formatAmount(record.amountUsdt, { decimals: 2, suffix: "USDT" }) },
              { label: "类型", value: record.eventType },
              { label: "创建时间", value: formatTs(record.createdAt) },
            ]}
            impact="处置异常事件。后端会按 resolution 类型执行不同动作（忽略 / 手工记账 / 转 deposit / 手工退款），操作不可撤销。"
            danger={true}
            extraFields={extraFields}
            onConfirm={async ({ note, idempotencyKey }) => {
              if (!resolution) {
                throw new Error("[AnomalyShow/resolve] Resolution must be selected");
              }
              if (REQUIRES_TARGET_ROUND.includes(resolution as AnomalyResolution) && !targetRoundId) {
                throw new Error("[AnomalyShow/resolve] Target round must be selected for convert_to_deposit");
              }
              await anomalyActions.resolve({
                note,
                idempotencyKey,
                resolution: resolution as AnomalyResolution,
                targetRoundId: targetRoundId !== "" ? targetRoundId : undefined,
              });
              invalidate({ resource: "anomaly", id: record.id, invalidates: ["detail", "list"] });
              setResolution("");
              setTargetRoundId("");
            }}
            onCancel={closeModal}
          />
        </>
      )}
    </Show>
  );
}
