"use client";

import { useState } from "react";
import PositionStatsCards from "./PositionStatsCards";
import PositionTable from "./PositionTable";
import WithdrawLpModal from "./WithdrawLpModal";
import type { LpPositionData } from "@/hooks/useLpPositions";

export default function PositionsTab() {
  const [selectedPosition, setSelectedPosition] = useState<LpPositionData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleAction = (position: LpPositionData) => {
    setSelectedPosition(position);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setSelectedPosition(null);
  };

  return (
    <div className="flex flex-col gap-[24px] lg:gap-[40px]">
      <PositionStatsCards />
      <PositionTable onAction={handleAction} />
      <WithdrawLpModal isOpen={modalOpen} onClose={handleClose} position={selectedPosition} />
    </div>
  );
}
