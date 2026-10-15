"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { getLendingPositions } from "@/lib/api";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import type { CollateralPosition } from "@/types/lending";
import BorrowPositionRow from "./BorrowPositionRow";
import H5BorrowCard from "./H5BorrowCard";
import BorrowDrawer from "./BorrowDrawer";

/** Skeleton row matching BorrowPositionRow dimensions (PC) */
function SkeletonRow() {
  return (
    <div className="flex items-center h-[73px] border-b border-secondary py-[16px] animate-pulse">
      {/* Match / Selection skeleton */}
      <div className="w-[380px] pl-[16px] flex items-center gap-[8px] shrink-0">
        <div className="size-[32px] rounded-full bg-fill-card1 shrink-0" />
        <div className="flex flex-col gap-[4px]">
          <div className="h-[14px] w-[180px] rounded bg-fill-card1" />
          <div className="h-[12px] w-[120px] rounded bg-fill-card1" />
        </div>
      </div>
      {/* Principal skeleton */}
      <div className="w-[240px] px-[16px] shrink-0">
        <div className="h-[14px] w-[100px] rounded bg-fill-card1" />
      </div>
      {/* Return skeleton */}
      <div className="w-[240px] px-[16px] shrink-0">
        <div className="h-[14px] w-[60px] rounded bg-fill-card1" />
      </div>
      {/* Credit Limit skeleton */}
      <div className="w-[179px] px-[16px] shrink-0">
        <div className="h-[14px] w-[80px] rounded bg-fill-card1" />
      </div>
      {/* Actions skeleton */}
      <div className="flex-1 flex justify-end pr-[16px]">
        <div className="h-[36px] w-[100px] rounded-8 bg-fill-card1" />
      </div>
    </div>
  );
}

/** Skeleton card for H5 */
function H5SkeletonCard() {
  return (
    <div className="bg-fill-card1 rounded-16 px-[16px] py-[24px] flex flex-col gap-[24px] animate-pulse">
      <div className="flex gap-[8px] items-center">
        <div className="size-[32px] rounded-full bg-secondary/20 shrink-0" />
        <div className="flex flex-col gap-[4px] flex-1">
          <div className="h-[14px] w-[60%] rounded bg-secondary/20" />
          <div className="h-[12px] w-[40%] rounded bg-secondary/20" />
        </div>
      </div>
      <div className="flex flex-col gap-[8px]">
        <div className="h-[19px] rounded bg-secondary/20" />
        <div className="h-[19px] rounded bg-secondary/20" />
        <div className="h-[19px] rounded bg-secondary/20" />
      </div>
      <div className="h-[44px] rounded-12 bg-secondary/20" />
    </div>
  );
}

export default function BorrowTab() {
  const t = useTranslations("lending");
  const mode = useResponsiveMode();
  const isH5 = mode === "h5";

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["lending", "positions"],
    queryFn: getLendingPositions,
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<CollateralPosition | null>(null);

  const handleBorrow = (positionId: string) => {
    const pos = positions.find((p) => p.id === positionId);
    if (!pos) return;
    setSelectedPosition(pos);
    setDrawerOpen(true);
  };

  // H5 card layout
  if (isH5) {
    if (isLoading) {
      return (
        <div className="w-full flex flex-col gap-[16px]">
          <H5SkeletonCard />
          <H5SkeletonCard />
          <H5SkeletonCard />
        </div>
      );
    }
    if (positions.length === 0) {
      return (
        <div className="flex items-center justify-center py-[60px]">
          <p className="text-[14px] text-tertiary">{t("noPositions")}</p>
        </div>
      );
    }
    return (
      <>
        <div className="w-full flex flex-col gap-[16px] pb-[env(safe-area-inset-bottom)]">
          {positions.map((position) => (
            <H5BorrowCard key={position.id} position={position} onBorrow={handleBorrow} />
          ))}
        </div>
        {selectedPosition && (
          <BorrowDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            position={selectedPosition}
          />
        )}
      </>
    );
  }

  // PC table layout
  return (
    <>
      <div className="w-full border border-secondary rounded-16 overflow-x-auto">
        <div className="min-w-[1200px]">
          {/* Table header */}
          <div className="flex items-center h-[72px] border-b border-secondary">
            <div className="w-[380px] px-[16px] shrink-0">
              <span className="text-[14px] text-secondary font-normal">{t("colMatch")}</span>
            </div>
            <div className="w-[240px] px-[16px] shrink-0">
              <span className="text-[14px] text-secondary font-normal">{t("colPrincipal")}</span>
            </div>
            <div className="w-[240px] px-[16px] shrink-0">
              <span className="text-[14px] text-secondary font-normal">{t("colReturn")}</span>
            </div>
            <div className="w-[240px] px-[16px] shrink-0">
              <span className="text-[14px] text-secondary font-normal">{t("colCreditLimit")}</span>
            </div>
            <div className="flex-1 px-[16px] flex justify-end">
              <span className="text-[14px] text-secondary font-normal">{t("colActions")}</span>
            </div>
          </div>

          {/* Table body */}
          {isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : positions.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-[14px] text-secondary">
              {t("noPositions")}
            </div>
          ) : (
            positions.map((position) => (
              <BorrowPositionRow key={position.id} position={position} onBorrow={handleBorrow} />
            ))
          )}
        </div>
      </div>
      {selectedPosition && (
        <BorrowDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          position={selectedPosition}
        />
      )}
    </>
  );
}
