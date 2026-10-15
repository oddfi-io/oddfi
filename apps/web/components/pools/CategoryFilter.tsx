"use client";

import { StarIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { SportCategory } from "./types";

export type CategoryKey = SportCategory | "fav" | "soccer";

interface CategoryFilterProps {
  category: CategoryKey;
  search: string;
  onCategoryChange: (c: CategoryKey) => void;
  onSearchChange: (s: string) => void;
}

export default function CategoryFilter({
  category,
  search,
  onCategoryChange,
  onSearchChange,
}: CategoryFilterProps) {
  const t = useTranslations("pools");

  const tSidebar = useTranslations("sidebar");
  const CATEGORIES: { key: CategoryKey; label: string }[] = [
    { key: "fav", label: t("filterFavorites") },
    { key: "all", label: t("filterAll") },
    { key: "soccer", label: t("filterSoccer") },
    { key: "tennis", label: t("filterTennis") },
    { key: "cricket", label: t("filterCricket") },
    { key: "basketball", label: tSidebar("basketball") },
    { key: "others", label: t("filterOthers") },
  ];

  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-[20px] mb-[20px]">
      {/* H5: 搜索框在上方全宽；PC: 搜索框在右侧 */}
      <div className="order-first lg:order-last">
        <div className="flex items-center gap-[8px] bg-fill-card1 border border-secondary rounded-8 h-[40px] px-[12px] w-full lg:w-[240px]">
          <MagnifyingGlassIcon size={16} className="text-primary shrink-0" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-transparent text-[14px] text-primary placeholder:text-tertiary outline-none flex-1 min-w-0"
          />
        </div>
      </div>

      {/* Category chips — H5: horizontal scroll; PC: flex-wrap */}
      <div className="flex items-center gap-[12px] overflow-x-auto flex-nowrap lg:flex-wrap pb-[1px] scrollbar-hide">
        {CATEGORIES.map((c) => {
          const isActive = category === c.key;
          return (
            <button
              key={c.key}
              onClick={() => onCategoryChange(c.key)}
              style={{ touchAction: "manipulation" }}
              className={`flex-shrink-0 h-[40px] min-w-[72px] px-[12px] py-[9px] rounded-full flex items-center justify-center gap-[4px] text-[12px] font-medium transition-colors min-h-[44px] ${
                isActive
                  ? "bg-tag-brand border border-dt-hover text-primary"
                  : "bg-fill-input border border-secondary text-secondary hover:bg-white/[0.08]"
              }`}
            >
              {c.key === "fav" && <StarIcon size={12} weight={isActive ? "fill" : "regular"} />}
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
