"use client";

/**
 * DD-119 P2 — Betslip 底部告警条（异常态）。
 *
 * PRD §异常场景：下注接口超时 / 网络异常 → "网络异常，请稍后重试" 红色告警条，可重试。
 * 另支持黄色 warn 态（链上拥堵等非阻断提示）。
 *
 * 样式镜像 markets-replica_V2.html .bc-alert（radius 10 / px-12 py-10 / 12.5px），
 * 颜色按项目 Design Token：err → fn-red / tag-red；warn → fn-yellow / tag-yellow。
 * 位置：BetSummary footer 确认按钮上方（移动端 sheet footer 同位）。
 */

import { XCircleIcon, WarningIcon } from "@phosphor-icons/react";

export type BetSlipAlertVariant = "warn" | "err";

interface Props {
  variant: BetSlipAlertVariant;
  message: string;
}

const STYLE: Record<BetSlipAlertVariant, string> = {
  err: "bg-tag-red border border-fn-red/40 text-fn-red",
  warn: "bg-tag-yellow border border-fn-yellow/35 text-fn-yellow",
};

export default function BetSlipAlert({ variant, message }: Props) {
  const Icon = variant === "err" ? XCircleIcon : WarningIcon;
  return (
    <div
      role="alert"
      data-variant={variant}
      className={`flex items-start gap-[8px] w-full rounded-12 px-[12px] py-[10px] text-[12.5px] leading-[1.5] font-medium ${STYLE[variant]}`}
    >
      <Icon className="size-4 shrink-0 mt-[1px]" weight="fill" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
