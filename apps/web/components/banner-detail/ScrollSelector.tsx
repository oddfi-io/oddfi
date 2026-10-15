"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ScrollSelectorOption {
  /** 显示文案，如 "0" / "8+" */
  label: string;
}

interface Props {
  /** 离散值列表（任意长度，B2 用 0-8 + 8+） */
  values: ScrollSelectorOption[];
  /** 当前选中索引 */
  selectedIndex: number;
  /** 用户切换回调 */
  onChange?: (idx: number) => void;
}

/**
 * ScrollSelector：滚动块离散值选择器（DD-085 §3.5 决策 #5）
 *
 * Figma 节点：[3638:12292](https://www.figma.com/design/6WH0v3q8t3rImMXpt7uGXs/oddfi-UI-UX?node-id=3638-12292)
 * 视觉：4px 进度条（活跃 brand-default teal / 未达 #212124）+ 等距圆点 + 数字 label 行
 * 交互：圆点点击 + label 点击 + 进度条鼠标/触屏拖拽（pointer events 统一）
 * 通用：支持任意离散值（不限于 B2 进球数）
 */
export default function ScrollSelector({ values, selectedIndex, onChange }: Props) {
  const total = values.length;
  const safeIdx = Math.min(Math.max(0, selectedIndex), Math.max(0, total - 1));
  const progressPct = total > 1 ? (safeIdx / (total - 1)) * 100 : 0;

  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 把 clientX 折算为最近的离散索引并触发 onChange
  const updateFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || total <= 1) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      const ratio = (clientX - rect.left) / rect.width;
      const clamped = Math.min(1, Math.max(0, ratio));
      const idx = Math.round(clamped * (total - 1));
      if (idx !== safeIdx) onChange?.(idx);
    },
    [total, safeIdx, onChange]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 仅响应主键（左键 / 触屏），忽略右键/中键
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    trackRef.current?.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    trackRef.current?.releasePointerCapture(e.pointerId);
  };

  // 兜底：组件卸载时清拖拽态，避免 capture 滞留
  useEffect(() => {
    return () => setIsDragging(false);
  }, []);

  return (
    <div className="flex w-full flex-col gap-[15px] pt-3" data-figma-node="3638:12292">
      {/* Progress bar + dots（拖拽热区：高 12px，纵向居中 4px 进度条） */}
      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={total - 1}
        aria-valuenow={safeIdx}
        aria-valuetext={values[safeIdx]?.label}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative h-3 w-full select-none"
        style={{ touchAction: "none" }}
      >
        {/* Inactive track */}
        <div className="pointer-events-none absolute inset-x-0 top-1 h-1 rounded-xl bg-tertiary" />
        {/* Active progress — brand-default teal */}
        <div
          className="pointer-events-none absolute left-0 top-1 h-1 rounded-xl"
          style={{
            backgroundColor: "var(--text-brand-default)",
            width: `${progressPct}%`,
          }}
        />
        {/* Dots */}
        {values.map((opt, i) => {
          const left = total > 1 ? (i / (total - 1)) * 100 : 0;
          const isCurrent = i === safeIdx;
          const isReached = i < safeIdx;
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                // 拖拽中触发的 click（pointer up 后）忽略
                if (isDragging) return;
                e.stopPropagation();
                onChange?.(i);
              }}
              aria-label={`Select ${opt.label}`}
              aria-current={isCurrent ? "true" : undefined}
              className={[
                "absolute rounded-full",
                isCurrent
                  ? "top-0 size-3 ring-2 ring-white/15"
                  : isReached
                    ? "top-0.5 size-2 bg-white"
                    : "top-0.5 size-2 bg-tertiary",
              ].join(" ")}
              style={{
                left: `${left}%`,
                transform: "translateX(-50%)",
                ...(isCurrent && {
                  backgroundColor: "var(--text-brand-default)",
                }),
              }}
            />
          );
        })}
      </div>

      {/* Labels row */}
      <div
        className="flex w-full items-center justify-between rounded-[48px] bg-secondary py-1"
        data-figma-node="3604:12679"
      >
        {values.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange?.(i)}
            className={[
              "flex items-center justify-center px-2 text-[16px] font-medium leading-[24px]",
              i === safeIdx ? "text-brand-default" : "text-primary",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
