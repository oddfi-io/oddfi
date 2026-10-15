export function LiquiditySkeleton() {
  return (
    <div className="min-h-screen bg-primary">
      <div className="mx-auto w-full max-w-[1200px] px-[16px] lg:px-0 pt-[40px] lg:pt-[64px] pb-[48px]">
        <div className="h-[36px] lg:h-[40px] w-[200px] lg:w-[260px] rounded bg-white/10 animate-pulse mb-[8px]" />
        <div className="h-[19px] w-[280px] rounded bg-white/10 animate-pulse mb-[32px]" />
        <div className="h-[44px] w-[280px] rounded-full bg-white/10 animate-pulse mb-[32px]" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[12px] lg:gap-[16px] mb-[32px]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[80px] rounded-16 bg-white/10 animate-pulse" />
          ))}
        </div>
        <div className="flex flex-col gap-[12px] lg:gap-[16px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[88px] rounded-16 bg-white/10 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LiquidityLoading() {
  return <LiquiditySkeleton />;
}
