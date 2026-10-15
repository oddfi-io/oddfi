export default function ReferralLoading() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-16">
      {/* Hero section */}
      <div className="relative h-[280px] lg:h-[360px] rounded-24 overflow-hidden bg-white/10 animate-pulse mb-8" />

      <div className="relative mt-5 lg:mt-5">
        {/* Desktop: left content + right panel */}
        <div className="lg:flex lg:gap-12 lg:p-8">
          <div className="flex-1 min-w-0 flex flex-col gap-[24px]">
            {/* Stats cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-[12px] lg:gap-[16px]">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-[88px] rounded-16 bg-white/10 animate-pulse" />
              ))}
            </div>
            {/* Table header */}
            <div className="h-[44px] rounded-8 bg-white/10 animate-pulse" />
            {/* Table rows */}
            <div className="flex flex-col gap-[8px]">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-[56px] rounded-8 bg-white/10 animate-pulse" />
              ))}
            </div>
          </div>

          {/* Right invite panel — desktop only */}
          <div className="hidden lg:block w-[432px] shrink-0">
            <div className="h-[320px] rounded-24 bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
