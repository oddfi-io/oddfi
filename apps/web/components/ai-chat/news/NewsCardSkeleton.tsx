"use client";

/**
 * DD-110 — 推送卡骨架。
 * 结构镜像 NewsCard.tsx 的真实布局（header / tag / title / match / 正文 / AI 块 / source link），
 * 使首屏与加载到真实卡之间不出现 ~130px 高度跳变。
 */
export function NewsCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-fill-card1 p-3">
      {/* Header: source + 时间 */}
      <div className="flex items-center justify-between gap-2">
        <div className="h-4 w-28 animate-pulse rounded bg-fill-card2" />
        <div className="h-3.5 w-10 animate-pulse rounded bg-fill-card2" />
      </div>

      {/* Tag chip */}
      <div className="h-[18px] w-14 animate-pulse rounded-md bg-fill-card2" />

      {/* Title (≤ 20 字) */}
      <div className="h-5 w-3/4 animate-pulse rounded bg-fill-card2" />

      {/* Match line */}
      <div className="h-3.5 w-1/2 animate-pulse rounded bg-fill-card2" />

      {/* Original text — 2 行 */}
      <div className="flex flex-col gap-1.5">
        <div className="h-[14px] w-full animate-pulse rounded bg-fill-card2" />
        <div className="h-[14px] w-5/6 animate-pulse rounded bg-fill-card2" />
      </div>

      {/* AI 解读块 */}
      <div className="flex flex-col gap-1.5 rounded-lg bg-fill-card2 p-2.5">
        <div className="h-3.5 w-16 animate-pulse rounded bg-fill-card1" />
        <div className="h-4 w-full animate-pulse rounded bg-fill-card1" />
        <div className="flex gap-3">
          <div className="h-3.5 w-16 animate-pulse rounded bg-fill-card1" />
          <div className="h-3.5 w-16 animate-pulse rounded bg-fill-card1" />
        </div>
      </div>

      {/* Source link */}
      <div className="h-3.5 w-20 animate-pulse rounded bg-fill-card2" />
    </div>
  );
}
