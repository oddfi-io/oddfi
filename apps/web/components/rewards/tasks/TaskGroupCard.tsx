"use client";

import type { ComponentType } from "react";
import { GiftIcon, MegaphoneIcon, UsersIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { RewardRulesIcon } from "@/components/icons/RewardRulesIcon";
import { getGroupProgress } from "@/lib/rewards/selectors";
import type { TaskGroup } from "@/lib/rewards/types";
import { TaskCountdownChips } from "./TaskCountdownChips";
import { TaskItemRow } from "./TaskItemRow";
import { TaskProgressBar } from "./TaskProgressBar";

/**
 * TaskGroupCard —— 任务组卡（Figma PC 9001:158407 · H5 9021:163985）。
 * 组头（图标 + 标题 + 副标题 + 参与人数 + 查看规则）+ 倒计时 chips + 进度条 + 任务项列表。
 * 「查看规则」仅回调 onOpenRules(groupId) 上抛，弹窗由 RewardHubPage 顶层单例渲染
 * （architect Minor：禁止每张卡自持 Modal）。
 * 响应式：PC chips 在组头右侧；H5 chips 独立成行。
 */
const GROUP_ICONS: Record<string, ComponentType<{ className?: string; weight?: "fill" }>> = {
  gift: GiftIcon,
  megaphone: MegaphoneIcon,
};

export function TaskGroupCard({
  group,
  onOpenRules,
}: {
  group: TaskGroup;
  onOpenRules: (groupId: string) => void;
}) {
  const t = useTranslations("rewards");
  const { done, total } = getGroupProgress(group);
  const GroupIcon = GROUP_ICONS[group.iconName] ?? GiftIcon;

  return (
    // 外层组卡：底色透明（透出页面 #04060c），让实色填充的任务条目浮起；border 对齐 Figma line/border-secondary。
    // @figma-hardcoded: #212124 group-card border — pending design token（Figma 9001:158407 "Background+Border"）
    <div className="rounded-2xl border border-[#212124] bg-transparent p-10 max-md:p-4">
      <div className="flex flex-col gap-8">
        {/* 组头 */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-4 md:gap-6">
            {/* @figma-hardcoded: rgba(40,244,210,0.2) icon-box fill — pending design token */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(40,244,210,0.2)] md:size-12">
              <GroupIcon weight="fill" className="h-6 w-6 text-brand-default md:h-7 md:w-7" />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <h3 className="font-orbitron text-xl font-bold leading-7 tracking-[-0.2px] text-primary md:text-2xl md:leading-8 md:tracking-[-0.24px]">
                {t(`groups.${group.id}.title`)}
              </h3>
              <div className="flex flex-col gap-3">
                <p className="text-sm leading-[18px] text-secondary md:text-base md:leading-6">
                  {t(`groups.${group.id}.subtitle`)}
                </p>
                <div className="flex items-center gap-6">
                  <span className="flex items-center gap-1.5">
                    <UsersIcon className="h-4 w-4 text-secondary" />
                    <span className="text-xs font-bold leading-[18px] text-primary md:text-sm">
                      {group.poolStat}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenRules(group.id)}
                    style={{ touchAction: "manipulation" }}
                    className="flex items-center gap-1.5 text-secondary transition hover:text-primary"
                  >
                    <RewardRulesIcon className="h-4 w-4" />
                    <span className="text-xs font-bold leading-[18px] text-primary md:text-sm">
                      {t("groups.viewRules")}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* PC：chips 在右侧 */}
          <div className="hidden md:flex">
            <TaskCountdownChips endTime={group.endTime} showDays={group.showDays} />
          </div>
        </div>

        {/* H5：chips 独立成行 */}
        <div className="flex md:hidden">
          <TaskCountdownChips endTime={group.endTime} showDays={group.showDays} />
        </div>

        <TaskProgressBar done={done} total={total} />
      </div>

      {/* 任务项列表 */}
      <div className="mt-8 flex flex-col gap-4 md:gap-6">
        {group.tasks.map((task) => (
          <TaskItemRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
