export function PortfolioSkeleton() {
  return (
    <div className="w-full max-w-[1200px] mx-auto px-[16px] lg:px-[24px] py-[24px] lg:py-[32px] flex flex-col gap-[24px] lg:gap-[32px]">
      <div className="h-[44px] w-full lg:w-[360px] rounded-full bg-white/10 animate-pulse" />
      <div className="h-[220px] lg:h-[280px] rounded-16 bg-white/10 animate-pulse" />
      <div className="h-[22px] w-[140px] rounded bg-white/10 animate-pulse" />
      <div className="flex flex-col gap-[12px] lg:gap-[16px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[72px] rounded-8 bg-white/10 animate-pulse" />
        ))}
      </div>
      <div className="h-[22px] w-[120px] rounded bg-white/10 animate-pulse" />
      <div className="flex flex-col gap-[12px] lg:gap-[16px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[72px] rounded-8 bg-white/10 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function PortfolioLoading() {
  return <PortfolioSkeleton />;
}
