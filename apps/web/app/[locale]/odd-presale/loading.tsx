export function OddPresaleSkeleton() {
  return (
    <div className="min-h-screen bg-primary px-[16px] py-[48px] lg:py-[64px]">
      <div className="mx-auto max-w-[1200px] flex flex-col items-center gap-[32px]">
        <div className="flex flex-col items-center gap-[12px]">
          <div className="h-[40px] lg:h-[48px] w-[280px] lg:w-[400px] rounded bg-white/10 animate-pulse" />
          <div className="h-[19px] w-[240px] lg:w-[360px] rounded bg-white/10 animate-pulse" />
        </div>
        <div className="w-full lg:w-[640px] rounded-24 bg-white/10 animate-pulse h-[320px]" />
        <div className="w-full flex flex-col gap-[20px]">
          <div className="h-[28px] w-[200px] rounded bg-white/10 animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
            <div className="h-[280px] rounded-16 bg-white/10 animate-pulse" />
            <div className="flex flex-col gap-[12px]">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[48px] rounded-12 bg-white/10 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
        <div className="w-full flex flex-col gap-[16px]">
          <div className="h-[28px] w-[220px] rounded bg-white/10 animate-pulse" />
          <div className="h-[200px] rounded-16 bg-white/10 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function OddPresaleLoading() {
  return <OddPresaleSkeleton />;
}
