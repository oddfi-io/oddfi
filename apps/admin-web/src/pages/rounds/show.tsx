// /rounds/:id — 轮次详情（M2: 操作区 + 5 action buttons；M3-T18: 编辑字段 PATCH）。
// 契约：docs/spa-presale-admin/03-pages.md §3，04-components.md §1。
import { useState } from "react";
import { Show } from "@refinedev/antd";
import { useInvalidate, useShow } from "@refinedev/core";
import { Button, Card, DatePicker, Descriptions, Form, InputNumber, Space, theme } from "antd";
import dayjs from "dayjs";
import type { Round } from "@/types/presale";
import { ROUND_NAMES } from "@/types/presale";
import { formatTs } from "@/lib/time";
import { formatAmount } from "@/lib/amount";
import { RoundStatusTag } from "@/components/RoundStatusTag";
import { RoundStatusFlow } from "@/components/RoundStatusFlow";
import { RoleGuard } from "@/components/RoleGuard";
import { ConfirmMutationModal } from "@/components/ConfirmMutationModal";
import { useRoundActions } from "@/hooks/useRoundActions";
import { useRoundEdit } from "@/hooks/useRoundEdit";
import type { RoundEditPayload } from "@/hooks/useRoundEdit";
import { availableRoundActions } from "./_actions";
import type { RoundActionType } from "./_actions";

// RBAC — backend presale_routes.go:
//   pause / resume / reopen / close / updateReferralPct → operatorPlus = ["operator", "super_admin"]
//   (reopen is NOT super_admin-only — confirmed from presale_routes.go line 51)
//   editFields (PATCH /rounds/:id) → super_admin only (M3-T18)
const OPERATOR_PLUS = ["operator", "super_admin"] as const;

// editFields is not a state-machine action — it's a separate dimension (super_admin only, any status).
// Kept as a local union so activeAction can track it without polluting _actions.ts.
type ActiveActionType = RoundActionType | "editFields";

export function RoundsShow() {
  const { query } = useShow<Round>({ resource: "rounds" });
  const record = query.data?.data;
  const invalidate = useInvalidate();
  const roundActions = useRoundActions(record?.id ?? "");
  const roundEdit = useRoundEdit(record?.id ?? "");
  const { token } = theme.useToken();

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [activeAction, setActiveAction] = useState<ActiveActionType | null>(null);

  // Controlled state for updateReferralPct extra field
  const [referralInput, setReferralInput] = useState<string>("");

  // Controlled state for editFields PATCH payload (M3-T18)
  const [editPayload, setEditPayload] = useState<RoundEditPayload>({});

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const openModal = (action: ActiveActionType) => {
    // Clear per-action controlled inputs whenever opening any modal so stale
    // values from a previous session don't leak into the new modal.
    if (action !== "updateReferralPct") {
      setReferralInput("");
    }
    if (action !== "editFields") {
      setEditPayload({});
    }
    setActiveAction(action);
  };
  const closeModal = () => {
    setActiveAction(null);
    setReferralInput("");
    setEditPayload({});
  };

  const handleInvalidate = () => {
    if (!record) return;
    invalidate({ resource: "rounds", id: record.id, invalidates: ["detail", "list"] });
  };

  // ── Per-action modal config ──────────────────────────────────────────────────
  // These are only computed when record is available.
  const getModalProps = (action: ActiveActionType | null) => {
    if (!record || !action) return null;

    const roundName = ROUND_NAMES[record.id] ?? record.id;

    switch (action) {
      case "pause":
        return {
          title: `暂停轮次 · ${roundName}`,
          target: [
            { label: "轮次 ID", value: record.id },
            { label: "当前状态", value: record.status },
            { label: "已售份额", value: formatAmount(record.soldOdd, { decimals: 0, suffix: "ODD" }) },
            { label: "已募金额", value: formatAmount(record.raisedUsd, { decimals: 2, suffix: "USD" }) },
          ],
          impact: "暂停后用户无法继续认购，直到 resume。链上到账仍会处理（走 paused_arrival）。",
          danger: true,
          onConfirm: async ({ note, idempotencyKey }: { note: string; idempotencyKey: string }) => {
            await roundActions.pause({ note, idempotencyKey });
            handleInvalidate();
          },
        };

      case "resume":
        return {
          title: `恢复轮次 · ${roundName}`,
          target: [
            { label: "轮次 ID", value: record.id },
            { label: "当前状态", value: record.status },
          ],
          impact: "恢复 active 状态，用户可继续认购。",
          danger: false,
          onConfirm: async ({ note, idempotencyKey }: { note: string; idempotencyKey: string }) => {
            await roundActions.resume({ note, idempotencyKey });
            handleInvalidate();
          },
        };

      case "reopen":
        return {
          title: `重开轮次 · ${roundName}`,
          target: [
            { label: "轮次 ID", value: record.id },
            { label: "当前状态", value: record.status },
            { label: "时间窗 (+08)", value: `${formatTs(record.startTs)} → ${formatTs(record.endTs)}` },
          ],
          impact: "重开已结束轮次，end_ts 不变，补仓完成后须手动关闭。",
          danger: true,
          onConfirm: async ({ note, idempotencyKey }: { note: string; idempotencyKey: string }) => {
            await roundActions.reopen({ note, idempotencyKey });
            handleInvalidate();
          },
        };

      case "close":
        return {
          title: `关闭轮次 · ${roundName}`,
          target: [
            { label: "轮次 ID", value: record.id },
            { label: "当前状态", value: record.status },
            { label: "已售份额", value: formatAmount(record.soldOdd, { decimals: 0, suffix: "ODD" }) },
            { label: "已募金额", value: formatAmount(record.raisedUsd, { decimals: 2, suffix: "USD" }) },
          ],
          impact: "手动结束本轮，cron 不再自动推进。此操作不可逆。",
          danger: true,
          onConfirm: async ({ note, idempotencyKey }: { note: string; idempotencyKey: string }) => {
            await roundActions.close({ note, idempotencyKey });
            handleInvalidate();
          },
        };

      case "updateReferralPct":
        return {
          title: `改返佣比例 · ${roundName}`,
          target: [
            { label: "轮次 ID", value: record.id },
            { label: "当前返佣 %", value: formatAmount(record.referralRewardPct, { decimals: 2 }) },
          ],
          impact: "仅影响后续新入账的返佣计算，历史 deposit 快照不变。",
          danger: false,
          extraFields: (
            <Form.Item
              label="新的返佣比例 (%)"
              required
              style={{ marginBottom: 0 }}
            >
              <InputNumber
                stringMode
                min="0"
                max="100"
                precision={2}
                value={referralInput === "" ? undefined : referralInput}
                onChange={(v) => setReferralInput(v != null ? String(v) : "")}
                placeholder="0.00"
                style={{ width: "100%" }}
              />
            </Form.Item>
          ),
          onConfirm: async ({ note, idempotencyKey }: { note: string; idempotencyKey: string }) => {
            await roundActions.updateReferralPct({
              note,
              idempotencyKey,
              referralRewardPct: referralInput,
            });
            handleInvalidate();
          },
        };

      case "editFields":
        return {
          title: `改字段 · ${roundName}`,
          target: [
            { label: "轮次 ID", value: record.id },
            { label: "状态", value: record.status },
            { label: "当前单价", value: formatAmount(record.priceUsd, { decimals: 4, suffix: "USD" }) },
            { label: "当前供给", value: formatAmount(record.supplyOdd, { decimals: 0, suffix: "ODD" }) },
            { label: "当前结束时间 (+08)", value: formatTs(record.endTs) },
            { label: "单笔下限", value: formatAmount(record.minPerOrderUsd, { decimals: 2, suffix: "USD" }) },
            { label: "单钱包上限", value: formatAmount(record.maxPerWalletUsd, { decimals: 2, suffix: "USD" }) },
            { label: "TGE 释放 %", value: formatAmount(record.tgeReleasePct, { decimals: 2 }) },
            { label: "线性释放天数", value: String(record.linearReleaseDays) },
          ],
          impact: "高敏操作：修改轮次核心参数。如果轮已 active 且改 priceUsd/supplyOdd 等会影响下游计算，请谨慎。改完不可撤销。",
          danger: true,
          extraFields: (
            <>
              <Form.Item label="新单价 USD（留空=不改）" style={{ marginBottom: 8 }}>
                <InputNumber
                  stringMode
                  min="0"
                  precision={4}
                  value={editPayload.priceUsd ?? undefined}
                  onChange={(v) =>
                    setEditPayload((prev) => ({
                      ...prev,
                      priceUsd: v != null ? String(v) : undefined,
                    }))
                  }
                  placeholder={record.priceUsd}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item label="新供给 ODD（留空=不改）" style={{ marginBottom: 8 }}>
                <InputNumber
                  stringMode
                  min="0"
                  precision={0}
                  value={editPayload.supplyOdd ?? undefined}
                  onChange={(v) =>
                    setEditPayload((prev) => ({
                      ...prev,
                      supplyOdd: v != null ? String(v) : undefined,
                    }))
                  }
                  placeholder={record.supplyOdd}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item label="新结束时间（留空=不改）" style={{ marginBottom: 8 }}>
                <DatePicker
                  showTime
                  value={editPayload.endTs != null ? dayjs(editPayload.endTs) : null}
                  onChange={(d) =>
                    setEditPayload((prev) => ({
                      ...prev,
                      endTs: d != null ? d.valueOf() : undefined,
                    }))
                  }
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item label="新单笔下限 USD（留空=不改）" style={{ marginBottom: 8 }}>
                <InputNumber
                  stringMode
                  min="0"
                  precision={2}
                  value={editPayload.minPerOrderUsd ?? undefined}
                  onChange={(v) =>
                    setEditPayload((prev) => ({
                      ...prev,
                      minPerOrderUsd: v != null ? String(v) : undefined,
                    }))
                  }
                  placeholder={record.minPerOrderUsd}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item label="新单钱包上限 USD（留空=不改）" style={{ marginBottom: 8 }}>
                <InputNumber
                  stringMode
                  min="0"
                  precision={2}
                  value={editPayload.maxPerWalletUsd ?? undefined}
                  onChange={(v) =>
                    setEditPayload((prev) => ({
                      ...prev,
                      maxPerWalletUsd: v != null ? String(v) : undefined,
                    }))
                  }
                  placeholder={record.maxPerWalletUsd}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item label="新 TGE 释放 %（留空=不改）" style={{ marginBottom: 8 }}>
                <InputNumber
                  stringMode
                  min="0"
                  max="100"
                  precision={2}
                  value={editPayload.tgeReleasePct ?? undefined}
                  onChange={(v) =>
                    setEditPayload((prev) => ({
                      ...prev,
                      tgeReleasePct: v != null ? String(v) : undefined,
                    }))
                  }
                  placeholder={record.tgeReleasePct}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item label="新线性释放天数（留空=不改）" style={{ marginBottom: 0 }}>
                <InputNumber
                  min={0}
                  precision={0}
                  value={editPayload.linearReleaseDays ?? undefined}
                  onChange={(v) =>
                    setEditPayload((prev) => ({
                      ...prev,
                      linearReleaseDays: v != null ? Math.trunc(v) : undefined,
                    }))
                  }
                  placeholder={String(record.linearReleaseDays)}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </>
          ),
          onConfirm: async ({ note, idempotencyKey }: { note: string; idempotencyKey: string }) => {
            // Collect only fields that were explicitly set (non-undefined)
            const payload: RoundEditPayload = {};
            if (editPayload.priceUsd != null) payload.priceUsd = editPayload.priceUsd;
            if (editPayload.supplyOdd != null) payload.supplyOdd = editPayload.supplyOdd;
            if (editPayload.endTs != null) payload.endTs = editPayload.endTs;
            if (editPayload.minPerOrderUsd != null) payload.minPerOrderUsd = editPayload.minPerOrderUsd;
            if (editPayload.maxPerWalletUsd != null) payload.maxPerWalletUsd = editPayload.maxPerWalletUsd;
            if (editPayload.tgeReleasePct != null) payload.tgeReleasePct = editPayload.tgeReleasePct;
            if (editPayload.linearReleaseDays != null) payload.linearReleaseDays = editPayload.linearReleaseDays;
            if (Object.keys(payload).length === 0) {
              throw new Error("[RoundsShow/editFields] At least one field must be modified before submitting");
            }
            await roundEdit.updateRound({ note, idempotencyKey, ...payload });
            handleInvalidate();
            setEditPayload({});
          },
        };
    }
  };

  const actions = record ? availableRoundActions(record.status) : null;
  const modalProps = getModalProps(activeAction);

  return (
    <Show
      isLoading={query.isLoading}
      title={record ? (ROUND_NAMES[record.id] ?? record.id) : "轮次详情"}
    >
      {record && (
        <>
          {/* ── 状态机可视化 ──────────────────────────────────────────────── */}
          <Card size="small" style={{ marginBottom: token.marginMD }}>
            <RoundStatusFlow
              status={record.status}
              manualOverride={record.manualOverride}
            />
          </Card>

          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="轮次 ID">{record.id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <RoundStatusTag status={record.status} />
            </Descriptions.Item>
            <Descriptions.Item label="单价">
              {formatAmount(record.priceUsd, { decimals: 4, suffix: "USD" })}
            </Descriptions.Item>
            <Descriptions.Item label="供给">
              {formatAmount(record.supplyOdd, { decimals: 0, suffix: "ODD" })}
            </Descriptions.Item>
            <Descriptions.Item label="已售">
              {formatAmount(record.soldOdd, { decimals: 0, suffix: "ODD" })}
            </Descriptions.Item>
            <Descriptions.Item label="已募">
              {formatAmount(record.raisedUsd, { decimals: 2, suffix: "USD" })}
            </Descriptions.Item>
            <Descriptions.Item label="返佣 %">
              {formatAmount(record.referralRewardPct, { decimals: 2 })}
            </Descriptions.Item>
            <Descriptions.Item label="TGE 释放 %">
              {formatAmount(record.tgeReleasePct, { decimals: 2 })}
            </Descriptions.Item>
            <Descriptions.Item label="线性释放天数">{record.linearReleaseDays}</Descriptions.Item>
            <Descriptions.Item label="单笔下限">
              {formatAmount(record.minPerOrderUsd, { decimals: 2, suffix: "USD" })}
            </Descriptions.Item>
            <Descriptions.Item label="单钱包上限">
              {formatAmount(record.maxPerWalletUsd, { decimals: 2, suffix: "USD" })}
            </Descriptions.Item>
            <Descriptions.Item label="手动干预">
              {record.manualOverride ? "是 · cron 已停止自动推进" : "否"}
            </Descriptions.Item>
            <Descriptions.Item label="时间窗 (+08)" span={2}>
              {formatTs(record.startTs)} → {formatTs(record.endTs)}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTs(record.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatTs(record.updatedAt)}</Descriptions.Item>
          </Descriptions>

          {/* ── 操作区 ─────────────────────────────────────────────────────── */}
          <Card title="操作" style={{ marginTop: token.marginLG }} size="small">
            <Space wrap>
              {/* 暂停 — active → paused */}
              <RoleGuard allow={[...OPERATOR_PLUS]}>
                {actions?.pause ? (
                  <Button
                    danger
                    onClick={() => openModal("pause")}
                  >
                    暂停
                  </Button>
                ) : null}
              </RoleGuard>

              {/* 恢复 — paused → active */}
              <RoleGuard allow={[...OPERATOR_PLUS]}>
                {actions?.resume ? (
                  <Button onClick={() => openModal("resume")}>
                    恢复
                  </Button>
                ) : null}
              </RoleGuard>

              {/* 重开 — ended → active */}
              <RoleGuard allow={[...OPERATOR_PLUS]}>
                {actions?.reopen ? (
                  <Button
                    danger
                    onClick={() => openModal("reopen")}
                  >
                    重开
                  </Button>
                ) : null}
              </RoleGuard>

              {/* 关闭 — active|paused → ended */}
              <RoleGuard allow={[...OPERATOR_PLUS]}>
                {actions?.close ? (
                  <Button
                    danger
                    onClick={() => openModal("close")}
                  >
                    关闭
                  </Button>
                ) : null}
              </RoleGuard>

              {/* 改返佣 — any status */}
              <RoleGuard allow={[...OPERATOR_PLUS]}>
                <Button onClick={() => openModal("updateReferralPct")}>
                  改返佣 %
                </Button>
              </RoleGuard>

              {/* 编辑字段 — super_admin only, any status (M3-T18, not a state-machine action) */}
              <RoleGuard allow={["super_admin"]}>
                <Button onClick={() => openModal("editFields")}>
                  编辑字段
                </Button>
              </RoleGuard>
            </Space>
          </Card>

          {/* ── Confirm modal ──────────────────────────────────────────────── */}
          {modalProps && (
            <ConfirmMutationModal
              open={activeAction !== null}
              title={modalProps.title}
              target={modalProps.target}
              impact={modalProps.impact}
              danger={modalProps.danger}
              extraFields={modalProps.extraFields}
              onConfirm={modalProps.onConfirm}
              onCancel={closeModal}
            />
          )}
        </>
      )}
    </Show>
  );
}
