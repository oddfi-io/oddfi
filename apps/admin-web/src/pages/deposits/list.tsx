// /deposits — 入账记录列表（M1 只读）。服务端分页 + 顶部筛选 Form → setFilters。
// 契约：03-pages.md §4，07-ui-wireframes.md §7，refine-conventions.md。
import { List, useTable } from "@refinedev/antd";
import { useNavigate } from "react-router";
import type { CrudFilter } from "@refinedev/core";
import { Button, DatePicker, Form, Input, Select, Space, Table, Tag, Typography } from "antd";
import type { Dayjs } from "dayjs";
import type { Deposit, DepositStatus } from "@/types/presale";
import { ROUND_NAMES } from "@/types/presale";
import { formatTs } from "@/lib/time";
import { AmountText } from "@/components/AmountText";
import { TxHashLink } from "@/components/TxHashLink";

// 入账状态语义色（确认=success / 待确认=processing / 异常=error），只用既有强调色。
const STATUS_TAG: Record<DepositStatus, { color: string; text: string }> = {
  confirmed: { color: "success", text: "确认" },
  pending: { color: "processing", text: "待确认" },
  anomaly: { color: "error", text: "异常" },
};

interface FilterForm {
  round_id?: string;
  status?: DepositStatus;
  eoa_address?: string;
  range?: [Dayjs, Dayjs];
}

const ROUND_OPTIONS = Object.entries(ROUND_NAMES).map(([value, label]) => ({ value, label }));

export function DepositsList() {
  const navigate = useNavigate();
  const [form] = Form.useForm<FilterForm>();
  const { tableProps, setFilters } = useTable<Deposit>({
    resource: "deposits",
    syncWithLocation: true,
  });

  const onSearch = (values: FilterForm) => {
    const filters: CrudFilter[] = [];
    if (values.round_id) filters.push({ field: "round_id", operator: "eq", value: values.round_id });
    if (values.status) filters.push({ field: "status", operator: "eq", value: values.status });
    if (values.eoa_address?.trim())
      filters.push({ field: "eoa_address", operator: "eq", value: values.eoa_address.trim() });
    if (values.range?.[0]) filters.push({ field: "from_ts", operator: "gte", value: values.range[0].valueOf() });
    if (values.range?.[1]) filters.push({ field: "to_ts", operator: "lte", value: values.range[1].valueOf() });
    setFilters(filters);
  };

  const onReset = () => {
    form.resetFields();
    setFilters([]);
  };

  return (
    <List title="入账记录">
      <Form<FilterForm> form={form} layout="inline" onFinish={onSearch} style={{ marginBottom: 16, rowGap: 8 }}>
        <Form.Item name="round_id" label="轮次">
          <Select allowClear placeholder="全部" options={ROUND_OPTIONS} style={{ width: 140 }} />
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select
            allowClear
            placeholder="全部"
            style={{ width: 120 }}
            options={[
              { value: "pending", label: "待确认" },
              { value: "confirmed", label: "确认" },
              { value: "anomaly", label: "异常" },
            ]}
          />
        </Form.Item>
        <Form.Item name="eoa_address" label="EOA">
          <Input allowClear placeholder="0x…" style={{ width: 220 }} />
        </Form.Item>
        <Form.Item name="range" label="时间">
          <DatePicker.RangePicker showTime />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              查询
            </Button>
            <Button onClick={onReset}>重置</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table<Deposit>
        {...tableProps}
        rowKey="txHash"
        onRow={(record) => ({
          onClick: () => navigate(`/deposits/${encodeURIComponent(record.txHash)}`),
          style: { cursor: "pointer" },
        })}
      >
        <Table.Column<Deposit>
          title="TxHash"
          dataIndex="txHash"
          render={(v: string) => (
            <span onClick={(e) => e.stopPropagation()}>
              <TxHashLink value={v} kind="tx" />
            </span>
          )}
        />
        <Table.Column<Deposit>
          title="EOA"
          dataIndex="eoaAddress"
          render={(v: string) => (
            <span onClick={(e) => e.stopPropagation()}>
              {/* EOA 全量展示（42 位）；TxHash 列保持截断以省列宽 */}
              <TxHashLink value={v} kind="address" truncate={false} />
            </span>
          )}
        />
        <Table.Column<Deposit>
          title="轮次"
          dataIndex="roundId"
          render={(v: string) => <Typography.Text>{ROUND_NAMES[v] ?? v}</Typography.Text>}
        />
        <Table.Column<Deposit>
          title="金额 USDT"
          dataIndex="amountUsdt"
          render={(v: string) => <AmountText value={v} decimals={2} />}
        />
        <Table.Column<Deposit>
          title="份额 ODD"
          dataIndex="sharesOdd"
          render={(v: string) => <AmountText value={v} decimals={2} />}
        />
        <Table.Column<Deposit>
          title="状态"
          dataIndex="status"
          render={(v: DepositStatus) => {
            const s = STATUS_TAG[v] ?? { color: "default", text: v };
            return <Tag color={s.color}>{s.text}</Tag>;
          }}
        />
        <Table.Column<Deposit>
          title="区块时间 (+08)"
          dataIndex="blockTs"
          render={(v: number) => formatTs(v)}
        />
      </Table>
      <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
        ⓘ 异常原因（anomalyReason）后端未透出，请到「异常事件」查看
      </Typography.Text>
    </List>
  );
}
