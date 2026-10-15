"use client";

/**
 * DD-117 — 链上下注信号灯展示组件。
 *
 * 按 DD §3.3 优先级表渲染：loading > error > degraded > red > orange/partial > yellow > green > idle.
 * disabled 信号通过同模块 isSignalDisabled 计算，供 BetSummary 控制 submit 按钮。
 *
 * 颜色 / 图标：design-tokens.md fn-* + Phosphor *Icon 后缀（design-tokens.md / mobile-h5.md）。
 */

import { useTranslations } from "next-intl";
import {
  CheckCircleIcon,
  WarningIcon,
  WarningOctagonIcon,
  XCircleIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import { div } from "@/lib/decimal";
import { formatOdds, formatOddWei } from "@/lib/odds";
import type { PreviewSignalState } from "@/hooks/usePreviewSignal";

/** 链上锁定赔率为万分位整数（22900 = 2.29），先 ÷10000 再走通用 formatOdds */
function formatLockedOdds(bps: string): string {
  return formatOdds(div(bps, "10000"));
}

interface Props {
  state: PreviewSignalState;
}

type Variant =
  | "loading"
  | "network"
  | "errorOther"
  | "degraded"
  | "red"
  | "orange"
  | "yellow"
  | "green";

interface Resolved {
  variant: Variant;
  amount?: string;
  oddsValue?: string;
}

/**
 * 计算渲染变体；返回 null 表示 idle（不渲染）。
 * 单独导出方便测试和 BetSummary 共享判断。
 */
export function resolveSignal(state: PreviewSignalState): Resolved | null {
  if (state.loading) return { variant: "loading" };
  if (state.error?.kind === "network") return { variant: "network" };
  if (state.error) return { variant: "errorOther" };
  const d = state.data;
  if (!d) return null;
  if (d.degraded) return { variant: "degraded" };
  if (d.signal === 3) return { variant: "red", amount: formatOddWei(d.maxAcceptableAmount) };
  // signal=2 即使 partialFill=false 仍渲染 orange，避免 silent drop（REV-v3 C-02）
  if (d.signal === 2) return { variant: "orange", amount: formatOddWei(d.acceptedAmount) };
  if (d.signal === 1) return { variant: "yellow" };
  if (d.signal === 0) return { variant: "green", oddsValue: formatLockedOdds(d.lockedOdds) };
  return null;
}

/** submit 按钮是否应禁用 */
export function isSignalDisabled(state: PreviewSignalState): boolean {
  if (state.loading) return true;
  if (state.error) return true;
  if (!state.data) return false; // idle 不影响
  if (state.data.degraded) return true;
  if (state.data.signal === 3) return true;
  return false;
}

const STYLE: Record<Variant, { container: string; iconCls: string }> = {
  loading: { container: "bg-fill-card2 text-tertiary", iconCls: "text-tertiary animate-spin" },
  network: { container: "bg-tag-red text-fn-red", iconCls: "text-fn-red" },
  errorOther: { container: "bg-tag-red text-fn-red", iconCls: "text-fn-red" },
  degraded: { container: "bg-tag-orange text-orange", iconCls: "text-orange" },
  red: { container: "bg-tag-red text-fn-red", iconCls: "text-fn-red" },
  orange: { container: "bg-tag-orange text-orange", iconCls: "text-orange" },
  yellow: { container: "bg-tag-yellow text-fn-yellow", iconCls: "text-fn-yellow" },
  green: { container: "bg-tag-green text-fn-green", iconCls: "text-fn-green" },
};

export default function SignalLightIndicator({ state }: Props) {
  const t = useTranslations("betSlip.signalLight");
  const resolved = resolveSignal(state);
  if (!resolved) return null;

  const { variant } = resolved;
  const style = STYLE[variant];

  let text: string;
  let Icon: typeof CheckCircleIcon = CheckCircleIcon;
  let iconWeight: "regular" | "fill" = "fill";

  switch (variant) {
    case "loading":
      text = t("loading");
      Icon = CircleNotchIcon;
      iconWeight = "regular";
      break;
    case "network":
      text = t("networkError");
      Icon = XCircleIcon;
      break;
    case "errorOther":
      text = t("previewUnavailable");
      Icon = XCircleIcon;
      break;
    case "degraded":
      text = t("degraded");
      Icon = WarningOctagonIcon;
      break;
    case "red":
      text = t("red", { max: resolved.amount ?? "0" });
      Icon = XCircleIcon;
      break;
    case "orange":
      text = t("orangePartial", { accepted: resolved.amount ?? "0" });
      Icon = WarningOctagonIcon;
      break;
    case "yellow":
      text = t("yellow");
      Icon = WarningIcon;
      break;
    case "green":
      text = t("green", { odds: resolved.oddsValue ?? "" });
      Icon = CheckCircleIcon;
      break;
  }

  return (
    <div
      role="status"
      data-variant={variant}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${style.container}`}
    >
      <Icon className={`size-4 shrink-0 ${style.iconCls}`} weight={iconWeight} aria-hidden="true" />
      <span className="leading-snug">{text}</span>
    </div>
  );
}
