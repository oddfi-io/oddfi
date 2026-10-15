// 轮次状态机可视化 —— AntD Steps（不自研图形）。
// 契约：docs/spa-presale-admin/04-components.md §2，03-pages.md §3。
// 状态映射：upcoming=0 / active=1 / paused=1(error) / ended=2(finish)。
import { Steps, Tag } from "antd";
import type { RoundStatus } from "@/types/presale";

export interface RoundStatusFlowProps {
  status: RoundStatus;
  /** 若 true，追加「手动干预 · cron 已停止」警示 Tag */
  manualOverride?: boolean;
}

// 主线三步，paused 停在 index=1 并标 error（AntD 红）。
const STEP_INDEX: Record<RoundStatus, number> = {
  upcoming: 0,
  active: 1,
  paused: 1,
  ended: 2,
};

// ended 时用 "finish"（AntD 绿勾），paused 时用 "error"（红），其余 "process"（默认蓝）。
type StepsStatus = "process" | "finish" | "error" | "wait";

function stepsStatus(status: RoundStatus): StepsStatus {
  if (status === "ended") return "finish";
  if (status === "paused") return "error";
  return "process";
}

export function RoundStatusFlow({
  status,
  manualOverride = false,
}: RoundStatusFlowProps): React.ReactElement {
  return (
    <div>
      <Steps
        size="small"
        current={STEP_INDEX[status]}
        status={stepsStatus(status)}
        items={[
          { title: "未开始" },
          {
            title: status === "paused" ? "进行中（已暂停）" : "进行中",
          },
          { title: "已结束" },
        ]}
      />
      {manualOverride && (
        <Tag color="warning" style={{ marginTop: 8 }}>
          手动干预中 · cron 已停止自动推进
        </Tag>
      )}
    </div>
  );
}
