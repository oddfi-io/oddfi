// /dashboard — 认购模块总览（M1 只读）。
// ① 6 轮卡（useList rounds 不分页）② config 摘要（useCustom）③ 最近 5 audit（useList size=5）
// ④ 无 active 轮提示。本期不做 cutover 横幅（M5）。
// 契约：03-pages.md §2，07-ui-wireframes.md §3。
import { useCustom, useList } from "@refinedev/core";
import { Alert, Card, Col, Descriptions, Progress, Row, Space, Statistic, Tag, Typography } from "antd";
import type { AuditLog, PresaleConfig, Round } from "@/types/presale";
import { ROUND_NAMES } from "@/types/presale";
import { formatTs } from "@/lib/time";
import { formatAmount, progressPct } from "@/lib/amount";
import { RoundStatusTag } from "@/components/RoundStatusTag";
import { AmountText } from "@/components/AmountText";
import { TxHashLink } from "@/components/TxHashLink";

function maskWebhook(url: string | null | undefined): string {
  if (!url) return "—";
  const idx = url.indexOf("/hook/");
  return idx === -1 ? "****" : `${url.slice(0, idx)}/hook/****`;
}

export function DashboardPage() {
  // rounds 不分页（返回全部 6 轮）。
  const roundsQuery = useList<Round>({ resource: "rounds", pagination: { mode: "off" } });
  const configQuery = useCustom<PresaleConfig>({ url: "admin/presale/config", method: "get" });
  const auditQuery = useList<AuditLog>({
    resource: "audit",
    pagination: { currentPage: 1, pageSize: 5 },
  });

  const rounds = roundsQuery.result?.data ?? [];
  const config = configQuery.result?.data;
  const recentAudit = auditQuery.result?.data ?? [];
  const hasActive = rounds.some((r) => r.status === "active");

  return (
    <Space direction="vertical" size="large" style={{ display: "flex" }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        总览
      </Typography.Title>

      {!roundsQuery.query.isLoading && !hasActive && (
        <Alert type="info" showIcon message="当前无进行中的轮次" />
      )}

      <Card title="轮次状态" loading={roundsQuery.query.isLoading}>
        <Row gutter={[16, 16]}>
          {rounds.map((round) => (
            <Col key={round.id} span={8}>
              <Card size="small">
                <Space direction="vertical" size={8} style={{ display: "flex" }}>
                  <Space align="center" style={{ justifyContent: "space-between", width: "100%" }}>
                    <Typography.Text strong>{ROUND_NAMES[round.id] ?? round.id}</Typography.Text>
                    <RoundStatusTag status={round.status} />
                  </Space>
                  <Progress percent={Math.round(progressPct(round.soldOdd, round.supplyOdd))} size="small" />
                  <Typography.Text type="secondary">
                    已售 {formatAmount(round.soldOdd, { decimals: 0 })} /{" "}
                    {formatAmount(round.supplyOdd, { decimals: 0 })} ODD
                  </Typography.Text>
                  <Statistic
                    title="募集"
                    value={formatAmount(round.raisedUsd, { decimals: 2 })}
                    prefix="$"
                  />
                  <Typography.Text type="secondary">
                    {formatTs(round.startTs)} → {formatTs(round.endTs)}
                  </Typography.Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="全局配置摘要" loading={configQuery.query.isLoading}>
            {!configQuery.query.isLoading && !config && (
              <Typography.Text type="secondary">暂无配置</Typography.Text>
            )}
            {config && (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="TGE 时间">{formatTs(config.tgeTs)}</Descriptions.Item>
                <Descriptions.Item label="金库地址">
                  <TxHashLink value={config.vaultAddress} kind="address" />
                </Descriptions.Item>
                <Descriptions.Item label="最小认购">
                  <AmountText value={config.minSubscribeUsd} decimals={2} suffix="USDT" />
                </Descriptions.Item>
                <Descriptions.Item label="边界容差">{config.boundaryToleranceMin} min</Descriptions.Item>
                <Descriptions.Item label="Lark Webhook">
                  <Typography.Text code>{maskWebhook(config.larkWebhookUrl)}</Typography.Text>
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="最近操作" loading={auditQuery.query.isLoading}>
            <Space direction="vertical" size={8} style={{ display: "flex" }}>
              {recentAudit.length === 0 && <Typography.Text type="secondary">暂无记录</Typography.Text>}
              {recentAudit.map((log) => (
                <Space key={log.id} size={8} wrap>
                  <Typography.Text type="secondary">{formatTs(log.createdAt, "MM-DD HH:mm")}</Typography.Text>
                  <Typography.Text>{log.operator}</Typography.Text>
                  <Tag>{log.action}</Tag>
                  <Typography.Text code>
                    {log.targetType}:{log.targetId}
                  </Typography.Text>
                </Space>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
