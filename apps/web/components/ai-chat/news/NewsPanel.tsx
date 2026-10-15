"use client";

/**
 * DD-110 §3 — News tab body 容器（feed 由 AiChatModal 顶层 useNewsFeed 单例传入，
 * 防止 SSE 双连接）。
 *
 * 几个非常见决策的 WHY：
 * - `[overflow-anchor:none]`：SSE prepend `card.new` 会让浏览器 scroll-anchor 跟着新
 *   锚点下移，造成 scrollTop 漂底；关掉后保持用户位置。
 * - `loadMoreRef`：loadMore 引用随 status 变化 → 若进 observer effect deps 会反复
 *   recreate observer + 立即重评雪崩。用 ref 让 observer 只在 hasMore / 列表挂载状态
 *   切换时重建。
 * - observer effect deps `[hasMore, hasCards]`：首屏 cards=[] 走早返回分支时 sentinel
 *   未挂载，effect early-return；待 cards 到来 hasCards 切 true 触发重跑创建 observer。
 */
import { useCallback, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { NewsCard } from "./NewsCard";
import { NewsCardSkeleton } from "./NewsCardSkeleton";
import type { UseNewsFeedResult } from "@/hooks/useNewsFeed";
import { useUclWcFixtures } from "@/hooks/useUclWcFixtures";
import { resolveFixtureByText } from "@/lib/news-fixture-match";

interface NewsPanelProps {
  feed: UseNewsFeedResult;
  /**
   * H5 悬浮玻璃 header 让位（DD-135 · Figma 7973:127858）：header 以 absolute 浮在本面板上方，
   * padding 加在滚动容器内部（header 40px），新闻卡滚动时从玻璃按钮背后穿过。PC 不传。
   */
  topInset?: boolean;
}

const ESTIMATE_CARD_HEIGHT = 280;
const ITEM_GAP = 8;

export function NewsPanel({ feed, topInset = false }: NewsPanelProps) {
  const scrollParentRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const {
    hasMore,
    loadMore,
    markAllRead,
    cards,
    isConfigured,
    status,
    errorMessage,
    retryAfterSec,
    retry,
    sseStatus,
    truncated,
  } = feed;
  const hasCards = cards.length > 0;

  // DD-120：扫新闻英文 originalText 命中我方 WC/欧冠赛事 → 卡内嵌推荐下注卡。
  // 队名经 short_code 桥接英文（dev 后端只返中文，见 lib/team-name-aliases），故无需强制英文拉取。
  const { fixtures: matchableFixtures } = useUclWcFixtures();
  const resolveFixture = useCallback(
    (text: string) => resolveFixtureByText(text, matchableFixtures),
    [matchableFixtures]
  );

  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  useEffect(() => {
    if (!hasMore || !hasCards) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) void loadMoreRef.current();
        }
      },
      { root: scrollParentRef.current, rootMargin: "200px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, hasCards]);

  const virtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => ESTIMATE_CARD_HEIGHT + ITEM_GAP,
    overscan: 5,
    getItemKey: (index) => cards[index]?.id ?? index,
  });

  if (!isConfigured) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8 text-center text-[12px] leading-[16px] text-tertiary">
        新闻服务未配置（NEXT_PUBLIC_NEWS_API_BASE_URL）
      </div>
    );
  }

  if (status === "loading" && !hasCards) {
    return (
      <div
        className={`flex flex-1 flex-col gap-2 overflow-y-auto [overflow-anchor:none] ${topInset ? "px-3 pb-3 pt-[52px]" : "p-3"}`}
      >
        <NewsCardSkeleton />
        <NewsCardSkeleton />
        <NewsCardSkeleton />
      </div>
    );
  }

  // retryAfterSec 时不显 Retry 按钮，让用户等倒计时
  if (status === "error" && !hasCards) {
    const isRateLimited = retryAfterSec !== undefined;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <p className="text-[12px] leading-[16px] text-secondary">
          {isRateLimited ? "请求过频" : "加载失败"}
        </p>
        {errorMessage && <p className="text-[11px] leading-[14px] text-tertiary">{errorMessage}</p>}
        {!isRateLimited && (
          <button
            type="button"
            onClick={retry}
            className="min-h-[44px] rounded-md bg-btn-tertiary px-3 py-1.5 text-[12px] font-medium text-primary transition hover:bg-fill-hover"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={scrollParentRef}
      data-scroll-content
      className={`flex flex-1 flex-col overflow-y-auto [overflow-anchor:none] ${topInset ? "pt-10" : ""}`}
    >
      {(sseStatus === "reconnecting" || sseStatus === "unstable") && (
        <div className="flex items-center justify-between gap-2 border-b border-divider bg-fill-card1 px-3 py-1.5 text-[11px] leading-[14px]">
          {sseStatus === "reconnecting" ? (
            <span className="text-secondary">Reconnecting…</span>
          ) : (
            <>
              <span className="text-red">连接不稳定，可手动刷新</span>
              <button
                type="button"
                onClick={retry}
                className="rounded bg-btn-tertiary px-2 py-0.5 text-[11px] font-medium text-primary"
              >
                Retry
              </button>
            </>
          )}
        </div>
      )}

      {!hasCards ? (
        <div className="flex flex-1 items-center justify-center py-8 text-center text-[12px] text-tertiary">
          暂无推送
        </div>
      ) : (
        <>
          {/* 顶部留白：absolute 子元素不受外层 padding 影响，用 normal-flow spacer 撑出 12px */}
          <div aria-hidden className="h-3 w-full shrink-0" />
          <div style={{ position: "relative", height: totalSize, width: "100%" }}>
            {virtualItems.map((vr) => {
              const card = cards[vr.index];
              if (!card) return null;
              return (
                <div
                  key={vr.key}
                  data-index={vr.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${vr.start}px)`,
                  }}
                >
                  {/* 单一来源：px-3 = 水平 padding 12px，pb-2 = 与下张卡 8px gap */}
                  <div className="px-3 pb-2">
                    <NewsCard card={card} resolveFixture={resolveFixture} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 翻页区：sentinel + 固定高度 loading 指示器（不再切换 skeleton 防抖动） */}
      {hasMore && cards.length > 0 && (
        <div className="px-3">
          <div ref={sentinelRef} aria-hidden className="h-px w-full" />
          <div className="flex h-7 items-center justify-center text-[11px] leading-[14px] text-tertiary">
            {status === "loading" ? "加载中…" : "上滑加载更多"}
          </div>
        </div>
      )}

      {/* 72h 回溯底部 */}
      {truncated && (
        <div className="py-2 text-center text-[11px] leading-[14px] text-tertiary">
          已展示到 3 天前
        </div>
      )}
    </div>
  );
}
