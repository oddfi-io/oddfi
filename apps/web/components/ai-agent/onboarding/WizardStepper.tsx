"use client";

/**
 * AI Agent 首配 wizard 顶部步骤条（DD-109 Figma 6641:140160）。
 *
 * 视觉规格：
 *   - 头部：32×32 sparkle 图标 + 20/28 Bold 标题
 *   - 步骤行：28×28 圆点 × 3，1px × 80px 灰线连接
 *   - 三态：
 *       done    → 白底 + CheckIcon（16, weight=bold, text static-black）
 *       active  → 白底 + 12/18 Bold 黑数字
 *       future  → bg-fill-modal + border-secondary + 12/18 Bold tertiary 数字
 *
 * 与 DepositStepper 的差异（不复用）：
 *   - 连接线固定 80px（DepositStepper 是 justify-between 动态宽度）
 *   - 接受 props 化的 stepLabels（DepositStepper 写死 i18n("deposit")）
 *   - 顶部多一个 title + sparkle 区
 */

import Image from "next/image";
import { CheckIcon } from "@phosphor-icons/react";

interface WizardStepperProps {
  /** 顶部标题，如 "三步创建你的专属 Agent"。i18n 在调用方解析后传入。 */
  title: string;
  /** 3 个步骤的标签（顺序：basics / behavior / notify）。i18n 在调用方解析后传入。 */
  stepLabels: [string, string, string];
  /** 当前 step 的下标，0-based。 */
  currentIndex: 0 | 1 | 2;
}

type DotState = "done" | "active" | "future";

function StepDot({ state, number }: { state: DotState; number: number }) {
  if (state === "done") {
    return (
      <div
        data-testid={`wizard-step-dot-${number}`}
        data-state="done"
        className="size-[28px] rounded-full bg-white flex items-center justify-center shrink-0"
      >
        <CheckIcon size={16} weight="bold" className="text-static-black" />
      </div>
    );
  }

  if (state === "active") {
    return (
      <div
        data-testid={`wizard-step-dot-${number}`}
        data-state="active"
        className="size-[28px] rounded-full bg-white flex items-center justify-center shrink-0"
      >
        <span className="text-[12px] font-bold text-static-black leading-[18px]">{number}</span>
      </div>
    );
  }

  return (
    <div
      data-testid={`wizard-step-dot-${number}`}
      data-state="future"
      className="size-[28px] rounded-full bg-fill-modal border border-secondary flex items-center justify-center shrink-0"
    >
      <span className="text-[12px] font-bold text-tertiary leading-[18px]">{number}</span>
    </div>
  );
}

function Connector({ done }: { done: boolean }) {
  // 80×28 容器，水平居中 1px 线；done 态白色，future 态灰色（与 future dot 边框同色）
  return (
    <div className="h-[28px] w-[80px] flex items-center justify-center shrink-0">
      <div className={done ? "h-px w-full bg-white" : "h-px w-full bg-tertiary"} />
    </div>
  );
}

function dotState(index: number, currentIndex: number): DotState {
  if (index < currentIndex) return "done";
  if (index === currentIndex) return "active";
  return "future";
}

export function WizardStepper({ title, stepLabels, currentIndex }: WizardStepperProps) {
  return (
    <div className="flex flex-col gap-[40px] items-center w-full">
      {/* Header：sparkle + title */}
      <div className="flex gap-[8px] items-center justify-center">
        <Image
          src="/images/ai-agent/sparkle.svg"
          alt=""
          width={32}
          height={32}
          className="size-[32px] shrink-0"
        />
        <p className="font-bold leading-[28px] text-[20px] text-primary text-center whitespace-nowrap">
          {title}
        </p>
      </div>

      {/* Step row */}
      <div className="flex gap-[8px] items-start justify-center px-[40px] w-full">
        {stepLabels.map((label, i) => {
          const state = dotState(i, currentIndex);
          const number = i + 1;
          return (
            <div key={label} className="flex items-start gap-[8px]">
              <div className="flex flex-col gap-[8px] items-center shrink-0">
                <StepDot state={state} number={number} />
                <p
                  className={[
                    "font-medium leading-[18px] text-[12px] text-center whitespace-nowrap",
                    state === "future" ? "text-tertiary" : "text-primary",
                  ].join(" ")}
                >
                  {label}
                </p>
              </div>
              {i < stepLabels.length - 1 && <Connector done={i < currentIndex} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
