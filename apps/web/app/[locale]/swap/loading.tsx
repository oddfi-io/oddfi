export default function SwapLoading() {
  return (
    <div className="min-h-screen bg-primary px-4 py-6 pb-[env(safe-area-inset-bottom)] lg:px-6 lg:py-8">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[16px] lg:grid lg:grid-cols-[minmax(0,1fr)_520px] lg:gap-6">
        {/* Left column: Chart + Overview (order-2 on mobile) */}
        <div className="order-2 flex flex-col gap-[24px] lg:order-1 lg:gap-6">
          {/* Chart card */}
          <div className="flex flex-col gap-[24px] rounded-16 bg-fill-card1 p-[16px] lg:p-[32px]">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-[8px]">
                <div className="flex items-center gap-[8px]">
                  <div className="size-[24px] lg:size-[36px] rounded-full bg-white/10 animate-pulse" />
                  <div className="h-[20px] lg:h-[28px] w-[48px] rounded bg-white/10 animate-pulse" />
                </div>
                <div className="flex items-center gap-[8px]">
                  <div className="h-[28px] lg:h-[32px] w-[120px] rounded bg-white/10 animate-pulse" />
                  <div className="h-[20px] w-[64px] rounded bg-white/10 animate-pulse" />
                </div>
              </div>
              <div className="hidden lg:flex items-center gap-[8px]">
                <div className="h-[36px] w-[48px] rounded-full bg-white/10 animate-pulse" />
                <div className="h-[36px] w-[160px] rounded-full bg-white/10 animate-pulse" />
              </div>
            </div>
            <div className="w-full h-[300px] rounded-8 bg-white/10 animate-pulse" />
          </div>

          {/* Overview card */}
          <div className="rounded-16 border border-secondary bg-fill-card1 h-[180px] animate-pulse" />
        </div>

        {/* Right column: Swap card (order-1 on mobile) */}
        <div className="order-1 flex flex-col gap-[24px] lg:order-2 lg:gap-6">
          <div className="rounded-16 bg-fill-card1 p-[16px] lg:p-[24px] flex flex-col gap-[16px]">
            <div className="flex items-center justify-between">
              <div className="h-[22px] w-[60px] rounded bg-white/10 animate-pulse" />
              <div className="h-[32px] w-[80px] rounded-full bg-white/10 animate-pulse" />
            </div>
            <div className="h-[88px] rounded-12 bg-white/10 animate-pulse" />
            <div className="flex justify-center">
              <div className="h-[32px] w-[32px] rounded-full bg-white/10 animate-pulse" />
            </div>
            <div className="h-[88px] rounded-12 bg-white/10 animate-pulse" />
            <div className="h-[48px] rounded-full bg-white/10 animate-pulse" />
          </div>

          {/* Welcome banner — desktop only */}
          <div className="hidden lg:block rounded-16 bg-fill-card1 h-[250px] animate-pulse" />
        </div>
      </div>
    </div>
  );
}
