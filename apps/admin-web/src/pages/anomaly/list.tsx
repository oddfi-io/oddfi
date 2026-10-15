// /anomaly — 异常事件列表（M1 只读）。默认筛选 status=pending。
// 契约：03-pages.md §5，07-ui-wireframes.md §9。
import { List, useTable } from "@refinedev/antd";
import { useNavigate } from "react-router";
import type { CrudFilter } from "@refinedev/core";
import { Button, Form, Input, Select, Space, Table, Tag, Typography } from "antd";
import type { AnomalyEvent, AnomalyStatus } from "@/types/presale";
import { formatTs } from "@/lib/time";
import { AmountText } from "@/components/AmountText";
import { TxHashLink } from "@/components/TxHashLink";

// 异常状态语义色（只用既有强调色）。
const STATUS_TAG: Record<AnomalyStatus, { color: string; text: string }> = {
  pending: { color: "warning", text: "待处理" },
  notified: { color: "processing", text: "已通知" },
  resolved: { color: "success", text: "已处理" },
  rejected: { color: "default", text: "已拒绝" },
};

interface FilterForm {
  status?: AnomalyStatus;
  event_type?: string;
}

export function AnomalyList() {
  const navigate = useNavigate();
  const [form] = Form.useForm<FilterForm>();
  // 默认筛选 status=pending（待处理优先）。
  const { tableProps, setFilters } = useTable<AnomalyEvent>({
    resource: "anomaly",
    syncWithLocation: true,
    filters: { initial: [{ field: "status", operator: "eq", value: "pending" }] },
  });

  const onSearch = (values: FilterForm) => {
    const filters: CrudFilter[] = [];
    if (values.status) filters.push({ field: "status", operator: "eq", value: values.status });
    if (values.event_type?.trim())
      filters.push({ field: "event_type", operator: "eq", value: values.event_type.trim() });
    setFilters(filters);
  };

  const onReset = () => {
    form.resetFields();
    setFilters([{ field: "status", operator: "eq", value: "pending" }]);
  };

  return (
    <List title="异常事件">
      <Form<FilterForm>
        form={form}
        layout="inline"
        initialValues={{ status: "pending" }}
        onFinish={onSearch}
        style={{ marginBottom: 16, rowGap: 8 }}
      >
        <Form.Item name="status" label="状态">
          <Select
            allowClear
            placeholder="全部"
            style={{ width: 120 }}
            options={[
              { value: "pending", label: "待处理" },
              { value: "notified", label: "已通知" },
              { value: "resolved", label: "已处理" },
              { value: "rejected", label: "已拒绝" },
            ]}
          />
        </Form.Item>
        <Form.Item name="event_type" label="类型">
          <Input allowClear placeholder="如 overflow" style={{ width: 180 }} />
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

      <Table<AnomalyEvent>
        {...tableProps}
        rowKey="id"
        onRow={(record) => ({
          onClick: () => navigate(`/anomaly/${record.id}`),
          style: { cursor: "pointer" },
        })}
      >
        <Table.Column<AnomalyEvent> title="ID" dataIndex="id" />
        <Table.Column<AnomalyEvent>
          title="类型"
          dataIndex="eventType"
          render={(v: string) => <Tag>{v}</Tag>}
        />
        <Table.Column<AnomalyEvent>
          title="TxHash"
          dataIndex="txHash"
          render={(v: string) => (
            <span onClick={(e) => e.stopPropagation()}>
              <TxHashLink value={v} kind="tx" />
            </span>
          )}
        />
        <Table.Column<AnomalyEvent>
          title="EOA"
          dataIndex="eoaAddress"
          render={(v: string) => (
            <span onClick={(e) => e.stopPropagation()}>
              <TxHashLink value={v} kind="address" />
            </span>
          )}
        />
        <Table.Column<AnomalyEvent>
          title="金额 USDT"
          dataIndex="amountUsdt"
          render={(v: string) => <AmountText value={v} decimals={2} />}
        />
        <Table.Column<AnomalyEvent>
          title="状态"
          dataIndex="status"
          render={(v: AnomalyStatus) => {
            const s = STATUS_TAG[v] ?? { color: "default", text: v };
            return <Tag color={s.color}>{s.text}</Tag>;
          }}
        />
        <Table.Column<AnomalyEvent>
          title="创建时间 (+08)"
          dataIndex="createdAt"
          render={(v: number) => <Typography.Text>{formatTs(v)}</Typography.Text>}
        />
      </Table>
    </List>
  );
}
