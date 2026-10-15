"use client";

import { useEffect, useRef } from "react";
import { animate, useInView } from "framer-motion";

type Props = {
  /** 目标数值 */
  target: number;
  /** 动画时长（秒），默认 1.2 */
  duration?: number;
  /** 自定义格式化（如 `v => '$' + v.toFixed(1) + 'M'`），默认 `toLocaleString('en-US')` 千分位整数 */
  format?: (value: number) => string;
  /** 透传到外层 span */
  className?: string;
  style?: React.CSSProperties;
};

const defaultFormat = (v: number) => Math.floor(v).toLocaleString("en-US");

/**
 * 滚到视口才触发的 count-up 数字动画。
 * 用 framer-motion `animate()` 的命令式 API + ref 直接更新 DOM，避免每帧 React re-render。
 *
 * - 目标值 0~999,999,999 通用
 * - ease: cubic-bezier(0.16, 1, 0.3, 1) — 起步快、收尾柔
 * - `useInView({ once: true })` 保证只跑一次，不会反复触发
 */
export default function CountUpNumber({
  target,
  duration = 1.2,
  format = defaultFormat,
  className,
  style,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    if (!inView || !ref.current) return;
    const node = ref.current;
    node.textContent = formatRef.current(0);
    const controls = animate(0, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        node.textContent = formatRef.current(v);
      },
    });
    return () => controls.stop();
  }, [inView, target, duration]);

  return (
    <span ref={ref} className={className} style={style} aria-label={format(target)}>
      {format(0)}
    </span>
  );
}
