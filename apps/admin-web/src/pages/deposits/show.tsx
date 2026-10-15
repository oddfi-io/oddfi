// /deposits/:txHash — 入账详情（M1 只读 + M3-T20 migrate-round 高敏 mutation）。
// 契约：03-pages.md §4，07-ui-wireframes.md §8，06-acceptance-and-tasks.md M3-T20。
import { useState } from "react";
import { Show } from "@refinedev/antd";
import { useInvalidate, useList, useShow } from "@refinedev/core";
import { Button, Card, Descriptions, Form, Select, Space, Tag, theme } from "antd";
import type { Deposit, DepositStatus, Round } from "@/types/presale";
import { ROUND_NAMES } from "@/types/presale";
import { formatTs } from "@/lib/time";
import { formatAmount } from "@/lib/amount";
import { TxHashLink } from "@/components/TxHashLink";
import { RoleGuard } from "@/components/RoleGuard";
import { ConfirmMutationModal } from "@/components/ConfirmMutationModal";
import { useDepositActions } from "@/hooks/useDepositActions";

const STATUS_TAG: Record<DepositStatus, { color: string; text: string }> = {
  confirmed: { color: "success", text: "确认" },
  pending: { color: "processing", text: "待确认" },
  anomaly: { color: "error", text: "异常" },
};

// operatorPlus — mirrors backend presale_routes.go line 62
const OPERATOR_PLUS = ["operator", "super_admin"] as const;

export function DepositsShow() {
  // id 即 txHash（resource meta 路由 :txHash）。
  const { query } = useShow<Deposit>({ resource: "deposits" });
  const record = query.data?.data;
  const invalidate = useInvalidate();
  const depositActions = useDepositActions(record?.txHash ?? "");
  const { token } = theme.useToken();

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [migrateOpen, setMigrateOpen] = useState(false);
  // Controlled state for targetRoundId dropdown — reset on modal close
  const [targetRoundId, setTargetRoundId] = useState<string>("");

  // ── Rounds list for dropdown ─────────────────────────────────────────────────
  // Fetched once (pagination: mode off — backend returns all 6 rounds, no paging).
  const roundsQuery = useList<Round>({ resource: "rounds", pagination: { mode: "off" } });
  const rounds = roundsQuery.result?.data ?? [];

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const openModal = () => {
    setTargetRoundId("");
    setMigrateOpen(true);
  };
  const closeModal = () => {
    setMigrateOpen(false);
    setTargetRoundId("");
  };

  const handleInvalidate = () => {
    if (!record) return;
    invalidate({ resource: "deposits", id: record.txHash, invalidates: ["detail", "list"] });
  };

  const statusTag = record
    ? (STATUS_TAG[record.status] ?? { color: "default", text: record.status })
    : null;

  // ── Modal onConfirm ───────────────────────────────────────────────────────────
  const handleMigrateConfirm = async ({
    note,
    idempotencyKey,
  }: {
    note: string;
    idempotencyKey: string;
  }): Promise<void> => {
    if (!targetRoundId) {
      throw new Error("[DepositsShow/migrateRound] Target round must be selected");
    }
    if (!record) {
      throw new Error("[DepositsShow/migrateRound] Deposit record not loaded");
    }
    if (targetRoundId === record.roundId) {
      throw new Error(
        "[DepositsShow/migrateRound] Target round is the same as the current round — no-op migration",
      );
    }
    await depositActions.migrateRound({ note, idempotencyKey, targetRoundId });
    handleInvalidate();
    setTargetRoundId("");
  };

  return (
    <Show isLoading={query.isLoading} title="入账详情">
      {record && (
        <>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="TxHash" span={2}>
              <TxHashLink value={record.txHash} kind="tx" />
            </Descriptions.Item>
            <Descriptions.Item label="EOA 地址">
              <TxHashLink value={record.eoaAddress} kind="address" />
            </Descriptions.Item>
            <Descriptions.Item label="金库地址">
              <TxHashLink value={record.vaultAddress} kind="address" />
            </Descriptions.Item>
            <Descriptions.Item label="轮次">{ROUND_NAMES[record.roundId] ?? record.roundId}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {statusTag && <Tag color={statusTag.color}>{statusTag.text}</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="金额">
              {formatAmount(record.amountUsdt, { decimals: 2, suffix: "USDT" })}
            </Descriptions.Item>
            <Descriptions.Item label="份额">
              {formatAmount(record.sharesOdd, { decimals: 2, suffix: "ODD" })}
            </Descriptions.Item>
            <Descriptions.Item label="区块时间 (+08)" span={2}>
              {formatTs(record.blockTs)}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTs(record.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatTs(record.updatedAt)}</Descriptions.Item>
          </Descriptions>

          {/* ── 操作区 ─────────────────────────────────────────────────────── */}
          <Card title="操作" style={{ marginTop: token.marginLG }} size="small">
            <Space wrap>
              <RoleGuard allow={[...OPERATOR_PLUS]}>
                <Button danger onClick={openModal}>
                  迁移轮次
                </Button>
              </RoleGuard>
            </Space>
          </Card>

          {/* ── Confirm modal ──────────────────────────────────────────────── */}
          <ConfirmMutationModal
            open={migrateOpen}
            title="迁移 deposit 到另一轮次"
            target={[
              { label: "TxHash", value: record.txHash },
              { label: "当前轮次", value: ROUND_NAMES[record.roundId] ?? record.roundId },
              { label: "EOA 地址", value: record.eoaAddress },
              { label: "金额", value: formatAmount(record.amountUsdt, { decimals: 2, suffix: "USDT" }) },
              { label: "状态", value: statusTag?.text ?? record.status },
            ]}
            impact="高敏操作：将此笔 deposit 的归属从当前轮次迁移到目标轮次。会影响：① 目标轮次的份额/募集累计 ② 用户在目标轮次的释放计划。历史快照不变。后端限频 10/min，触及 MIGRATE_LIMIT_EXCEEDED 须停止。"
            danger
            extraFields={
              <Form.Item label="目标轮次" required style={{ marginBottom: 0 }}>
                <Select
                  placeholder="请选择目标轮次"
                  value={targetRoundId || undefined}
                  onChange={(v: string) => setTargetRoundId(v)}
                  loading={roundsQuery.query.isLoading}
                  style={{ width: "100%" }}
                  options={rounds
                    .filter((r) => r.id !== record.roundId)
                    .map((r) => ({
                      value: r.id,
                      label: `${ROUND_NAMES[r.id] ?? r.id} · ${r.id} · ${r.status}`,
                    }))}
                />
              </Form.Item>
            }
            onConfirm={handleMigrateConfirm}
            onCancel={closeModal}
          />
        </>
      )}
    </Show>
  );
}
