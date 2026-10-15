"use client";

// DD-082 — Portfolio 状态筛选菜单
// Figma: 3713:141438（按状态筛选面板）
// 单组件替代旧 TransactionFilterMenu：Bet Tab 仅 Bet 分组，History Tab 含 Bet / Stake / LP / Other 全分组

import { memo, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FunnelIcon, CheckIcon } from "@phosphor-icons/react";
import type { FilterStatus } from "@/lib/portfolio-filter";

interface Props {
  variant: "bet" | "history";
  status: FilterStatus;
  onChange: (status: FilterStatus) => void;
  hideAllOption?: boolean;
}

interface RowSpec {
  status: FilterStatus;
  i18nKey: string;
}

interface SectionSpec {
  headerI18nKey: string;
  rows: RowSpec[];
}

const BET_SECTION: SectionSpec = {
  headerI18nKey: "bet",
  rows: [
    { status: "bet_all", i18nKey: "filterBetAll" },
    { status: "bet_cancel", i18nKey: "filterCancelBet" },
    { status: "bet_won", i18nKey: "filterResultWon" },
    { status: "bet_lost", i18nKey: "filterResultLost" },
    { status: "claim", i18nKey: "filterClaim" },
  ],
};

const STAKE_SECTION: SectionSpec = {
  headerI18nKey: "stake",
  rows: [
    { status: "stake_all", i18nKey: "filterStakeAll" },
    { status: "stake", i18nKey: "filterStake" },
    { status: "unstake", i18nKey: "filterUnstake" },
  ],
};

const LP_SECTION: SectionSpec = {
  headerI18nKey: "liquidity",
  rows: [
    { status: "lp_all", i18nKey: "filterLpAll" },
    { status: "add_lp", i18nKey: "filterAddLp" },
    { status: "remove_lp", i18nKey: "filterRemoveLp" },
  ],
};

const OTHER_ROWS: RowSpec[] = [
  { status: "deposit", i18nKey: "filterDeposit" },
  { status: "withdraw", i18nKey: "filterWithdraw" },
];

function StatusFilterMenu({ variant, status, onChange, hideAllOption }: Props) {
  const t = useTranslations("portfolio");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = status !== "all";

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const handleSelect = (next: FilterStatus) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* @figma-hardcoded: #111114 fill-input1 — pending design token */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ touchAction: "manipulation" }}
        aria-label="Filter by status"
        aria-expanded={open}
        className={`flex items-center justify-center size-[44px] rounded-12 bg-[#111114] border-[0.5px] ${active ? "border-dt-hover" : "border-secondary"} min-h-[44px]`}
      >
        <FunnelIcon size={20} className={active ? "text-fn-brand" : "text-primary"} />
      </button>
      {open && (
        <div
          // @figma-hardcoded: #111114 popover-bg / #37393a border-primary — pending design token
          className="absolute top-[52px] left-0 z-50 w-[200px] max-h-[480px] overflow-auto rounded-8 bg-[#111114] border-[0.5px] border-[#37393a] p-[8px] flex flex-col gap-[2px]"
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
          role="menu"
        >
          <div className="h-[32px] px-[12px] flex items-center text-[12px] leading-[18px] text-secondary">
            {t("filterMenuTitle")}
          </div>

          {!hideAllOption && (
            <MenuRow
              label={t("filterAll")}
              selected={status === "all"}
              onClick={() => handleSelect("all")}
              height={32}
            />
          )}

          <SectionBlock section={BET_SECTION} t={t} status={status} onSelect={handleSelect} />

          {variant === "history" && (
            <>
              <SectionBlock section={STAKE_SECTION} t={t} status={status} onSelect={handleSelect} />
              <SectionBlock section={LP_SECTION} t={t} status={status} onSelect={handleSelect} />
              <SectionHeader label={t("filterOther")} />
              {OTHER_ROWS.map((row) => (
                <MenuRow
                  key={row.status}
                  label={t(row.i18nKey)}
                  selected={status === row.status}
                  onClick={() => handleSelect(row.status)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(StatusFilterMenu);

function SectionBlock({
  section,
  t,
  status,
  onSelect,
}: {
  section: SectionSpec;
  t: (k: string) => string;
  status: FilterStatus;
  onSelect: (s: FilterStatus) => void;
}) {
  return (
    <>
      <SectionHeader label={t(section.headerI18nKey)} />
      {section.rows.map((row) => (
        <MenuRow
          key={row.status}
          label={t(row.i18nKey)}
          selected={status === row.status}
          onClick={() => onSelect(row.status)}
        />
      ))}
    </>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="h-[32px] px-[12px] flex items-center text-[12px] leading-[18px] text-tertiary">
      {label}
    </div>
  );
}

function MenuRow({
  label,
  selected,
  onClick,
  height = 28,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  height?: 28 | 32;
}) {
  // @figma-hardcoded: #212124 row-selected — pending design token
  const heightCls = height === 32 ? "h-[32px]" : "h-[28px]";
  return (
    <button
      onClick={onClick}
      style={{ touchAction: "manipulation" }}
      role="menuitemradio"
      aria-checked={selected}
      className={`flex items-center justify-between ${heightCls} px-[12px] rounded-8 text-[12px] font-medium leading-[18px] text-primary transition-colors ${selected ? "bg-[#212124]" : "hover:bg-[#212124]"}`}
    >
      <span>{label}</span>
      {selected && <CheckIcon size={16} className="text-fn-brand" />}
    </button>
  );
}
