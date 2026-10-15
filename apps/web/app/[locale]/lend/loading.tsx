export function LendSkeleton() {
  return (
    <div className="flex flex-col items-center w-full pt-[48px] lg:pt-[64px] px-[16px] pb-[48px]">
      <div className="w-full max-w-[1200px] flex flex-col items-center gap-[28px]">
        <div className="flex flex-col items-center gap-[12px] w-full">
          <div className="h-[36px] lg:h-[40px] w-[240px] lg:w-[320px] rounded bg-white/10 animate-pulse" />
          <div className="h-[19px] w-[280px] lg:w-[510px] rounded bg-white/10 animate-pulse" />
        </div>
        <div className="h-[44px] w-full lg:w-[400px] rounded-full bg-white/10 animate-pulse" />
        <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-[12px] lg:gap-[16px]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[88px] rounded-16 bg-white/10 animate-pulse" />
          ))}
        </div>
        <div className="w-full mt-[8px] flex flex-col gap-[28px] lg:flex-row lg:items-start lg:gap-[32px]">
          <div className="flex-1 flex flex-col gap-[28px]">
            <div className="flex flex-col gap-[16px]">
              <div className="h-[24px] w-[140px] rounded bg-white/10 animate-pulse" />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[72px] rounded-12 bg-white/10 animate-pulse" />
              ))}
            </div>
            <div className="flex flex-col gap-[16px]">
              <div className="h-[24px] w-[140px] rounded bg-white/10 animate-pulse" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[72px] rounded-12 bg-white/10 animate-pulse" />
              ))}
            </div>
          </div>
          <div className="w-full lg:w-[343px] shrink-0 flex flex-col gap-[16px]">
            <div className="h-[200px] rounded-16 bg-white/10 animate-pulse" />
            <div className="h-[120px] rounded-16 bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LendLoading() {
  return <LendSkeleton />;
}
