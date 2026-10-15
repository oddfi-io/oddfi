// 展开态：每玩法一张方向明细表（DD002 T07）。
// 懒加载：点击展开才挂载本组件 → useCustom 拉 GET /admin/events/:id。
// direction_name 已由后端带胜负态标注（✓ 胜出 / 未中 / 走盘），前端原样渲染零判定。
// 调整历史入口：count>0 渲染「调整 n 次」；onAdjustHistory 未接线（T08 前）则纯文本。
import { useCustom } from "@refinedev/core";
import { Alert, Empty, Skeleton, Space, Table, Tooltip, Typography, Button } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { AmountText } from "@/components/AmountText";
import { SignalTag } from "@/components/SignalTag";
import { formatAmount } from "@/lib/amount";
import { formatOdds, formatSignedOdds, formatRatioPercent } from "@/pages/events/_format";
import type { EventDirection, EventMarket, RiskEventDetail } from "@/types/events";

export interface AdjustHistoryQuery {
  eventId: string;
  market: string;
  direction: string;
}

interface Props {
  eventId: string;
  onAdjustHistory?: (q: AdjustHistoryQuery) => void;
}

function MarketBlock({
  eventId,
  market,
  onAdjustHistory,
}: {
  eventId: string;
  market: EventMarket;
  onAdjustHistory?: (q: AdjustHistoryQuery) => void;
}) {
  return (
    <div>
      <Typography.Text strong>{market.market_name}</Typography.Text>
      {market.settle ? (
        // 结算条：仅已结算非空（§5.3）。platform_pl 正=平台盈利。
        <Alert
          type="info"
          showIcon={false}
          style={{ marginTop: 8, marginBottom: 8 }}
          message={
            <Space size="large" wrap>
              <span>结算：{market.settle.winners.join(" / ") || "—"}</span>
              <span>总赔付 {formatAmount(market.settle.payout)}</span>
              <span>平台盈亏 {formatAmount(market.settle.platform_pl)}</span>
            </Space>
          }
        />
      ) : null}
      <Table<EventDirection>
        size="small"
        rowKey="direction_id"
        dataSource={market.directions}
        pagination={false}
        style={{ marginTop: market.settle ? 0 : 8 }}
      >
        <Table.Column<EventDirection> title="方向" dataIndex="direction_name" />
        <Table.Column<EventDirection>
          title="投注额"
          dataIndex="bet_amount"
          render={(v: string | null) => <AmountText value={v} />}
        />
        <Table.Column<EventDirection>
          // DD003 W3（走查 6/5）：列头消歧——该列是采集阶段基准价快照，非「已开盘」证据
          title={
            <Space size={4}>
              开盘赔率
              <Tooltip title="采集阶段写入的基准价快照，与市场是否已实际开盘无关">
                <InfoCircleOutlined />
              </Tooltip>
            </Space>
          }
          dataIndex="original_odds"
          render={(v: number | null) => <Typography.Text code>{formatOdds(v)}</Typography.Text>}
        />
        <Table.Column<EventDirection>
          title="第三方赔率"
          render={(_, r) =>
            r.third_party_odds == null ? (
              <Typography.Text type="secondary">—</Typography.Text>
            ) : (
              <Space size={4}>
                <Typography.Text code>{formatOdds(r.third_party_odds)}</Typography.Text>
                {r.third_party_source ? (
                  <Typography.Text type="secondary">{r.third_party_source}</Typography.Text>
                ) : null}
              </Space>
            )
          }
        />
        <Table.Column<EventDirection>
          title="差值"
          dataIndex="odds_diff"
          render={(v: number | null) => <Typography.Text code>{formatSignedOdds(v)}</Typography.Text>}
        />
        <Table.Column<EventDirection>
          title="新赔率"
          dataIndex="adjusted_odds"
          render={(v: number | null) => <Typography.Text code>{formatOdds(v)}</Typography.Text>}
        />
        <Table.Column<EventDirection>
          title="原敞口"
          dataIndex="original_exposure"
          render={(v: string | null) => <AmountText value={v} />}
        />
        <Table.Column<EventDirection>
          title="新敞口"
          dataIndex="adjusted_exposure"
          render={(v: string | null) => <AmountText value={v} />}
        />
        <Table.Column<EventDirection>
          title="压缩率"
          dataIndex="adjust_ratio"
          render={(v: number | null) => formatRatioPercent(v)}
        />
        <Table.Column<EventDirection>
          title="信号灯"
          dataIndex="signal"
          render={(_, r: EventDirection) => <SignalTag signal={r.signal} />}
        />
        <Table.Column<EventDirection>
          title="调整记录"
          render={(_, r) => {
            if (r.adjust_history_count <= 0)
              return <Typography.Text type="secondary">—</Typography.Text>;
            if (!onAdjustHistory) return <span>调整 {r.adjust_history_count} 次</span>;
            return (
              <Button
                type="link"
                size="small"
                onClick={() =>
                  onAdjustHistory({
                    eventId,
                    market: market.market_name,
                    direction: r.direction_name,
                  })
                }
              >
                调整 {r.adjust_history_count} 次
              </Button>
            );
          }}
        />
      </Table>
    </div>
  );
}

export function EventExpandedTable({ eventId, onAdjustHistory }: Props) {
  // Refine 5 useCustom 返回 { query, result }：result 即 dataProvider.custom 的 { data }。
  const detailQuery = useCustom<RiskEventDetail>({
    url: `admin/events/${encodeURIComponent(eventId)}`,
    method: "get",
  });

  if (detailQuery.query.isLoading) return <Skeleton active paragraph={{ rows: 3 }} />;
  if (detailQuery.query.isError) {
    return <Alert type="warning" showIcon message="明细加载失败，请收起后重新展开" />;
  }
  const markets: EventMarket[] = detailQuery.result?.data?.markets ?? [];
  if (markets.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无玩法明细" />;
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {markets.map((m) => (
        <MarketBlock
          key={m.market_id}
          eventId={eventId}
          market={m}
          onAdjustHistory={onAdjustHistory}
        />
      ))}
    </Space>
  );
}
