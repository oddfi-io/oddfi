"use client";

import { useEffect, useRef } from "react";

// ─── ConfettiBurst ──────────────────────────────────────────────────────────
// Claim 成功弹窗内的撒花粒子动画，WAAPI 实现（符合 animation.md "WAAPI 优先"）。
// 仅在弹窗内层渲染，absolute inset-0 受父容器边界裁剪。

const COLORS = [
  "#28F4D2", // brand mint
  "#6FF8E1", // mint hover
  "#F1C409", // fn-yellow
  "#ED7442", // fn-orange
  "#ED4C52", // fn-red
  "#2DB270", // fn-green
  "#FFFFFF",
];

const PIECE_COUNT = 70;

interface Props {
  /** 由 true 触发一次撒花；false → true 边沿再触发 */
  trigger: boolean;
}

export default function ConfettiBurst({ trigger }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trigger) return;
    const container = containerRef.current;
    if (!container) return;

    const pieces: HTMLDivElement[] = [];
    const animations: Animation[] = [];
    let rafId = 0;
    let cancelled = false;

    const startBurst = () => {
      if (cancelled) return;
      // translate3d 百分比基于元素自身尺寸，必须用容器实测像素高度
      const rect = container.getBoundingClientRect();
      const fallDistance = (rect.height || 400) + 80;

      for (let i = 0; i < PIECE_COUNT; i++) {
        const piece = document.createElement("div");
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        const startX = Math.random() * 100; // %
        const drift = (Math.random() - 0.5) * 220; // -110..110 px
        const rotateStart = Math.random() * 360;
        const rotateEnd = rotateStart + 360 + Math.random() * 720; // 1~3 圈
        const duration = 2400 + Math.random() * 1800;
        const delay = Math.random() * 600;
        const width = 6 + Math.random() * 5; // 6..11
        const height = width * (1.5 + Math.random() * 1.5); // 9..27

        piece.style.position = "absolute";
        piece.style.left = `${startX}%`;
        piece.style.top = "-24px";
        piece.style.width = `${width}px`;
        piece.style.height = `${height}px`;
        piece.style.backgroundColor = color;
        piece.style.borderRadius = "1px";
        piece.style.pointerEvents = "none";
        piece.style.willChange = "transform, opacity";
        piece.style.opacity = "0";

        container.appendChild(piece);
        pieces.push(piece);

        const rotMid = rotateStart + (rotateEnd - rotateStart) * 0.85;
        const anim = piece.animate(
          [
            {
              transform: `translate3d(0, 0, 0) rotate(${rotateStart}deg)`,
              opacity: 0,
            },
            {
              transform: `translate3d(${drift * 0.3}px, ${fallDistance * 0.25}px, 0) rotate(${rotateStart + (rotateEnd - rotateStart) * 0.3}deg)`,
              opacity: 1,
              offset: 0.12,
            },
            {
              transform: `translate3d(${drift * 0.85}px, ${fallDistance * 0.85}px, 0) rotate(${rotMid}deg)`,
              opacity: 1,
              offset: 0.85,
            },
            {
              transform: `translate3d(${drift}px, ${fallDistance}px, 0) rotate(${rotateEnd}deg)`,
              opacity: 0,
            },
          ],
          {
            duration,
            delay,
            easing: "cubic-bezier(0.22, 0.6, 0.36, 1)",
            fill: "forwards",
          }
        );
        animations.push(anim);
      }

      Promise.all(animations.map((a) => a.finished.catch(() => undefined))).then(() => {
        if (!cancelled) pieces.forEach((p) => p.remove());
      });
    };

    // 等下一帧再启动 —— 此时 Modal slideDown / inset-0 的实测高度已稳定
    rafId = requestAnimationFrame(startBurst);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      animations.forEach((a) => {
        try {
          a.cancel();
        } catch {
          // anim 已结束
        }
      });
      pieces.forEach((p) => p.remove());
    };
  }, [trigger]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden md:rounded-16 max-md:rounded-t-16"
    />
  );
}
