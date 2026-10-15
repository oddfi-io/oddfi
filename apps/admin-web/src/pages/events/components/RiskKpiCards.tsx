// 风险总览 KPI 区（DD002 T07）。summary 口径：四色计数不含未开盘（后端已聚合，前端零判级）。
// 点击联动（原型 :4649）：red→筛 red、orange→筛 orange、green/yellow→落 all（列表无独立绿黄 Tab）。
// 红灯卡 CSS 脉冲（.of-signal-pulse，定义在 theme/vercel.css）；最大敞口卡可点击定位事件行。
import { Card, Col, Row, Skeleton, Statistic, Typography } from "antd";
import { AmountText } from "@/components/AmountText";
import { SignalTag } from "@/components/SignalTag";
import type { RiskSummary, Signal } from "@/types/events";
import type { RiskTab } from "@/hooks/useRiskList";

interface Props {
  summary: RiskSummary | undefined;
  loading: boolean;
  onSelectTab: (tab: RiskTab) => void;
  onJumpMax: (eventId: string) => void;
}

// 四色卡点击落点：绿/黄无独立 Tab → all。
const SIGNAL_TARGET: Record<Signal, RiskTab> = {
  green: "all",
  yellow: "all",
  orange: "orange",
  red: "red",
};

const SIGNAL_COUNT_KEY: Record<Signal, keyof RiskSummary> = {
  green: "green_count",
  yellow: "yellow_count",
  orange: "orange_count",
  red: "red_count",
};

const SIGNALS: Signal[] = ["green", "yellow", "orange", "red"];

export function RiskKpiCards({ summary, loading, onSelectTab, onJumpMax }: Props) {
  if (loading && !summary) {
    return (
      <Card style={{ marginBottom: 16 }}>
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    );
  }
  if (!summary) return null;

  const maxId = summary.max_exposure_event_id;

  return (
    // DD004 #3：align="stretch" + Card height:100% → 含副文案卡与信号卡等高
    <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 16 }}>
      <Col span={4}>
        <Card size="small" style={{ height: "100%" }}>
          <Statistic title="赛事总数" value={summary.total_events} />
          <Typography.Text type="secondary">
            {/* ENH-008：文案钉死 live 口径，杜绝把"比赛进行中=0"误读成"没开盘" */}
            比赛进行中 {summary.active_count} · 待开始 {summary.pending_count} · 已结算{" "}
            {summary.settled_count}
          </Typography.Text>
        </Card>
      </Col>
      <Col span={4}>
        {/* ENH-008 在售可下注（取 on_sale_event_count，与上卡 live 口径不同维度）。
            web-api ENH-008 部署前字段缺失 → 显示「—」，不冒充 0。 */}
        <Card size="small" style={{ height: "100%" }}>
          <Statistic title="在售可下注" value={summary.on_sale_event_count ?? "—"} />
          <Typography.Text type="secondary">
            {summary.on_sale_market_count != null
              ? `${summary.on_sale_market_count} 个盘在售`
              : "—"}
          </Typography.Text>
        </Card>
      </Col>
      <Col span={4}>
        <Card size="small" style={{ height: "100%" }}>
          <Statistic
            title="总投注额"
            value={summary.total_bet_amount ?? "—"}
            formatter={() => <AmountText value={summary.total_bet_amount} />}
          />
        </Card>
      </Col>
      <Col span={4}>
        {/* 全局最大单场敞口（max_event_exposure，命名与行内 max_exposure 双义注意）。可点击定位。 */}
        <Card
          size="small"
          style={{ height: "100%" }}
          hoverable={Boolean(maxId)}
          onClick={maxId ? () => onJumpMax(maxId) : undefined}
        >
          <Statistic
            title="全局最大风险敞口"
            value={summary.max_event_exposure ?? "—"}
            formatter={() => <AmountText value={summary.max_event_exposure} />}
          />
          <Typography.Text type="secondary" ellipsis>
            {summary.max_exposure_event_name
              ? `${summary.max_exposure_event_name} · 点击定位`
              : "—"}
          </Typography.Text>
        </Card>
      </Col>
      {SIGNALS.map((signal) => {
        const count = summary[SIGNAL_COUNT_KEY[signal]] as number;
        const pulse = signal === "red" && summary.red_count > 0;
        return (
          <Col span={2} key={signal}>
            <Card
              size="small"
              style={{ height: "100%" }}
              hoverable
              className={pulse ? "of-signal-pulse" : undefined}
              onClick={() => onSelectTab(SIGNAL_TARGET[signal])}
            >
              <SignalTag signal={signal} />
              <Statistic value={count} />
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}
