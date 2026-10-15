// /rounds — 轮次管理列表（M1 只读）。rounds 不分页（后端返回全部 6 轮）。
// 契约：03-pages.md §3，07-ui-wireframes.md §4，refine-conventions.md。
import { List, useTable } from "@refinedev/antd";
import { useNavigate } from "react-router";
import { Space, Table, Typography } from "antd";
import type { Round } from "@/types/presale";
import { ROUND_NAMES } from "@/types/presale";
import { formatTs } from "@/lib/time";
import { formatAmount } from "@/lib/amount";
import { RoundStatusTag } from "@/components/RoundStatusTag";
import { AmountText } from "@/components/AmountText";

export function RoundsList() {
  const navigate = useNavigate();
  // rounds 不分页：pagination mode off → dataProvider 不传 page/size。
  const { tableProps } = useTable<Round>({
    resource: "rounds",
    pagination: { mode: "off" },
    syncWithLocation: false,
  });

  return (
    <List title="轮次管理">
      <Table<Round>
        {...tableProps}
        rowKey="id"
        pagination={false}
        onRow={(record) => ({
          onClick: () => navigate(`/rounds/${encodeURIComponent(record.id)}`),
          style: { cursor: "pointer" },
        })}
      >
        <Table.Column<Round>
          title="轮次"
          dataIndex="id"
          render={(id: string) => (
            <Typography.Text strong>{ROUND_NAMES[id] ?? id}</Typography.Text>
          )}
        />
        <Table.Column<Round>
          title="状态"
          dataIndex="status"
          render={(_, record) => <RoundStatusTag status={record.status} />}
        />
        <Table.Column<Round>
          title="单价"
          dataIndex="priceUsd"
          render={(v: string) => <AmountText value={v} decimals={4} suffix="USD" />}
        />
        <Table.Column<Round>
          title="已售 / 供给"
          render={(_, record) => (
            <Typography.Text code>
              {formatAmount(record.soldOdd, { decimals: 0 })} /{" "}
              {formatAmount(record.supplyOdd, { decimals: 0 })}
            </Typography.Text>
          )}
        />
        <Table.Column<Round>
          title="返佣 %"
          dataIndex="referralRewardPct"
          render={(v: string) => <AmountText value={v} decimals={2} />}
        />
        <Table.Column<Round>
          title="时间窗 (+08)"
          render={(_, record) => (
            <Space size={4}>
              <Typography.Text>{formatTs(record.startTs)}</Typography.Text>
              <Typography.Text type="secondary">→</Typography.Text>
              <Typography.Text>{formatTs(record.endTs)}</Typography.Text>
            </Space>
          )}
        />
        <Table.Column<Round>
          title="手动干预"
          dataIndex="manualOverride"
          render={(v: boolean) =>
            v ? (
              <Typography.Text type="warning">⚑ 已干预</Typography.Text>
            ) : (
              <Typography.Text type="secondary">—</Typography.Text>
            )
          }
        />
      </Table>
    </List>
  );
}
