"use client";

import { useTranslations } from "next-intl";
import type { PositionStatus, ReturnResult } from "./types";

/* ── 通用标签 ── */
type TagColor = "green" | "red" | "orange" | "gray";

const colorMap: Record<TagColor, string> = {
  green: "bg-tag-green text-fn-green",
  red: "bg-tag-red text-fn-red",
  orange: "bg-tag-brand text-brand-default",
  gray: "bg-tag-gray text-tertiary",
};

export function PoolTag({ color, children }: { color: TagColor; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] ${colorMap[color]}`}
    >
      {children}
    </span>
  );
}

/* ── 仓位状态 — Figma node 3559:170823 (Active) / 3559:170826 (Ready) 之外 4 态沿用同款 PoolTag ── */
export function PositionStatusBadge({
  status,
  timeLeft,
}: {
  status: PositionStatus;
  timeLeft: string;
}) {
  const t = useTranslations("pools");
  switch (status) {
    case "ready":
      // Figma: bg rgba(45,178,112,0.1) text #2db270
      return <PoolTag color="green">{t("statusReady")}</PoolTag>;

    case "withdrawable":
      // 复用 Ready 的 green 色 — 业务都是 "可下一步操作" 的正向状态
      return <PoolTag color="green">{t("statusWithdrawable")}</PoolTag>;

    case "unbonding":
      // 排队等 epoch，用 orange 表示 "进行中、不能操作"
      return <PoolTag color="orange">{t("statusUnbonding")}</PoolTag>;

    case "withdrawn":
      // 已结束 — 灰色低权重
      return <PoolTag color="gray">{t("statusWithdrawn")}</PoolTag>;

    case "liquidated":
      // 损失吃光本金 — 红色警示
      return <PoolTag color="red">{t("statusLiquidated")}</PoolTag>;

    case "active":
    default: {
      // Figma: bg rgba(40,244,210,0.15) text #28f4d2，文本 "Active · Xt left"（dot 为 U+00B7）
      // timeLeft 为 "Xd" / "Xh" / "Xm"，不足 1m 时为空字符串
      const label = timeLeft ? `${t("statusActive")} · ${timeLeft}` : t("statusActive");
      return <PoolTag color="orange">{label}</PoolTag>;
    }
  }
}

/* ── 仓位操作列 — 按 status 派生 2 种视觉 ──
   - ready / withdrawable → 实色按钮（Redeem / Withdraw，触发 Modal 进入对应链上调用）
   - 其他态（active / unbonding / withdrawn / liquidated） → 灰色 "—" 占位（按用户提供的 LP 仓位映射表）

   variant: row（PC 表格 32px h，紧凑）/ card（H5 卡片 40px h，全宽） */
export function PositionAction({
  status,
  onClick,
  variant = "row",
}: {
  status: PositionStatus;
  onClick: () => void;
  variant?: "row" | "card";
}) {
  const t = useTranslations("pools");
  const isActionable = status === "ready" || status === "withdrawable";
  const buttonLabel = status === "withdrawable" ? t("withdraw") : t("redeem");

  if (isActionable) {
    if (variant === "card") {
      return (
        <button
          onClick={onClick}
          style={{ touchAction: "manipulation" }}
          className="w-full h-[40px] bg-btn-tertiary text-primary rounded-8 text-[12px] font-medium hover:bg-btn-tertiary-hover transition-colors shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]"
        >
          {buttonLabel}
        </button>
      );
    }
    return (
      <button
        onClick={onClick}
        style={{ touchAction: "manipulation" }}
        className="bg-btn-tertiary text-white rounded-8 px-[16px] h-[32px] text-[14px] font-medium hover:bg-btn-tertiary-hover transition-colors"
      >
        {buttonLabel}
      </button>
    );
  }

  // 非操作态统一显示 "—"（按 LP 仓位状态与操作映射表）
  if (variant === "card") {
    return (
      <div className="w-full h-[40px] flex items-center justify-center text-[14px] text-tertiary">
        —
      </div>
    );
  }
  return <span className="text-[14px] text-tertiary">—</span>;
}

/* ── 收益结果 ── */
export function ReturnResultBadge({ result }: { result: ReturnResult }) {
  const t = useTranslations("pools");

  if (result === "house_won") {
    return <PoolTag color="green">{t("houseWon")}</PoolTag>;
  }

  // house_lost
  return <PoolTag color="red">{t("houseLost")}</PoolTag>;
}
