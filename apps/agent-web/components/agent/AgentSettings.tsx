"use client";

import { useState } from "react";
import { BasicTab } from "./tabs/BasicTab";
import { BehaviorTab } from "./tabs/BehaviorTab";
import { PushTab } from "./tabs/PushTab";
import { AccountTab } from "./tabs/AccountTab";
import { MemoryTab } from "./tabs/MemoryTab";

type TabId = "basic" | "behavior" | "push" | "account" | "memory";

const TABS: { id: TabId; num: string; label: string }[] = [
  { id: "basic", num: "01", label: "基础" },
  { id: "behavior", num: "02", label: "行为" },
  { id: "push", num: "03", label: "推送" },
  { id: "account", num: "04", label: "用量" },
  { id: "memory", num: "05", label: "记忆" },
];

export function AgentSettings() {
  const [active, setActive] = useState<TabId>("basic");

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-6">
      <nav className="flex gap-1 mb-6 border-b border-edge">
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`px-4 py-3 text-sm flex items-baseline gap-1.5 border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-3 hover:text-ink-2"
              }`}
            >
              <span className="font-mono text-xs text-ink-3">{t.num}</span>
              {t.label}
            </button>
          );
        })}
      </nav>

      <div>
        {active === "basic" && <BasicTab />}
        {active === "behavior" && <BehaviorTab />}
        {active === "push" && <PushTab />}
        {active === "account" && <AccountTab />}
        {active === "memory" && <MemoryTab />}
      </div>
    </div>
  );
}
