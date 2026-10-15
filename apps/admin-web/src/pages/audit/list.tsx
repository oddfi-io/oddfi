// /audit — 操作审计列表。M5：新增 AuditDiff 行展开 + 5s 实时刷新。
// 契约：03-pages.md §7，04-components.md §4，07-ui-wireframes.md §11。
import { List, useTable } from "@refinedev/antd";
import type { CrudFilter } from "@refinedev/core";
import { Button, DatePicker, Form, Input, Select, Space, Table, Tag, Typography } from "antd";
import type { Dayjs } from "dayjs";
import type { AuditLog, AuditSource, AuditTargetType } from "@/types/presale";
import { formatTs } from "@/lib/time";
import { AuditDiff } from "@/components/AuditDiff";

interface FilterForm {
  operator?: string;
  action?: string;
  target_type?: AuditTargetType;
  range?: [Dayjs, Dayjs];
}

const TARGET_OPTIONS: { value: AuditTargetType; label: string }[] = [
  { value: "round", label: "轮次" },
  { value: "deposit", label: "入账" },
  { value: "config", label: "配置" },
  { value: "anomaly", label: "异常" },
];

export function AuditList() {
  const [form] = Form.useForm<FilterForm>();
  const { tableProps, setFilters } = useTable<AuditLog>({
    resource: "audit",
    syncWithLocation: true,
    // 5s 实时轮询（03-pages.md §7 / brief §七）。页面卸载时 TanStack Query 自动停止。
    queryOptions: { refetchInterval: 5000 },
  });

  const onSearch = (values: FilterForm) => {
    const filters: CrudFilter[] = [];
    if (values.operator?.trim())
      filters.push({ field: "operator", operator: "eq", value: values.operator.trim() });
    if (values.action?.trim())
      filters.push({ field: "action", operator: "eq", value: values.action.trim() });
    if (values.target_type)
      filters.push({ field: "target_type", operator: "eq", value: values.target_type });
    if (values.range?.[0]) filters.push({ field: "from_ts", operator: "gte", value: values.range[0].valueOf() });
    if (values.range?.[1]) filters.push({ field: "to_ts", operator: "lte", value: values.range[1].valueOf() });
    setFilters(filters);
  };

  const onReset = () => {
    form.resetFields();
    setFilters([]);
  };

  return (
    <List title="操作审计">
      <Form<FilterForm> form={form} layout="inline" onFinish={onSearch} style={{ marginBottom: 16, rowGap: 8 }}>
        <Form.Item name="operator" label="操作人">
          <Input allowClear placeholder="姓名/ID" style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="action" label="动作">
          <Input allowClear placeholder="如 pause" style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="target_type" label="目标类型">
          <Select allowClear placeholder="全部" options={TARGET_OPTIONS} style={{ width: 120 }} />
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

      <Table<AuditLog>
        {...tableProps}
        rowKey="id"
        expandable={{
          expandedRowRender: (record) => (
            <AuditDiff before={record.beforeJson} after={record.afterJson} />
          ),
        }}
      >
        <Table.Column<AuditLog>
          title="时间 (+08)"
          dataIndex="createdAt"
          render={(v: number) => formatTs(v, "YYYY-MM-DD HH:mm:ss")}
        />
        <Table.Column<AuditLog> title="操作人" dataIndex="operator" />
        <Table.Column<AuditLog> title="角色" dataIndex="operatorRole" />
        <Table.Column<AuditLog>
          title="动作"
          dataIndex="action"
          render={(v: string) => <Tag>{v}</Tag>}
        />
        <Table.Column<AuditLog>
          title="目标"
          render={(_, record) => (
            <Typography.Text code>
              {record.targetType}:{record.targetId}
            </Typography.Text>
          )}
        />
        <Table.Column<AuditLog>
          title="备注"
          dataIndex="note"
          render={(v: string) => v || <Typography.Text type="secondary">—</Typography.Text>}
        />
        <Table.Column<AuditLog>
          title="源"
          dataIndex="source"
          render={(v: AuditSource) => (
            <Tag color={v === "script" ? "processing" : "default"}>{v}</Tag>
          )}
        />
      </Table>
    </List>
  );
}
