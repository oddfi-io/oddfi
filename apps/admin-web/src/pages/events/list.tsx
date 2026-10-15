// /events — 赛事风险列表（DD002 T07）。
// 结构：风险总览 KPI（30s 轮询）→ 筛选 Tab + 排序 → 两级展开 Table（30s 轮询）。
// 交互骨架照原型复刻（§2.2），视觉一律 Vercel 主题 AntD 组件，零原型色值。
import { useState } from "react";
import { List } from "@refinedev/antd";
import { useCustom } from "@refinedev/core";
import { Badge, Button, Checkbox, Segmented, Select, Space, Table, Tag, Typography } from "antd";
import { AmountText } from "@/components/AmountText";
import { SignalTag } from "@/components/SignalTag";
import { useRiskList, type RiskSortField, type RiskTab } from "@/hooks/useRiskList";
import { RiskKpiCards } from "./components/RiskKpiCards";
import { AdjustHistoryModal } from "./components/AdjustHistoryModal";
import {
  EventExpandedTable,
  type AdjustHistoryQuery,
} from "./components/EventExpandedTable";
import { TimeChips } from "./components/TimeChips";
import { yieldTier, settlePlTier, formatScore } from "./_format";
import { formatAmount } from "@/lib/amount";
import type { EventStatus, RiskEvent, RiskSummary } from "@/types/events";

// 红/橙 Tab 用 Badge 色点（AntD preset，与 SignalTag 同色组），不用 emoji（跨 OS 渲染不可控）。
const TAB_OPTIONS: { label: React.ReactNode; value: RiskTab }[] = [
  { label: "全部", value: "all" },
  { label: "进行中", value: "active" },
  { label: "待开始", value: "pending" },
  { label: "已结算", value: "settled" },
  { label: <Badge color="red" text="红灯" />, value: "red" },
  { label: <Badge color="orange" text="橙灯" />, value: "orange" }, // 橙含红（signal=orange,red）
];

const SORT_OPTIONS: { label: string; value: RiskSortField }[] = [
  { label: "默认排序", value: "default" },
  { label: "按投注额", value: "bet" },
  { label: "按最大敞口", value: "exposure" },
  { label: "按时间", value: "time" },
];

const STATUS_PILL: Record<EventStatus, { color: string; text: string }> = {
  active: { color: "processing", text: "进行中" },
  pending: { color: "default", text: "待开始" },
  settled: { color: "default", text: "已结算" },
};

export function EventsList() {
  const {
    tableProps,
    tab,
    selectTab,
    league,
    setLeague,
    sortField,
    sortOrder,
    setSort,
    highlightId,
    jumpToEvent,
    includeTest,
    setIncludeTest,
    includeArchived,
    setIncludeArchived,
  } = useRiskList();

  // 风险总览 summary，与列表同节奏 30s 轮询；失败不挡列表、不弹全局错
  // （KPI 区保持旧值/Skeleton——联调 A 停 mock 实测：不静默会随轮询反复弹 toast）。
  // ENH-008：include_* 与列表同源（useRiskList 单一真值），卡片与列表口径必须一致；
  // 契约约定 false 省略不传（后端默认=过滤后宇宙），true 才传 "true"。
  const summaryQuery = useCustom<RiskSummary>({
    url: "admin/events/risk/summary",
    method: "get",
    config: {
      query: {
        ...(includeTest ? { include_test: "true" } : {}),
        ...(includeArchived ? { include_archived: "true" } : {}),
      },
    },
    errorNotification: false,
    queryOptions: { refetchInterval: 30000 },
  });

  // 调整历史弹窗（T08）：展开态方向行「调整 n 次」触发。
  const [adjustQuery, setAdjustQuery] = useState<AdjustHistoryQuery | null>(null);

  return (
    <List title="赛事风险">
      <RiskKpiCards
        summary={summaryQuery.result?.data}
        loading={summaryQuery.query.isLoading}
        onSelectTab={selectTab}
        onJumpMax={jumpToEvent}
      />

      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Segmented<RiskTab>
          options={TAB_OPTIONS}
          value={tab}
          onChange={(v) => selectTab(v)}
        />
        <Space>
          {/* DD004 #2：按赛事类型（league）筛选，选项来自 summary.leagues */}
          <Select<string>
            value={league}
            placeholder="全部类型"
            allowClear
            style={{ width: 160 }}
            // 后端按 UTF-8 码点排序，前端再按中文 locale 重排，下拉顺序对运营更直观（review A-Minor-1）
            options={[...(summaryQuery.result?.data?.leagues ?? [])]
              .sort((a, b) => a.localeCompare(b, "zh"))
              .map((lg) => ({ label: lg, value: lg }))}
            onChange={(v) => setLeague(v)}
          />
          <Select<RiskSortField>
            value={sortField}
            options={SORT_OPTIONS}
            style={{ width: 140 }}
            // 省略 order：切到「按时间」用 Tab 语境默认方向（DD003 W1b）
            onChange={(field) => setSort(field)}
          />
          <Button
            disabled={sortField === "default"}
            onClick={() => setSort(sortField, sortOrder === "desc" ? "asc" : "desc")}
          >
            {sortOrder === "desc" ? "↓ 降序" : "↑ 升序"}
          </Button>
          {/* ENH-008：默认隐藏测试体验盘与 7 天前已结算（后端过滤）；开关同时作用于卡片与列表 */}
          <Checkbox checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)}>
            显示测试盘
          </Checkbox>
          <Checkbox
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          >
            显示已归档
          </Checkbox>
        </Space>
      </Space>

      <Table<RiskEvent>
        {...tableProps}
        rowKey="event_id"
        rowClassName={(record) => {
          const cls: string[] = [];
          if (record.event_id === highlightId) cls.push("of-row-highlight");
          if (!record.opened) cls.push("of-row-muted"); // 未开盘整行置灰（预期态非 bug）
          return cls.join(" ");
        }}
        expandable={{
          // 懒加载：展开才挂载 → 组件内 useCustom 拉明细
          expandedRowRender: (record) => (
            <EventExpandedTable eventId={record.event_id} onAdjustHistory={setAdjustQuery} />
          ),
        }}
      >
        <Table.Column<RiskEvent>
          title="赛事"
          render={(_, r) => (
            <Space direction="vertical" size={0}>
              <Space size={4}>
                <Typography.Text strong>{r.event_name}</Typography.Text>
                {/* ENH-008：测试盘行打标（仅 include_test=true 时后端才返回 true 行） */}
                {r.is_test ? <Tag color="warning">测试</Tag> : null}
              </Space>
              <Typography.Text type="secondary">
                {r.sport} · {r.league}
              </Typography.Text>
            </Space>
          )}
        />
        <Table.Column<RiskEvent>
          title="状态"
          render={(_, r) => {
            const pill = STATUS_PILL[r.status] ?? { color: "default", text: r.status };
            // 终场比分 pill：仅已结算且有比分（score={home,away} 对象；未落库 null = D6 预期）
            const scoreText = r.status === "settled" ? formatScore(r.score) : null;
            return (
              <Space size={4}>
                <Tag color={pill.color}>{pill.text}</Tag>
                {scoreText ? <Typography.Text code>{scoreText}</Typography.Text> : null}
              </Space>
            );
          }}
        />
        <Table.Column<RiskEvent>
          title="信号灯"
          render={(_, r) => (
            <Space size={4}>
              <SignalTag signal={r.signal} opened={r.opened} />
              {r.pending_decision ? <Tag color="red">待决策</Tag> : null}
              {r.decision ? <Tag>已人工处理</Tag> : null}
            </Space>
          )}
        />
        <Table.Column<RiskEvent>
          title="时间"
          render={(_, r) => <TimeChips times={r.times} status={r.status} />}
        />
        <Table.Column<RiskEvent>
          title="投注总额"
          dataIndex="bet_amount_total"
          render={(v: string | null) => <AmountText value={v} />}
        />
        <Table.Column<RiskEvent>
          // settled 态：盈亏替换敞口（原型 :4622）；其余态显示 adjMaxL 展示量
          title="最大敞口 / 盈亏"
          render={(_, r) => {
            if (r.status === "settled") {
              const tier = settlePlTier(r.settle_pl);
              if (!tier) return <Typography.Text type="secondary">—</Typography.Text>;
              return <Tag color={tier.color}>{formatAmount(r.settle_pl)}</Tag>;
            }
            return <AmountText value={r.max_exposure} />;
          }}
        />
        <Table.Column<RiskEvent>
          title="收益率"
          dataIndex="yield_ratio"
          render={(v: number | null) => {
            const tier = yieldTier(v);
            if (!tier) return <Typography.Text type="secondary">—</Typography.Text>;
            return <Tag color={tier.color}>{tier.text}</Tag>;
          }}
        />
        <Table.Column<RiskEvent>
          title="规模"
          render={(_, r) => (
            <Typography.Text type="secondary">
              {r.market_count} 玩法 · {r.direction_count} 方向
            </Typography.Text>
          )}
        />
      </Table>

      <AdjustHistoryModal query={adjustQuery} onClose={() => setAdjustQuery(null)} />
    </List>
  );
}
