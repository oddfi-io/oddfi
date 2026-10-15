"use client";

/**
 * Group 多选下拉筛选器（Figma `4384:97321`）。
 *
 * 功能：多选 checkbox 菜单，用自定义 CaretDownCustomIcon。
 * 筛选逻辑等 mock 数据补 fixture.group_id 后接入；
 * options 为空时显示 Coming soon 占位。
 *
 * H5 行为：底部抽屉 + draft 状态，点 Apply 才提交，关闭/Cancel 撤销。
 * PC 行为：下拉菜单，点选项即时生效。
 */
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon } from "@phosphor-icons/react";
import CaretDownCustomIcon from "@/components/icons/CaretDownCustomIcon";
import { useIsPhone } from "@/hooks/useIsPhone";
import MobileBottomSheet from "@/components/ui/MobileBottomSheet";

export interface GroupOption {
  id: string;
  label: string;
}

interface CalendarFiltersProps {
  windowStart: string;
  windowEnd: string;
  options?: GroupOption[];
  selected?: string[];
  onSelectedChange?: (selected: string[]) => void;
}

export default function CalendarFilters({
  options = [],
  selected: selectedProp,
  onSelectedChange,
}: CalendarFiltersProps) {
  const t = useTranslations("calendarPage");
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const [localSelected, setLocalSelected] = useState<string[]>([]);
  // H5 草稿：打开抽屉时复制 committed 选中，Apply 才写入
  const [draftSelected, setDraftSelected] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = selectedProp ?? localSelected;
  const setSelected = (ids: string[]) => {
    if (selectedProp === undefined) setLocalSelected(ids);
    onSelectedChange?.(ids);
  };

  // PC outside-click 关闭（H5 由 MobileBottomSheet backdrop/swipe 处理，无需此 handler）
  useEffect(() => {
    if (!open || isPhone) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, isPhone]);

  // 打开 H5 抽屉时将已提交的选中同步到草稿
  const handleOpen = () => {
    if (isPhone) setDraftSelected(selected);
    setOpen(true);
  };

  // H5 Apply：将草稿写入 committed 状态并关闭
  const handleApply = () => {
    setSelected(draftSelected);
    setOpen(false);
  };

  // H5 Cancel / 拖拽关闭：直接关闭，不提交草稿
  const handleSheetClose = () => {
    setOpen(false);
  };

  const allIds = options.map((o) => o.id);

  // PC 用已提交状态
  const isAllSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));
  const hasSelection = selected.length > 0 && !isAllSelected;

  // H5 draft 计算
  const isDraftAllSelected = allIds.length > 0 && allIds.every((id) => draftSelected.includes(id));

  // PC：即时更新 committed 状态
  const toggleAll = () => setSelected(isAllSelected ? [] : [...allIds]);
  const toggleOption = (id: string) => {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    setSelected(next);
  };

  // H5：仅更新草稿
  const draftToggleAll = () => setDraftSelected(isDraftAllSelected ? [] : [...allIds]);
  const draftToggleOption = (id: string) => {
    setDraftSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-[6px] h-[40px] pl-[16px] pr-[12px] rounded-[12px] bg-secondary border border-secondary text-[12px] leading-[18px] font-medium text-primary hover:bg-tertiary transition-colors"
      >
        <span>
          {hasSelection
            ? t("filters.groupWithCount", { count: selected.length })
            : t("filters.group")}
        </span>
        <CaretDownCustomIcon
          size={14}
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* PC 下拉菜单：即时提交 */}
      {open && !isPhone && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label="Group filter"
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-[160px] rounded-[12px] border border-secondary p-[16px] flex flex-col gap-[4px]"
          style={{
            // @figma-hardcoded: rgba(17,17,20,0.95) group-filter-menu-bg — pending design token
            background: "rgba(17,17,20,0.95)",
            backdropFilter: "blur(6.5px)",
          }}
        >
          {options.length === 0 ? (
            <span className="text-[12px] leading-[18px] text-tertiary">
              {t("filters.comingSoon")}
            </span>
          ) : (
            <>
              <GroupCheckboxRow
                checked={isAllSelected}
                label={t("filters.all")}
                onClick={toggleAll}
              />
              {options.map((opt) => (
                <GroupCheckboxRow
                  key={opt.id}
                  checked={selected.includes(opt.id)}
                  label={opt.label}
                  onClick={() => toggleOption(opt.id)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* H5 底部抽屉：draft 模式，Apply 才提交 */}
      {isPhone && (
        <MobileBottomSheet
          open={open}
          onClose={handleSheetClose}
          title={t("filters.group")}
          showDragHandle
        >
          <div
            role="listbox"
            aria-multiselectable="true"
            aria-label="Group filter"
            className="flex flex-col gap-[4px] px-[16px]"
          >
            {options.length === 0 ? (
              <span className="text-[12px] leading-[18px] text-tertiary">
                {t("filters.comingSoon")}
              </span>
            ) : (
              <>
                <GroupCheckboxRow
                  checked={isDraftAllSelected}
                  label="All"
                  onClick={draftToggleAll}
                />
                {options.map((opt) => (
                  <GroupCheckboxRow
                    key={opt.id}
                    checked={draftSelected.includes(opt.id)}
                    label={opt.label}
                    onClick={() => draftToggleOption(opt.id)}
                  />
                ))}
              </>
            )}
          </div>

          {/* Apply / Cancel 按钮 */}
          <div className="flex gap-[12px] px-[16px] pt-[16px] pb-[8px]">
            <button
              type="button"
              onClick={handleSheetClose}
              className="flex-1 h-[44px] rounded-12 border border-secondary text-[14px] font-bold text-primary"
              style={{ touchAction: "manipulation" }}
            >
              {t("filters.cancel")}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 h-[44px] rounded-12 text-[14px] font-bold bg-btn-primary text-static-black"
              style={{ touchAction: "manipulation" }}
            >
              {t("filters.apply")}
            </button>
          </div>
        </MobileBottomSheet>
      )}
    </div>
  );
}

interface GroupCheckboxRowProps {
  checked: boolean;
  label: string;
  onClick: () => void;
}

function GroupCheckboxRow({ checked, label, onClick }: GroupCheckboxRowProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={checked}
      onClick={onClick}
      className="flex items-start gap-[8px] py-[4px] w-full text-left"
    >
      {/* icon wrapper: py-px 给 checkbox 顶部留 1px 偏移，与 Figma 对齐 */}
      <div className="flex items-start py-px shrink-0">
        <div
          className={`w-4 h-4 rounded-[3px] flex items-center justify-center transition-colors ${
            checked ? "bg-fn-brand" : "border border-tertiary"
          }`}
        >
          {checked && <CheckIcon size={10} weight="bold" className="text-static-black" />}
        </div>
      </div>
      {/* label wrapper: items-end 与 Figma GTCheckboxV5/label-14px 对齐 */}
      <div className="flex items-end justify-center shrink-0">
        <span className="text-[14px] leading-[19px] font-medium text-primary whitespace-nowrap">
          {label}
        </span>
      </div>
    </button>
  );
}
