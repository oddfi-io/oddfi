import { TASK_GROUPS } from "@/lib/rewards/fixtures";
import { TaskGroupCard } from "./TaskGroupCard";

/**
 * TaskCenterTab —— 任务中心 Tab 内容（Figma PC 9001:158397 · H5 9021:163984）。
 * 渲染 fixture 任务组列表 → TaskGroupCard。onOpenRules 上抛到 RewardHubPage 顶层规则弹窗。
 */
export function TaskCenterTab({ onOpenRules }: { onOpenRules: (groupId: string) => void }) {
  return (
    <div className="flex flex-col gap-6">
      {TASK_GROUPS.map((group) => (
        <TaskGroupCard key={group.id} group={group} onOpenRules={onOpenRules} />
      ))}
    </div>
  );
}
