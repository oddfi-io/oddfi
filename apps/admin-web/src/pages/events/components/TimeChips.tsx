// 时间 chip + hover 竖向时间线（DD002 T07，原型 :4600-4609）。
// 当前阶段高亮映射（DD003 W2 修订）：pending=kickoff / active=lock / settled=settle，
// 纯 status 驱动；开盘时间仍在 Popover 时间线中展示。
// times.settle 数据源未落库（D6）→「—」，预期行为。
import { Popover, Tag, Timeline, Typography } from "antd";
import { formatTs } from "@/lib/time";
import { currentStage, type Stage } from "@/pages/events/_format";
import type { EventStatus, EventTimes } from "@/types/events";

const STAGES: { key: Stage; label: string }[] = [
  { key: "open", label: "开盘" },
  { key: "lock", label: "锁盘" },
  { key: "kickoff", label: "开赛" },
  { key: "settle", label: "结算" },
];

interface Props {
  times: EventTimes;
  status: EventStatus;
}

export function TimeChips({ times, status }: Props) {
  const cur = currentStage(status);
  const curMeta = STAGES.find((s) => s.key === cur) ?? STAGES[0];

  const timeline = (
    <Timeline
      items={STAGES.map((s) => ({
        color: s.key === cur ? "blue" : "gray",
        children: (
          <span>
            {s.key === cur ? (
              <Typography.Text strong>{s.label}</Typography.Text>
            ) : (
              <Typography.Text type="secondary">{s.label}</Typography.Text>
            )}{" "}
            <Typography.Text type={s.key === cur ? undefined : "secondary"}>
              {formatTs(times[s.key])}
            </Typography.Text>
          </span>
        ),
      }))}
    />
  );

  return (
    <Popover content={timeline} title="赛事时间线" placement="right">
      <Tag style={{ cursor: "default" }}>
        {curMeta.label} {formatTs(times[cur])}
      </Tag>
    </Popover>
  );
}
