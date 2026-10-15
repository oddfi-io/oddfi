"use client";

import { useEffect, useRef } from "react";
import { CaretUpDownIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useLpPositions } from "@/hooks/useLpPositions";
import type { LpPositionData } from "@/hooks/useLpPositions";
import { useWallet } from "@/hooks/useWallet";
import { useLpRefetchStore } from "@/stores/lpRefetchStore";
import PositionRow from "./PositionRow";
import PositionCard from "./PositionCard";

interface PositionTableProps {
  onAction: (position: LpPositionData) => void;
}

const SKELETON_ROW_COUNT = 3;

// PC table 骨架行 — 与正常 PositionRow 相同 h-[80px]，避免 loading 时表格被压扁
function PositionRowSkeleton({ isLast }: { isLast?: boolean }) {
  return (
    <tr className={`border-b border-secondary h-[80px] ${isLast ? "border-b-0" : ""}`}>
      {/* 7 列骨架（与 PositionRow td 数量对齐：Match / Deposited / CurrentValue / P&L / Unlock / Status / Actions） */}
      <td className="px-[16px] py-[12px]">
        <div className="flex flex-col gap-[6px]">
          <div className="h-[14px] w-[160px] rounded bg-fill-card2 animate-pulse" />
          <div className="h-[12px] w-[60px] rounded bg-fill-card2 animate-pulse" />
        </div>
      </td>
      <td className="px-[16px] py-[12px]">
        <div className="h-[14px] w-[100px] rounded bg-fill-card2 animate-pulse" />
      </td>
      <td className="px-[16px] py-[12px]">
        <div className="h-[14px] w-[100px] rounded bg-fill-card2 animate-pulse" />
      </td>
      <td className="px-[16px] py-[12px]">
        <div className="h-[14px] w-[24px] rounded bg-fill-card2 animate-pulse" />
      </td>
      <td className="px-[16px] py-[12px]">
        <div className="h-[14px] w-[88px] rounded bg-fill-card2 animate-pulse" />
      </td>
      <td className="px-[16px] py-[12px]">
        <div className="h-[24px] w-[88px] rounded-8 bg-fill-card2 animate-pulse" />
      </td>
      <td className="px-[16px] py-[12px]">
        <div className="h-[32px] w-[80px] rounded-8 bg-fill-card2 animate-pulse" />
      </td>
    </tr>
  );
}

// H5 卡片骨架 — 与正常 PositionCard 视觉等高，避免列表区域塌陷
function PositionCardSkeleton() {
  return (
    <div className="bg-fill-card1 rounded-16 p-[16px] flex flex-col gap-[24px]">
      <div className="flex flex-col gap-[12px]">
        <div className="h-[19px] w-[180px] rounded bg-fill-card2 animate-pulse" />
        <div className="flex flex-col gap-[12px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-[14px] w-[80px] rounded bg-fill-card2 animate-pulse" />
              <div className="h-[14px] w-[100px] rounded bg-fill-card2 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      <div className="h-[40px] w-full rounded-8 bg-fill-card2 animate-pulse" />
    </div>
  );
}

export default function PositionTable({ onAction }: PositionTableProps) {
  const t = useTranslations("pools");
  const { address } = useWallet();
  const { positions, isLoading, refetch } = useLpPositions(address);

  // DD-130 问题2：加流动性后链下索引器回填 positions 有 ~10s 延迟。
  // 同步态期间：3s 提速轮询 + 顶部骨架占位；新仓位入库（数量超过基线）或 25s 超时退出。
  const syncing = useLpRefetchStore((s) => s.syncing);
  const stopSync = useLpRefetchStore((s) => s.stopSync);
  const baselineRef = useRef<number | null>(null);

  // 进入同步态后、列表加载完成时捕获基线仓位数（仅捕获一次）
  useEffect(() => {
    if (!syncing) {
      baselineRef.current = null;
      return;
    }
    if (baselineRef.current === null && !isLoading) {
      baselineRef.current = positions.length;
    }
  }, [syncing, isLoading, positions.length]);

  // 新仓位入库（数量超过基线）→ 退出同步态
  useEffect(() => {
    if (syncing && baselineRef.current !== null && positions.length > baselineRef.current) {
      stopSync();
    }
  }, [syncing, positions.length, stopSync]);

  // 同步态：3s 提速轮询；25s 兜底超时（索引器异常时不无限轮询，靠原 8s 轮询继续兜）
  useEffect(() => {
    if (!syncing) return;
    const poll = setInterval(() => refetch(), 3_000);
    const timeout = setTimeout(() => stopSync(), 25_000);
    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [syncing, refetch, stopSync]);

  const emptyCell = (
    <p className="text-tertiary text-[14px] text-center py-[48px]">
      {!address ? t("connectToViewPositions") : t("noPositions")}
    </p>
  );

  return (
    <div>
      {/* PC 表格 */}
      <div className="hidden lg:block overflow-x-auto">
        <div className="border border-secondary rounded-16 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-secondary h-[72px]">
                <th className="px-[16px] text-left text-[14px] font-medium text-secondary">
                  {t("colMatch")}
                </th>
                <th className="px-[16px] text-left text-[14px] font-medium text-secondary">
                  <span className="inline-flex items-center gap-[4px]">
                    {t("deposited")} <CaretUpDownIcon size={14} className="text-tertiary" />
                  </span>
                </th>
                <th className="px-[16px] text-left text-[14px] font-medium text-secondary">
                  <span className="inline-flex items-center gap-[4px]">
                    {t("currentValue")} <CaretUpDownIcon size={14} className="text-tertiary" />
                  </span>
                </th>
                <th className="px-[16px] text-left text-[14px] font-medium text-secondary">
                  <span className="inline-flex items-center gap-[4px]">
                    {t("pnl")} <CaretUpDownIcon size={14} className="text-tertiary" />
                  </span>
                </th>
                <th className="px-[16px] text-left text-[14px] font-medium text-secondary">
                  {t("unlock")}
                </th>
                <th className="px-[16px] text-left text-[14px] font-medium text-secondary">
                  {t("colStatus")}
                </th>
                <th className="px-[16px] text-left text-[14px] font-medium text-secondary">
                  {t("colActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {!address ? (
                <tr>
                  <td colSpan={7}>{emptyCell}</td>
                </tr>
              ) : isLoading ? (
                Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
                  <PositionRowSkeleton key={i} isLast={i === SKELETON_ROW_COUNT - 1} />
                ))
              ) : positions.length === 0 && !syncing ? (
                <tr>
                  <td colSpan={7}>{emptyCell}</td>
                </tr>
              ) : (
                <>
                  {syncing && <PositionRowSkeleton isLast={positions.length === 0} />}
                  {[...positions]
                    .sort((a, b) => Number(a.unlockAt) - Number(b.unlockAt))
                    .map((p, idx) => (
                      <PositionRow
                        key={String(p.positionId)}
                        position={p}
                        onAction={onAction}
                        isLast={idx === positions.length - 1}
                      />
                    ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* H5 卡片列表 */}
      <div className="lg:hidden flex flex-col gap-[20px]">
        {!address ? (
          emptyCell
        ) : isLoading ? (
          Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => <PositionCardSkeleton key={i} />)
        ) : positions.length === 0 && !syncing ? (
          emptyCell
        ) : (
          <>
            {syncing && <PositionCardSkeleton />}
            {[...positions]
              .sort((a, b) => Number(a.unlockAt) - Number(b.unlockAt))
              .map((p) => (
                <PositionCard key={String(p.positionId)} position={p} onAction={onAction} />
              ))}
          </>
        )}
      </div>
    </div>
  );
}
