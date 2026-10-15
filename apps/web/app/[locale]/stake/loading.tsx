export function StakeSkeleton() {
  return (
    <div className="bg-primary min-h-screen">
      <div className="mx-auto max-w-[1200px] flex flex-col items-center px-[16px] pt-[48px] md:pt-[60px] pb-[48px]">
        <div className="h-[36px] w-[260px] md:w-[320px] rounded bg-white/10 animate-pulse mb-[8px]" />
        <div className="h-[19px] w-[200px] rounded bg-white/10 animate-pulse mb-[28px]" />
        <div className="w-full h-[44px] md:w-[540px] md:h-[48px] rounded-full bg-white/10 animate-pulse mb-[20px]" />
        <div className="w-full md:w-[540px] bg-fill-card1 rounded-16 p-[24px] md:p-[32px] flex flex-col gap-[20px]">
          <div className="h-[19px] w-[120px] rounded bg-white/10 animate-pulse" />
          <div className="h-[56px] rounded-12 bg-white/10 animate-pulse" />
          <div className="h-[56px] rounded-12 bg-white/10 animate-pulse" />
          <div className="grid grid-cols-2 gap-[12px]">
            <div className="h-[56px] rounded-12 bg-white/10 animate-pulse" />
            <div className="h-[56px] rounded-12 bg-white/10 animate-pulse" />
          </div>
          <div className="h-[48px] rounded-full bg-white/10 animate-pulse" />
        </div>
        <div className="w-full md:w-[540px] mt-[20px] grid grid-cols-3 gap-[12px]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[72px] rounded-12 bg-white/10 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StakeLoading() {
  return <StakeSkeleton />;
}
