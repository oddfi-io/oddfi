import { memo } from "react";
import Skeleton from "@/components/ui/Skeleton";

function PortfolioSummarySkeleton() {
  return (
    <div className="flex flex-col gap-[16px] lg:gap-[24px]">
      {/* PC */}
      <div className="hidden lg:flex flex-col gap-[24px]">
        <Skeleton className="h-[330px] w-full rounded-16" />
        <Skeleton className="h-[120px] w-full rounded-16" />
      </div>
      {/* H5 */}
      <div className="flex lg:hidden flex-col gap-[16px]">
        <Skeleton className="h-[180px] w-full rounded-16" />
        <Skeleton className="h-[174px] w-full rounded-16" />
      </div>
    </div>
  );
}

export default memo(PortfolioSummarySkeleton);
