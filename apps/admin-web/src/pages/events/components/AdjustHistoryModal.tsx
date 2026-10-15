// 调整历史弹窗（DD002 T08）：方向行「调整 n 次」触发，时间线 Table。
// exposure/lp_ratio 依赖 C 端 OPS-01a 落库，落库前 null →「—」（预期态非 bug）；
// source 本期恒 "Auto"（人工调赔率通道落地后才有 Manual）。
import { useCustom } from "@refinedev/core";
import { Modal, Table, Tag, Typography } from "antd";
import { AmountText } from "@/components/AmountText";
import { formatTs } from "@/lib/time";
import type { AdjustHistoryItem } from "@/types/events";
import type { AdjustHistoryQuery } from "./EventExpandedTable";

interface Props {
  query: AdjustHistoryQuery | null;
  onClose: () => void;
}

export function AdjustHistoryModal({ query, onClose }: Props) {
  const historyQuery = useCustom<{ list: AdjustHistoryItem[] }>({
    url: `admin/events/${encodeURIComponent(query?.eventId ?? "")}/adjust-history`,
    method: "get",
    config: {
      query: { market: query?.market ?? "", direction: query?.direction ?? "" },
    },
    errorNotification: false,
    queryOptions: { enabled: query != null },
  });

  return (
    <Modal
      open={query != null}
      onCancel={onClose}
      footer={null}
      width={720}
      title={query ? `调整历史 — ${query.market} / ${query.direction}` : "调整历史"}
    >
      <Table<AdjustHistoryItem>
        size="small"
        rowKey="seq"
        loading={historyQuery.query.isLoading}
        dataSource={historyQuery.result?.data?.list ?? []}
        pagination={false}
      >
        <Table.Column<AdjustHistoryItem> title="#" dataIndex="seq" width={48} />
        <Table.Column<AdjustHistoryItem>
          title="时间 (+08)"
          dataIndex="time"
          render={(v: string) => formatTs(v, "YYYY-MM-DD HH:mm:ss")}
        />
        <Table.Column<AdjustHistoryItem>
          title="赔率"
          dataIndex="odds"
          render={(v: number) => <Typography.Text code>{v}</Typography.Text>}
        />
        <Table.Column<AdjustHistoryItem>
          title="敞口"
          dataIndex="exposure"
          render={(v: string | null) => <AmountText value={v} />}
        />
        <Table.Column<AdjustHistoryItem>
          title="LP 占比"
          dataIndex="lp_ratio"
          render={(v: number | null) =>
            v == null ? <Typography.Text type="secondary">—</Typography.Text> : `${v}%`
          }
        />
        <Table.Column<AdjustHistoryItem>
          title="来源"
          dataIndex="source"
          render={(v: string) => <Tag>{v}</Tag>}
        />
      </Table>
    </Modal>
  );
}
