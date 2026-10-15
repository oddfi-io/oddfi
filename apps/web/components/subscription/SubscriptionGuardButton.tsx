import React from "react";
import { IS_SUBSCRIPTION_MODE } from "@/lib/subscription-mode";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * DD-113 认购模式按钮守卫。
 *
 * - 认购模式开启时强制 disabled + 项目通用灰置样式（opacity-50 cursor-not-allowed）
 * - 非认购模式透传原 props，行为与原生 button 一致
 *
 * 适用于"简单替换"场景（如邀请页三按钮、Market Banner/Calendar 下注按钮）。
 * 复杂按钮（BetSummary CTA / SwapCard 提交按钮等）应直接在原按钮 props 上拼接
 * `disabled || IS_SUBSCRIPTION_MODE`，避免破坏既有交互（hover / 弹窗）。
 */
export function SubscriptionGuardButton({
  children,
  disabled,
  className = "",
  onClick,
  ...rest
}: Props) {
  if (!IS_SUBSCRIPTION_MODE) {
    return (
      <button {...rest} className={className} disabled={disabled} onClick={onClick}>
        {children}
      </button>
    );
  }
  return (
    <button
      {...rest}
      disabled
      aria-disabled="true"
      className={`${className} opacity-50 cursor-not-allowed`}
    >
      {children}
    </button>
  );
}
