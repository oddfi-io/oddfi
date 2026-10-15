// 轮次状态语义 Tag。只用既有强调色（default/success/warning），不引第六种强调色。
// 契约：04-components.md §2，design-tokens.md §5。
import { Tag } from "antd";
import type { RoundStatus } from "@/types/presale";

// success 在 vercelTheme 里是蓝（#0070f3）；warning 橙；default 灰。
const STATUS: Record<RoundStatus, { color: string; text: string }> = {
  upcoming: { color: "default", text: "未开始" },
  active: { color: "success", text: "进行中" },
  paused: { color: "warning", text: "已暂停" },
  ended: { color: "default", text: "已结束" },
};

export function RoundStatusTag({ status }: { status: RoundStatus }) {
  const s = STATUS[status] ?? { color: "default", text: status };
  return <Tag color={s.color}>{s.text}</Tag>;
}
