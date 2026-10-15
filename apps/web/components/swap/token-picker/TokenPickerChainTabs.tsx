"use client";

import type { ChainTab } from "@/hooks/useTokenPickerSource";

interface TokenPickerChainTabsProps {
  tabs: ChainTab[];
  active: number | "all";
  onChange: (chainId: number | "all") => void;
}

/**
 * Figma 节点 3372:69881 (tab row) / 3372:69921 (active All) / 3372:69937 (inactive)
 * 外容器: flex gap-8 items-center · overflow-x-auto scrollbar-hide
 * 每项: h-36 · px-8 py-9 · rounded-8 · gap-4 · border · 14px regular leading-19
 * 选中态: border-white · 未选中: border-primary (#37393a)
 * Icon slot 16×16: iconUrl → <img>; All → GridFour icon; 占位 → gray circle
 */
export default function TokenPickerChainTabs({
  tabs,
  active,
  onChange,
}: TokenPickerChainTabsProps) {
  return (
    <div className="scrollbar-hide flex items-center gap-[8px] overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.chainId === active;
        const isAll = tab.chainId === "all";

        return (
          <button
            key={String(tab.chainId)}
            type="button"
            data-active={isActive || undefined}
            onClick={() => onChange(tab.chainId)}
            className={[
              "flex h-[36px] shrink-0 items-center justify-center gap-[4px] rounded-8 border px-[8px] py-[9px]",
              "whitespace-nowrap text-[14px] font-normal leading-[19px] text-primary transition-colors cursor-pointer",
              isActive ? "border-white" : "border-primary hover:border-secondary",
            ].join(" ")}
            style={{ touchAction: "manipulation" }}
          >
            {isAll ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/images/chains/all.svg" alt="" className="size-[16px]" />
            ) : tab.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tab.iconUrl} alt={tab.label} className="size-[16px] rounded-full" />
            ) : (
              // @figma-hardcoded: #2e3030 chain-placeholder — pending design token
              <span className="size-[16px] rounded-full bg-[#2e3030]" />
            )}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
