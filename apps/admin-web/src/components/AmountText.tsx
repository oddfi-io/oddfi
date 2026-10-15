// 金额展示：decimal.js 格式化（千分位 + 固定小数），等宽字体。禁 parseFloat/toFixed。
// 契约：04-components.md §5，api-conventions.md「金额计算」，03-pages.md §9。
import { Typography } from "antd";
import { formatAmount } from "@/lib/amount";

interface Props {
  value: string | number | null | undefined;
  decimals?: number;
  // 单位后缀（USD / USDT / ODD …），可选。
  suffix?: string;
}

// code 排版自动走 Geist Mono（vercelTheme 已配），不硬编码字体/字号。
export function AmountText({ value, decimals = 2, suffix }: Props) {
  return <Typography.Text code>{formatAmount(value, { decimals, suffix })}</Typography.Text>;
}
