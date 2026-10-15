"use client";

import { useState } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { formatDisplayAmount } from "@/lib/decimal";
import { toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { TaskItem, TaskItemStatus } from "@/lib/rewards/types";

/**
 * TaskItemRow —— 任务项行（Figma PC Container 9003:159735 · H5 9021:164170）。
 *
 * 单组件覆盖 status(default|verifying|done) × verifyKind(click|input) 四种视觉（DD-150 §3.2）：
 *   - default        → 「去完成」白底按钮
 *   - verifying      → 「验证」灰底 +「去完成」白底（点击 verify 模拟通过 → done）
 *   - done           → 薄荷打勾，无按钮，奖励移到底部左
 * 纯前端：本地状态切换 + toast，不发请求；后端接入时由 props onVerify/onComplete 回调替换。
 *
 * 响应式：PC 横向（标题 + 奖励 pill 在左，按钮在右）；H5 纵向（标题/奖励一行，按钮/打勾一行）。
 */
export function TaskItemRow({ task }: { task: TaskItem }) {
  const t = useTranslations("rewards");
  const [status, setStatus] = useState<TaskItemStatus>(task.status);
  const isDone = status === "done";

  const handleGo = () => setStatus("verifying");
  const handleVerify = () => {
    setStatus("done");
    toastSuccess(t("tasks.toast.verified"));
  };

  const reward = `+${formatDisplayAmount(task.reward, 0)} ODD`;
  const title = t(`tasks.${task.id}.title`);
  const desc = t(`tasks.${task.id}.desc`);

  return (
    <div
      className={cn(
        "rounded-2xl border p-6",
        // @figma-hardcoded: #131314 task-item fill (H5), #212124 border — pending design token
        "border-[#212124] bg-fill-card1",
        "max-md:rounded-xl max-md:bg-[#131314] max-md:p-4",
        "flex items-start justify-between gap-4 max-md:flex-col max-md:gap-4"
      )}
    >
      {/* 左/上：标题 + 奖励 + 描述 */}
      <div className="flex min-w-0 flex-col gap-2 max-md:w-full">
        <div className="flex items-center justify-between gap-3 max-md:w-full">
          <span className="text-lg font-bold leading-[26px] text-primary max-md:text-base max-md:leading-6">
            {title}
          </span>
          {/* 奖励：PC 薄荷 pill；H5 内联薄荷文字（done 态隐藏，移到底部） */}
          {!isDone && (
            <>
              <span className="hidden shrink-0 items-center rounded-full bg-tag-brand px-2 py-0.5 text-[11px] font-medium leading-4 text-brand-default md:inline-flex">
                {reward}
              </span>
              <span className="shrink-0 text-xs font-medium leading-[18px] text-brand-default md:hidden">
                {reward}
              </span>
            </>
          )}
        </div>
        <span className="text-sm font-normal leading-[18px] text-secondary max-md:text-xs max-md:font-medium">
          {desc}
        </span>
      </div>

      {/* 右/下：按钮 或 完成态 */}
      <div className="flex shrink-0 items-center justify-end gap-4 max-md:w-full">
        {isDone ? (
          <div className="flex w-full items-center justify-between max-md:gap-4">
            <span className="hidden text-xs font-medium leading-[18px] text-brand-default max-md:inline">
              {reward}
            </span>
            <CheckCircleIcon weight="fill" className="h-6 w-6 text-brand-default" />
          </div>
        ) : (
          <>
            {status === "verifying" && (
              <button
                type="button"
                onClick={handleVerify}
                style={{ touchAction: "manipulation" }}
                // @figma-hardcoded: #212124 tertiary button fill — pending design token
                className="flex h-10 w-[88px] items-center justify-center rounded-lg bg-[#212124] text-sm font-medium leading-[18px] text-primary transition hover:brightness-110 max-md:h-8"
              >
                {t("tasks.actions.verify")}
              </button>
            )}
            <button
              type="button"
              onClick={handleGo}
              style={{ touchAction: "manipulation" }}
              className="flex h-10 w-[88px] items-center justify-center rounded-lg bg-white text-sm font-medium leading-[18px] text-static-black transition hover:brightness-95 max-md:h-8"
            >
              {t("tasks.actions.go")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
