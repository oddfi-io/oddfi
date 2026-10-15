"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { DotsThreeIcon, QuestionIcon } from "@phosphor-icons/react";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/DropdownMenu";
import type { BusinessType } from "@/types/auth";
import type { TransactionRecord } from "@/types/portfolio";

// Portfolio History — Status 列统一渲染（PC Row + H5 Card 共用）
// 后端 ledger.status 6 态 → 文本/颜色 + Failed 时挂 DotsThree 菜单
// 菜单两项均为 mock，点击仅关闭面板（业务接入后再补 onClick 行为）

const STATUS_TO_LABEL: Record<TransactionRecord["status"], { key: string; color: string } | null> =
  {
    in_progress: { key: "statusInProgress", color: "text-secondary" },
    reviewing: { key: "statusReviewing", color: "text-secondary" },
    completed: { key: "statusCompleted", color: "text-fn-green" },
    failed: { key: "statusFailed", color: "text-fn-red" },
    appealing: { key: "statusAppealing", color: "text-secondary" },
    canceled: { key: "statusCanceled", color: "text-secondary" },
    pending: null,
  };

interface StatusCellProps {
  status: TransactionRecord["status"];
  businessType: BusinessType;
  /**
   * - "start"：inline 左对齐
   * - "end"：inline 右对齐（H5 Card 用）
   * - "center"：撑满父容器，文本居中、Failed 的 DotsThree 按钮 absolute 贴右（PC Row 用）
   */
  align?: "start" | "end" | "center";
}

function StatusCell({ status, businessType, align = "start" }: StatusCellProps) {
  const t = useTranslations("portfolio");
  const config = STATUS_TO_LABEL[status];

  if (!config) {
    // pending 在 H5 Card 占位为 "-"，PC Row（end/center）留空（保持原有行为）
    return align === "start" ? (
      <span className="text-[14px] font-normal text-primary leading-[19px]">-</span>
    ) : null;
  }

  const isFailed = status === "failed";
  // 「取消提现」仅在提现/取消提现流水的 Failed 态下出现；其他 business_type 只显示「申诉」
  const showCancelWithdraw = businessType === "withdraw" || businessType === "cancel_withdraw";

  const dropdown = isFailed ? (
    <DropdownMenu
      align="right"
      minWidth={140}
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label="More actions"
          className="flex items-center justify-center w-[24px] h-[24px] rounded-8 hover:bg-tertiary touch-manipulation"
        >
          <DotsThreeIcon size={20} weight="bold" className="text-secondary" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          {showCancelWithdraw && (
            <DropdownMenuItem onClick={close}>
              <span className="text-[14px] text-primary">{t("menuCancelWithdraw")}</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={close}>
            <span className="text-[14px] text-primary">{t("menuAppeal")}</span>
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenu>
  ) : null;

  const label = (
    <span className={`text-[14px] font-normal leading-[19px] ${config.color}`}>
      {t(config.key)}
    </span>
  );

  // center 模式：文字居中 + Failed 时 DotsThree 用 absolute 贴右
  if (align === "center") {
    return (
      <div className="relative w-full flex items-center justify-center gap-[8px]">
        {label}
        {isFailed && <QuestionIcon size={16} weight="fill" className="text-fn-red shrink-0" />}
        {dropdown && <div className="absolute right-0 top-1/2 -translate-y-1/2">{dropdown}</div>}
      </div>
    );
  }

  // start / end 模式：inline 一行
  return (
    <div className={`flex items-center gap-[8px] ${align === "end" ? "justify-end" : ""}`}>
      {label}
      {isFailed && <QuestionIcon size={16} weight="fill" className="text-fn-red shrink-0" />}
      {dropdown}
    </div>
  );
}

export default memo(StatusCell);
