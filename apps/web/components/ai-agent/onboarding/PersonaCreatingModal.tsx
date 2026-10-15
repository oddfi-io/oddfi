"use client";

/**
 * "正在创建你的交易画像" 动画 modal（DD-109 · Figma 6613:133243）。
 *
 * 两阶段：
 *   1. loading — 6 步序列（每步 STEP_DURATION_MS=700ms），spinner + 步骤 checklist
 *   2. result  — 完成态 ✓ + 标题 + "开始使用" CTA
 *
 * 不可关闭（D4）：
 *   - 无 X 按钮，不监听 ESC，遮罩点击不响应
 *   - 6 步走完后自动 ENTER_RESULT_DELAY_MS=600ms 后切到 result 阶段
 *   - 用户必须点 result CTA 才退出（父组件 onClose）
 *
 * 动画选型（按 animation.md）：
 *   - spinner 旋转：CSS keyframe `animate-[ai-spin_0.85s_linear_infinite]`（纯无 lifecycle 例外）
 *   - 阶段切换 + 步骤激活：WAAPI `element.animate()`，onfinish 推进下一帧
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { CheckCircleIcon } from "@phosphor-icons/react";

const STEP_DURATION_MS = 700;
const ENTER_RESULT_DELAY_MS = 600;
const STAGE_FADE_MS = 250;
const STEP_FADE_MS = 200;

interface PersonaCreatingModalProps {
  isOpen: boolean;
  /** 用户点 result CTA 时调用 → 父组件关闭 modal 并跳 tabs。 */
  onClose: () => void;
}

type Stage = "loading" | "result";

export function PersonaCreatingModal({ isOpen, onClose }: PersonaCreatingModalProps) {
  const t = useTranslations("aiAgent.persona");
  const stepLabels = t.raw("steps") as string[];

  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<Stage>("loading");
  /** 0..stepLabels.length-1 — 当前正在进行的 step；超过最后一个即全部 done */
  const [activeIdx, setActiveIdx] = useState(0);

  const thinkingTextRef = useRef<HTMLParagraphElement | null>(null);
  const resultStageRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);

  // Portal 探测（避免 SSR window 不可用）
  useEffect(() => {
    setMounted(true);
  }, []);

  // 打开时复位状态机
  useEffect(() => {
    if (!isOpen) return;
    setStage("loading");
    setActiveIdx(0);
  }, [isOpen]);

  // 推进 step 序列：每 STEP_DURATION_MS 推进一次 activeIdx；
  // 文字切换由下方 fade-in effect 负责，不做 fade-out（避免 forwards 残留 + 新动画叠加引起的闪烁）。
  useEffect(() => {
    if (!isOpen || stage !== "loading") return;

    if (activeIdx >= stepLabels.length) {
      const tid = window.setTimeout(() => setStage("result"), ENTER_RESULT_DELAY_MS);
      timersRef.current.push(tid);
      return () => {
        window.clearTimeout(tid);
      };
    }

    const tid = window.setTimeout(() => setActiveIdx((i) => i + 1), STEP_DURATION_MS);
    timersRef.current.push(tid);
    return () => {
      window.clearTimeout(tid);
    };
  }, [activeIdx, isOpen, stage, stepLabels.length]);

  // 切换到 result 阶段：fade-in 整个 stage
  useEffect(() => {
    if (stage !== "result") return;
    const el = resultStageRef.current;
    if (!el) return;
    el.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: STAGE_FADE_MS, easing: "ease-out", fill: "backwards" }
    );
  }, [stage]);

  // active step 入场 fade-up（每次 activeIdx 变化时）
  // 先 cancel 元素上的旧动画，避免 WAAPI 在同一 opacity 属性上叠加多个关键帧导致闪烁
  useEffect(() => {
    if (stage !== "loading") return;
    const el = thinkingTextRef.current;
    if (!el) return;
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(
      [
        { opacity: 0, transform: "translateY(3px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: STEP_FADE_MS, easing: "ease-out", fill: "backwards" }
    );
  }, [activeIdx, stage]);

  // unmount cleanup
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const timers = timersRef.current;
      timers.forEach((tid) => window.clearTimeout(tid));
      timersRef.current = [];
    };
  }, []);

  if (!isOpen || !mounted) return null;

  const thinkingText =
    activeIdx < stepLabels.length ? stepLabels[activeIdx] : stepLabels[stepLabels.length - 1];

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      // 遮罩：不响应点击（D4 不可中途关闭）
      // @figma-hardcoded: rgba(4,6,12,0.7) overlay — aligns with fill/mask token
      className="fixed inset-0 z-[999] flex items-center justify-center bg-fill-mask backdrop-blur-sm"
    >
      <div
        // Figma 6613:133243：440×?, p-40, rounded-16, border, bg-fill-modal
        className="relative flex w-[440px] max-w-[92vw] flex-col items-center gap-10 rounded-2xl border border-divider bg-fill-modal p-10"
      >
        <header className="flex flex-col items-center gap-1">
          <p className="font-bold leading-[26px] text-[18px] text-primary text-center whitespace-nowrap">
            {t("title")}
          </p>
        </header>

        {stage === "loading" ? (
          <div className="flex w-full flex-col items-center gap-6">
            {/* Spinner + active 文案 */}
            <div className="flex flex-col items-center gap-2">
              <div
                aria-hidden
                className="size-10 rounded-full border-[3px] border-divider"
                style={{
                  borderTopColor: "var(--text-brand-default)",
                  animation: "spin 0.85s linear infinite",
                }}
              />
              <p
                ref={thinkingTextRef}
                className="font-medium leading-[18px] text-[14px] text-primary text-center"
              >
                {thinkingText}
              </p>
            </div>

            {/* 6-step checklist */}
            <ul className="flex flex-col items-center gap-1 w-full">
              {stepLabels.map((label, i) => {
                const done = i < activeIdx;
                const active = i === activeIdx;
                return (
                  <li
                    key={label}
                    className={[
                      "flex items-center gap-1.5 leading-[18px] text-[12px] transition-[opacity,color] duration-200",
                      done && "text-brand-default opacity-85",
                      active && "text-brand-default opacity-100",
                      !done && !active && "text-tertiary opacity-40",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span aria-hidden className="w-3 text-center font-bold">
                      {done ? "✓" : ""}
                    </span>
                    <span>{label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div
            ref={resultStageRef}
            className="flex w-full flex-col items-center gap-4"
            data-testid="persona-result-stage"
          >
            <CheckCircleIcon size={56} weight="fill" className="text-brand-default" />
            <p className="font-bold leading-[26px] text-[18px] text-primary text-center">
              {t("result.title")}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 flex h-12 w-full cursor-pointer items-center justify-center rounded-xl border-0 bg-white px-4 text-sm font-medium text-static-black transition hover:opacity-90"
            >
              {t("result.cta")}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
