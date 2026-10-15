"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Footer from "@/components/layout/Footer";
import MobileFooter from "@/components/layout/MobileFooter";
import { RewardHubHero } from "./RewardHubHero";
import { RewardRulesModal } from "./RewardRulesModal";
import { RewardTabBar } from "./RewardTabBar";
import { RewardRecordsTab } from "./records/RewardRecordsTab";
import { TaskCenterTab } from "./tasks/TaskCenterTab";

type RewardTab = "task" | "reward";

/**
 * RewardHubPage —— 奖励中心页面外壳（DD-150）。Figma PC 9001:158396 · H5 9021:162815。
 *
 * 职责：主 Tab 状态(task|reward) + 规则弹窗单例(rulesOpen + activeRuleKey)。
 * 「查看规则」由各 TaskGroupCard 通过 onOpenRules(key) 上抛，此处唯一渲染一个
 * RewardRulesModal（architect Minor：禁止每张卡自持 Modal 造成焦点陷阱冲突）。
 */
export function RewardHubPage() {
  const t = useTranslations("rewards");
  const [tab, setTab] = useState<RewardTab>("task");
  // 规则弹窗单例（活动组 id；null = 关闭）。弹窗本体由 Batch 8 RewardRulesModal 渲染。
  const [rulesGroupId, setRulesGroupId] = useState<string | null>(null);

  return (
    <div className="w-full">
      {/* Hero 促销头图（全宽 bleed） */}
      <RewardHubHero />

      <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 md:px-[120px]">
        <RewardTabBar
          ariaLabel={t("tabs.ariaLabel")}
          items={[
            { key: "task", label: t("tabs.taskCenter") },
            { key: "reward", label: t("tabs.myRewards") },
          ]}
          value={tab}
          onChange={setTab}
        />

        {/* Tab 内容 */}
        <div className="pb-16 pt-6">
          {tab === "task" ? <TaskCenterTab onOpenRules={setRulesGroupId} /> : <RewardRecordsTab />}
        </div>
      </div>

      {/* 复用 landing footer（与 PartnersSection 同款响应式切换：PC Footer / H5 MobileFooter） */}
      <div className="hidden md:block">
        <Footer />
      </div>
      <div className="md:hidden">
        <MobileFooter />
      </div>

      {/* 规则弹窗单例（顶层渲染，受 rulesGroupId 控制） */}
      <RewardRulesModal groupId={rulesGroupId} onClose={() => setRulesGroupId(null)} />
    </div>
  );
}
