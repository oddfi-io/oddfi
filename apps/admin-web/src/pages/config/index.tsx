// /config — 全局配置（M1 只读 + M3 super_admin PATCH）。单行资源用 useCustom（非 useTable）。
// larkWebhookUrl 前端打码、不给复制按钮（ISSUE-001 缓解）。
// 契约：03-pages.md §6，07-ui-wireframes.md §10，06-acceptance-and-tasks.md M3-T19。
import { useState } from "react";
import { useInvalidate, useCustom } from "@refinedev/core";
import { Alert, Button, Card, Descriptions, Form, Input, InputNumber, Spin, Space, Typography, theme } from "antd";
import type { PresaleConfig } from "@/types/presale";
import type { ConfigPatchPayload } from "@/hooks/useConfigMutation";
import { useConfigMutation } from "@/hooks/useConfigMutation";
import { formatTs } from "@/lib/time";
import { formatAmount } from "@/lib/amount";
import { TxHashLink } from "@/components/TxHashLink";
import { RoleGuard } from "@/components/RoleGuard";
import { ConfirmMutationModal } from "@/components/ConfirmMutationModal";

// BSC EOA / contract address validator: 0x followed by exactly 40 hex chars.
const BSC_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

// webhook URL 末段 .../hook/<uuid> 即推送凭据，config 是 cs+ 都能读的。
// 后端未实现 mask（返回明文），前端展示前必须自行打码，仅保留 .../hook/****。
function maskWebhook(url: string | null | undefined): string {
  if (!url) return "—";
  const idx = url.indexOf("/hook/");
  if (idx === -1) return "****";
  return `${url.slice(0, idx)}/hook/****`;
}

// Mask vault address: show first 6 and last 4 chars.
function maskVault(addr: string | null | undefined): string {
  if (!addr) return "—";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConfigPage() {
  const { query, result } = useCustom<PresaleConfig>({
    url: "admin/presale/config",
    method: "get",
  });
  const config = result.data;
  const invalidate = useInvalidate();
  const configMutation = useConfigMutation();
  const { token } = theme.useToken();

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<"editConfig" | null>(null);

  // ── Edit payload controlled state ─────────────────────────────────────────
  const [editPayload, setEditPayload] = useState<ConfigPatchPayload>({});

  // ── Vault address dirty tracking (show alert only when user is changing it) ─
  // onChange below coerces empty string → undefined, so a non-undefined value is always dirty.
  const vaultAddressDirty = editPayload.vaultAddress !== undefined;

  const closeModal = () => {
    setActiveSection(null);
    setEditPayload({});
  };

  const handleInvalidate = () => {
    invalidate({ resource: "config", invalidates: ["detail", "list"] });
  };

  // ── target summary for the modal ─────────────────────────────────────────
  const modalTarget = config
    ? [
        { label: "Lark Webhook", value: maskWebhook(config.larkWebhookUrl) },
        { label: "金库地址", value: maskVault(config.vaultAddress) },
        { label: "最小认购", value: formatAmount(config.minSubscribeUsd, { decimals: 2, suffix: "USDT" }) },
      ]
    : [];

  return (
    <Card title="金库及TGE配置">
      {/* Edit button — super_admin only */}
      <RoleGuard allow={["super_admin"]}>
        <div style={{ marginBottom: token.marginSM }}>
          <Button
            type="primary"
            onClick={() => setActiveSection("editConfig")}
          >
            编辑配置
          </Button>
        </div>
      </RoleGuard>

      <Spin spinning={query.isLoading}>
        {config && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="TGE 时间 (+08)">{formatTs(config.tgeTs)}</Descriptions.Item>
            <Descriptions.Item label="TGE 开盘价">
              {formatAmount(config.tgeOpenPriceUsd, { decimals: 4, suffix: "USD" })}
            </Descriptions.Item>
            <Descriptions.Item label="金库地址" span={2}>
              <TxHashLink value={config.vaultAddress} kind="address" />
            </Descriptions.Item>
            <Descriptions.Item label="最小认购">
              {formatAmount(config.minSubscribeUsd, { decimals: 2, suffix: "USDT" })}
            </Descriptions.Item>
            <Descriptions.Item label="边界容差">{config.boundaryToleranceMin} min</Descriptions.Item>
            <Descriptions.Item label="全局目标">
              {formatAmount(config.totalTargetUsd, { decimals: 2, suffix: "USD" })}
            </Descriptions.Item>
            <Descriptions.Item label="审计机构">{config.auditLabel || "—"}</Descriptions.Item>
            <Descriptions.Item label="Lark Webhook" span={2}>
              <Typography.Text code>{maskWebhook(config.larkWebhookUrl)}</Typography.Text>
              <Typography.Text type="secondary" style={{ marginInlineStart: 8 }}>
                ⓘ 前端打码，无复制按钮（凭据敏感）
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="更新时间 (+08)" span={2}>
              {formatTs(config.updatedAt)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Spin>

      {/* Edit config modal — super_admin only */}
      <RoleGuard allow={["super_admin"]}>
        <ConfirmMutationModal
          open={activeSection === "editConfig"}
          title="编辑预售全局配置"
          target={modalTarget}
          impact="高敏配置项。修改 vault 地址后，所有新入金将打到新地址 —— 请务必在打款前与运营/财务对齐链上 vault 已部署。"
          danger
          onConfirm={async ({ note, idempotencyKey }) => {
            // Field coverage: M3-T19 only exposes 3 of 8 patchable fields (larkWebhookUrl /
            // vaultAddress / minSubscribeUsd) — the operationally hot ones. The other 5
            // (tgeTs / tgeOpenPriceUsd / boundaryToleranceMin / totalTargetUsd / auditLabel)
            // are rarely changed and intentionally left for direct DB ops or a later ENH.
            const payload: ConfigPatchPayload = {};
            if (editPayload.larkWebhookUrl) payload.larkWebhookUrl = editPayload.larkWebhookUrl;
            if (editPayload.vaultAddress) payload.vaultAddress = editPayload.vaultAddress;
            if (editPayload.minSubscribeUsd) payload.minSubscribeUsd = editPayload.minSubscribeUsd;
            if (Object.keys(payload).length === 0) {
              throw new Error("[ConfigPage/editConfig] At least one field must be modified before submitting");
            }
            await configMutation.updateConfig({ note, idempotencyKey, ...payload });
            handleInvalidate();
          }}
          onCancel={closeModal}
          extraFields={
            <Form layout="vertical">
              {/* larkWebhookUrl */}
              <Form.Item label="Lark Webhook URL（留空则不修改）">
                <Input
                  placeholder="https://open.larksuite.com/open-apis/bot/v2/hook/..."
                  value={editPayload.larkWebhookUrl ?? ""}
                  onChange={(e) =>
                    setEditPayload((prev) => ({
                      ...prev,
                      larkWebhookUrl: e.target.value || undefined,
                    }))
                  }
                />
              </Form.Item>

              {/* vaultAddress — strong warning when dirty */}
              <Form.Item
                label="金库地址（留空则不修改）"
                validateStatus={
                  editPayload.vaultAddress && !BSC_ADDRESS_RE.test(editPayload.vaultAddress)
                    ? "error"
                    : ""
                }
                help={
                  editPayload.vaultAddress && !BSC_ADDRESS_RE.test(editPayload.vaultAddress)
                    ? "地址格式无效，须为 0x 开头的 40 位十六进制（BSC EOA / 合约地址）"
                    : undefined
                }
              >
                <Input
                  placeholder="0x..."
                  value={editPayload.vaultAddress ?? ""}
                  onChange={(e) =>
                    setEditPayload((prev) => ({
                      ...prev,
                      vaultAddress: e.target.value || undefined,
                    }))
                  }
                />
              </Form.Item>

              {/* Vault address danger alert — shown only when user has entered a value */}
              {vaultAddressDirty && (
                <Alert
                  type="error"
                  showIcon
                  message="⚠️ 修改 vault 地址将导致所有新入金流向新地址，操作不可逆，请二次确认链上 vault 已部署"
                  style={{ marginBottom: token.marginSM }}
                />
              )}

              {/* minSubscribeUsd */}
              <Form.Item label="最小认购金额 USDT（留空则不修改）">
                <InputNumber
                  stringMode
                  min="0"
                  placeholder="e.g. 1000"
                  style={{ width: "100%" }}
                  value={editPayload.minSubscribeUsd ?? ""}
                  onChange={(val) =>
                    setEditPayload((prev) => ({
                      ...prev,
                      minSubscribeUsd: val ? String(val) : undefined,
                    }))
                  }
                />
              </Form.Item>

              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                <Space>
                  <span>留空的字段不会被修改。</span>
                </Space>
              </Typography.Text>
            </Form>
          }
        />
      </RoleGuard>
    </Card>
  );
}
