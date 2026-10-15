"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { getLendingBorrows } from "@/lib/api";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import type { ActiveBorrow } from "@/types/lending";
import RepayBorrowCard from "./RepayBorrowCard";
import H5RepayCard from "./H5RepayCard";
import RepayDrawer from "./RepayDrawer";

function RepayCardSkeleton() {
  return <div className="bg-fill-card1 rounded-16 h-[120px] animate-pulse" />;
}

function H5RepayCardSkeleton() {
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
        <div className="h-[19px] rounded bg-secondary/20" />
      </div>
      <div className="h-[44px] rounded-12 bg-secondary/20" />
    </div>
  );
}

export default function RepayTab() {
  const t = useTranslations("lending");
  const mode = useResponsiveMode();
  const isH5 = mode === "h5";

  const { data, isLoading } = useQuery({
    queryKey: ["lending", "borrows"],
    queryFn: getLendingBorrows,
  });

  const borrows = data ?? [];

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBorrow, setSelectedBorrow] = useState<ActiveBorrow | null>(null);

  const handleRepay = (borrowId: string) => {
    const b = borrows.find((item) => item.id === borrowId);
    if (!b) return;
    setSelectedBorrow(b);
    setDrawerOpen(true);
  };

  // H5 card layout
  if (isH5) {
    if (isLoading) {
      return (
        <div className="w-full flex flex-col gap-[16px]">
          <H5RepayCardSkeleton />
          <H5RepayCardSkeleton />
        </div>
      );
    }
    if (borrows.length === 0) {
      return (
        <div className="w-full flex items-center justify-center py-[60px]">
          <p className="text-[14px] text-tertiary">{t("noActiveBorrows")}</p>
        </div>
      );
    }
    return (
      <>
        <div className="w-full flex flex-col gap-[16px] pb-[env(safe-area-inset-bottom)]">
          {borrows.map((borrow) => (
            <H5RepayCard key={borrow.id} borrow={borrow} onRepay={handleRepay} />
          ))}
        </div>
        {selectedBorrow && (
          <RepayDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            borrow={selectedBorrow}
          />
        )}
      </>
    );
  }

  // PC card layout
  if (isLoading) {
    return (
      <div className="w-full overflow-x-auto">
        <div className="flex flex-col gap-[20px] min-w-[1100px]">
          <RepayCardSkeleton />
          <RepayCardSkeleton />
        </div>
      </div>
    );
  }

  if (borrows.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-[60px]">
        <p className="text-[14px] text-tertiary">{t("noActiveBorrows")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full overflow-x-auto">
        <div className="flex flex-col gap-[20px] min-w-[1100px]">
          {borrows.map((borrow) => (
            <RepayBorrowCard key={borrow.id} borrow={borrow} onRepay={handleRepay} />
          ))}
        </div>
      </div>
      {selectedBorrow && (
        <RepayDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          borrow={selectedBorrow}
        />
      )}
    </>
  );
}
