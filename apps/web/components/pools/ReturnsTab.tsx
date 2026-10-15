"use client";

import ReturnStatsCards from "./ReturnStatsCards";
import ReturnTable from "./ReturnTable";

export default function ReturnsTab() {
  return (
    <div className="flex flex-col gap-[36px] lg:gap-[24px]">
      <ReturnStatsCards />
      <ReturnTable />
    </div>
  );
}
