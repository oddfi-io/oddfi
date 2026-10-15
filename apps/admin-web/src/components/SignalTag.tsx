// 信号灯四色语义 Tag（DD002 §3.4 风格边界）。
// ★ 色组纪律：信号灯四色是「风险语义色」，不是品牌强调色——不违反 RoundStatusTag 头注释
//   「不引第六种强调色」的纪律（那条约束的是品牌 accent）。色值一律取 AntD 内置 preset
//   （green / gold / orange / red），不扩 vercelTheme token，不污染既有 3 accent。
//   原型暗色值（#ff6b35 / rgba 描边等）一律禁止引入。
// 行为：opened=false → 灰 Tag「未开盘」；signal=null → 文本「—」。
import { Tag, Typography } from "antd";
import type { Signal } from "@/types/events";

const SIGNAL: Record<Signal, { color: string; text: string }> = {
  green: { color: "green", text: "绿灯" },
  yellow: { color: "gold", text: "黄灯" },
  orange: { color: "orange", text: "橙灯" },
  red: { color: "red", text: "红灯" },
};

interface Props {
  signal: Signal | null | undefined;
  /** 默认 true；false = 未开盘（风险数据无意义）→ 灰 Tag「未开盘」 */
  opened?: boolean;
}

export function SignalTag({ signal, opened = true }: Props) {
  if (!opened) return <Tag>未开盘</Tag>;
  if (signal == null) return <Typography.Text type="secondary">—</Typography.Text>;
  const s = SIGNAL[signal] ?? { color: "default", text: signal };
  return <Tag color={s.color}>{s.text}</Tag>;
}
