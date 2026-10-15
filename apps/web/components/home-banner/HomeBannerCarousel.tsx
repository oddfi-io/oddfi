"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { useMarketBanners } from "@/hooks/useMarketBanners";
import PromoBannerCard from "./PromoBannerCard";
import BannerIndicator from "./parts/BannerIndicator";
import HomeBannerSkeleton from "./HomeBannerSkeleton";

const CARD_WIDTH = 388; // 372 卡宽 + 16 gap（DD-143 Figma 8487:133843 步距实测）
const AUTO_SCROLL_INTERVAL = 2000;
const ANIM_DURATION = 600; // 单步过渡时长 ms
const SCHEDULE_DELAY = Math.max(0, AUTO_SCROLL_INTERVAL - ANIM_DURATION);
const DRAG_THRESHOLD = 8; // 横纵方向锁阈值 px

/**
 * 计算严格小于 `from` 的最近卡片左边缘 offset（向左找下一个卡片起点）。
 * - from 正好对齐边缘（e.g. -1680）→ 返回 -2016（再向左一卡）
 * - from 在两边缘之间（e.g. -1880）→ 返回 -2016（仅滚到下一边缘，距离 < CARD_WIDTH）
 * 这样手势拖到非对齐位置后，下一次 tick 能自动 snap 到卡片边缘。
 *
 * 仅供测试导入；运行时仅 tick 内部使用。
 */
export function nextLeftCardBoundary(from: number, cardWidth: number = CARD_WIDTH): number {
  return (Math.ceil(from / cardWidth) - 1) * cardWidth;
}

/**
 * 由 translateX offset 推导当前领先卡的逻辑 index（0..n-1）。
 * 对 n 取模是关键：tick 归一瞬移 offset ±sectionWidth(=n*cardWidth) 不改变模 n 结果，
 * 故归一**不会让 indicator 闪**。round 处理拖动到非对齐位置时就近取卡。
 * 仅供测试导入；运行时仅 Carousel 内部使用。
 */
export function offsetToActiveIndex(offset: number, cardWidth: number, n: number): number {
  if (n <= 0) return 0;
  return ((Math.round(-offset / cardWidth) % n) + n) % n;
}

/**
 * 首页 Banner 横向无限自动轮播（DD-084，Figma 3231:46620）
 *
 * 链式调度：每次 anim.finished 完成后 commitStyles + cancel 释放 fill 占用，
 * 再 setTimeout 调度下一次。避免 setInterval 与 anim 节奏竞态。
 *
 * - 三段克隆 [banners, banners, banners]，初始定位中段
 * - 每次 tick：WAAPI animate translateX，await finished → commitStyles → cancel → 更新 offset → 归一 → 调度下次
 * - hover：标记暂停 + 暂停进行中 anim + 清调度 timer；离开：play() 续播或重启调度
 * - touch：横向拖动跟手，松手 snap 到最近卡片左边缘，恢复自动播放从该边缘起步
 * - touch-action: pan-y 让浏览器接管纵向页面滚动，仅横向走我们的逻辑
 */
export default function HomeBannerCarousel() {
  const { data, isLoading, isError } = useMarketBanners();
  // useMemo 防止 `data ?? []` 每次 render 创建新数组导致下游 useMemo 失效
  const banners = useMemo(() => data ?? [], [data]);
  // indicator 当前领先卡 index（同值 setState 被 React bail，touch move 高频调用天然节流）
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0); // 当前 translateX 像素偏移（向左为负）
  const animRef = useRef<Animation | null>(null);
  const scheduleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPausedRef = useRef(false);
  const isUnmountedRef = useRef(false);
  // touch 拖动状态
  const isTouchActiveRef = useRef(false); // touchstart 已触发但未 end
  const dragCommittedRef = useRef(false); // 已确认为横向拖动（方向锁通过）
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragStartOffsetRef = useRef(0); // commit 时的 offsetRef 快照
  const liveOffsetRef = useRef(0); // 拖动期间的实时 offset

  const tripled = useMemo(
    () => (banners.length > 0 ? [...banners, ...banners, ...banners] : []),
    [banners]
  );
  const sectionWidth = useMemo(() => banners.length * CARD_WIDTH, [banners.length]);

  const clearSchedule = useCallback(() => {
    if (scheduleTimerRef.current !== null) {
      clearTimeout(scheduleTimerRef.current);
      scheduleTimerRef.current = null;
    }
  }, []);

  // 单次滚动：等动画结束 → commitStyles + cancel → 更新 offset → 归一 → 调度下次
  const tick = useCallback(async () => {
    const track = trackRef.current;
    if (isUnmountedRef.current || isPausedRef.current || sectionWidth === 0 || !track) return;

    const from = offsetRef.current;
    // 滚到比当前严格小的下一个卡片左边缘：对齐时等价于 from - CARD_WIDTH；
    // 未对齐（手势刚拖出）时距离 < CARD_WIDTH，自然 snap 回卡片边缘。
    const to = nextLeftCardBoundary(from);
    // indicator 在动画启动时即更新到目标卡（领先 600ms 位移，营造"前进感"），非等 finished
    setActiveIndex(offsetToActiveIndex(to, CARD_WIDTH, banners.length));
    const anim = track.animate(
      [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }],
      { duration: ANIM_DURATION, easing: "ease-in-out", fill: "forwards" }
    );
    animRef.current = anim;

    try {
      await anim.finished;
    } catch {
      // anim 被 cancel（unmount / 主动取消）→ 退出，不再调度
      return;
    }

    if (isUnmountedRef.current) return;

    // commitStyles 把当前 transform 写回 inline style，再 cancel 释放 fill 占用
    // 之后 inline style 接管，避免 Animation 对象被 fill: "forwards" 永久持有 (C2)
    try {
      anim.commitStyles();
    } catch {
      // commitStyles 在元素从 DOM 移除等场景会抛错，回退到手动 inline
      track.style.transform = `translateX(${to}px)`;
    }
    anim.cancel();
    if (animRef.current === anim) animRef.current = null;

    // 动画完成后才更新 offset，避免 hover pause+play 用陈值计算下一帧 (C4)
    offsetRef.current = to;

    // 越过第三段起点 → 瞬时归一回中段（用户无感）
    if (offsetRef.current <= -2 * sectionWidth) {
      offsetRef.current += sectionWidth;
      track.style.transform = `translateX(${offsetRef.current}px)`;
    }

    // 调度下一次（hover 期间不调度）
    if (isPausedRef.current || isUnmountedRef.current) return;
    scheduleTimerRef.current = setTimeout(tick, SCHEDULE_DELAY);
  }, [sectionWidth, banners.length]);

  // 初始定位中段 + 启动调度。仅当无进行中动画时才重置位置（M5：refetch 不打断动画）
  useEffect(() => {
    isUnmountedRef.current = false;
    const track = trackRef.current;
    if (!track || sectionWidth === 0) return;

    if (animRef.current === null) {
      offsetRef.current = -sectionWidth;
      track.style.transform = `translateX(${offsetRef.current}px)`;
    }

    if (banners.length > 1 && !isPausedRef.current) {
      scheduleTimerRef.current = setTimeout(tick, SCHEDULE_DELAY);
    }

    return () => {
      isUnmountedRef.current = true;
      clearSchedule();
      if (animRef.current) {
        animRef.current.cancel();
        animRef.current = null;
      }
    };
  }, [sectionWidth, banners.length, tick, clearSchedule]);

  const handleMouseEnter = useCallback(() => {
    isPausedRef.current = true;
    clearSchedule();
    if (animRef.current && animRef.current.playState === "running") {
      animRef.current.pause();
    }
  }, [clearSchedule]);

  const handleMouseLeave = useCallback(() => {
    isPausedRef.current = false;
    if (animRef.current && animRef.current.playState === "paused") {
      animRef.current.play(); // 续播 → 完成后 tick 内自然 schedule 下一次
    } else if (!animRef.current) {
      scheduleTimerRef.current = setTimeout(tick, SCHEDULE_DELAY);
    }
  }, [tick]);

  // 取消进行中动画并把当前可视位置写回 offsetRef + inline transform
  const cancelAnimAtCurrent = useCallback(() => {
    const anim = animRef.current;
    const track = trackRef.current;
    if (!track) return;
    if (anim) {
      try {
        anim.commitStyles();
      } catch {
        track.style.transform = `translateX(${offsetRef.current}px)`;
      }
      anim.cancel();
      animRef.current = null;
    }
    const m = track.style.transform.match(/translateX\((-?[\d.]+)px\)/);
    if (m) offsetRef.current = parseFloat(m[1]);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1 || sectionWidth === 0) return;
      isTouchActiveRef.current = true;
      dragCommittedRef.current = false;
      dragStartXRef.current = e.touches[0].clientX;
      dragStartYRef.current = e.touches[0].clientY;
    },
    [sectionWidth]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isTouchActiveRef.current || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - dragStartXRef.current;
      const dy = t.clientY - dragStartYRef.current;

      if (!dragCommittedRef.current) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          // 纵向占优 → 让浏览器处理页面滚动，本次 touch 序列不再跟踪
          isTouchActiveRef.current = false;
          return;
        }
        // 锁定为横向拖动
        dragCommittedRef.current = true;
        isPausedRef.current = true;
        clearSchedule();
        cancelAnimAtCurrent();
        dragStartOffsetRef.current = offsetRef.current;
      }

      const track = trackRef.current;
      if (!track) return;
      const newOffset = dragStartOffsetRef.current + dx;
      liveOffsetRef.current = newOffset;
      track.style.transform = `translateX(${newOffset}px)`;
      // indicator 跟手：同值 setState 被 React bail，仅跨卡边界时真正 re-render
      setActiveIndex(offsetToActiveIndex(newOffset, CARD_WIDTH, banners.length));
    },
    [cancelAnimAtCurrent, clearSchedule, banners.length]
  );

  // 松手：保持当前拖动位置（不立即 snap），仅做 wrap 归一化，5s 后由下一次 tick
  // 自然滑到最近的卡片左边缘（nextLeftCardBoundary 兜底）。
  const finalizeTouch = useCallback(() => {
    if (!isTouchActiveRef.current) return;
    const wasCommitted = dragCommittedRef.current;
    isTouchActiveRef.current = false;
    dragCommittedRef.current = false;
    if (!wasCommitted) return;

    const track = trackRef.current;
    if (!track || sectionWidth === 0) return;

    let raw = liveOffsetRef.current;
    // 归一到 (-2*sectionWidth, 0]，防止长时间拖动导致 offset 越界（视觉等价）
    while (raw <= -2 * sectionWidth) raw += sectionWidth;
    while (raw > 0) raw -= sectionWidth;

    track.style.transform = `translateX(${raw}px)`;
    offsetRef.current = raw;
    // 落定后兜底同步 indicator（拖动末位置对应卡）
    setActiveIndex(offsetToActiveIndex(raw, CARD_WIDTH, banners.length));

    isPausedRef.current = false;
    // 5s 静默后再触发 tick：tick 内部会 snap 到下一个卡片边缘，整体动画收尾在 5s + ANIM_DURATION
    scheduleTimerRef.current = setTimeout(tick, AUTO_SCROLL_INTERVAL);
  }, [sectionWidth, tick, banners.length]);

  if (isLoading) return <HomeBannerSkeleton />;
  if (isError || banners.length === 0) return null;

  return (
    <div
      className="overflow-hidden isolate touch-pan-y"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={finalizeTouch}
      onTouchCancel={finalizeTouch}
    >
      {/* 插画出框裁剪层：py-8=上下各 32px，让球员/奖杯头部上探、脚部下探都能出框
         （用户要求底部也溢出，偏离 Figma 8487:133843 的下裁齐卡底）；
         横向 overflow-hidden 裁到视窗边维持无限滚动。indicator 在此层之外（下方），不被裁也不被脚部遮挡。 */}
      <div className="overflow-hidden py-8">
        <div ref={trackRef} className="flex gap-4 will-change-transform">
          {tripled.map((b, i) => (
            <PromoBannerCard
              key={`${b.banner_id}-${i}`}
              data={b}
              priority={i % banners.length < 4}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex justify-center">
        <BannerIndicator count={banners.length} activeIndex={activeIndex} />
      </div>
    </div>
  );
}
