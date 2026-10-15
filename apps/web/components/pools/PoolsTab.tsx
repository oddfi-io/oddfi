"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import PoolVaultCard from "./PoolVaultCard";
import PoolMarketTable from "./PoolMarketTable";
import PoolDepositModal from "./PoolDepositModal";
import PoolMatchDepositModal from "./PoolMatchDepositModal";
import type { LpMatchPoolData } from "@/hooks/useLiquidityFeaturedPools";

export default function PoolsTab() {
  const t = useTranslations("pools");
  const [globalDepositOpen, setGlobalDepositOpen] = useState(false);
  const [selectedMatchPool, setSelectedMatchPool] = useState<LpMatchPoolData | null>(null);

  return (
    <div>
      {/* Section header — All Match Pools (global pool) */}
      <div className="mb-[16px]">
        <h2 className="font-orbitron text-[24px] font-bold text-primary leading-[32px]">
          {t("allPoolsTitle")}
        </h2>
        <p className="text-[14px] text-secondary mt-[4px] leading-[19px]">
          {t("allPoolsSubtitle")}
        </p>
      </div>

      <PoolVaultCard onDeposit={() => setGlobalDepositOpen(true)} />
      <PoolMarketTable onDeposit={(pool) => setSelectedMatchPool(pool)} />

      <PoolDepositModal isOpen={globalDepositOpen} onClose={() => setGlobalDepositOpen(false)} />
      <PoolMatchDepositModal
        isOpen={selectedMatchPool !== null}
        onClose={() => setSelectedMatchPool(null)}
        pool={selectedMatchPool}
      />
    </div>
  );
}
