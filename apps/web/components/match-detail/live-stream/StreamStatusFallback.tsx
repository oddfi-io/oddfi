"use client";

/**
 * StreamStatusFallback — DD-126 pending 态占位（"直播即将开始"）。
 *
 * 与 StreamPlayer 同高（217px）+ 同圆角，保持布局稳定避免轮询命中 available 时跳变。
 * unavailable 态由父级直接不渲染（不走本组件）。纯展示，message 由父级注入。
 */
interface Props {
  message: string;
}

export default function StreamStatusFallback({ message }: Props) {
  return (
    <div
      className="flex h-[217px] w-full items-center justify-center overflow-hidden rounded-12 bg-secondary"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-[8px] px-4 text-center">
        {/* 脉冲点呼应 Live 角标（idle skeleton 脉冲，非状态生命周期动画） */}
        <span className="size-[8px] animate-pulse rounded-full bg-fn-brand" />
        <span className="text-[13px] leading-[18px] text-secondary">{message}</span>
      </div>
    </div>
  );
}
