"use client";

/**
 * LiveStreamSection — DD-126 直播卡片装配（Figma 6123:94111）。
 *
 * 放置：详情页 Moneyline 趋势面板下方（PC 右栏 / H5 左栏对决卡片下，由 FixtureDetailClient 分流）。
 *
 * 三态（hook stream_status 驱动）：
 *   - available   → StreamSourceTabs（≥2 源）+ StreamPlayer，默认 streams[0]
 *   - pending     → StreamStatusFallback「直播即将开始」+ 轮询（hook 内）
 *   - unavailable / isError / 全源加载失败 → 整块不渲染（返回 null）
 *
 * 源失败容错：当前 iframe load 失败 → 切下一条；全部失败 → 不渲染。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CaretUpIcon } from "@phosphor-icons/react";
import { useFixtureStreams } from "@/hooks/useFixtureStreams";
import StreamPlayer from "./StreamPlayer";
import StreamSourceTabs from "./StreamSourceTabs";
import StreamStatusFallback from "./StreamStatusFallback";

interface Props {
  fixtureId: number;
  /** 比赛开赛时间戳（秒）；用于 pending 轮询的开赛前 5min 窗口 */
  startingAtTimestamp?: number | null;
  /** 关闭数据拉取（默认开）；预留给可见性懒加载 */
  enabled?: boolean;
}

export default function LiveStreamSection({ fixtureId, startingAtTimestamp, enabled }: Props) {
  const t = useTranslations("markets");
  const { status, streams, isLoading, isError } = useFixtureStreams(fixtureId, {
    enabled,
    startingAtTimestamp,
  });

  // 折叠态：用户手动操作前跟随 status —— available 默认展开，pending（未开赛/未拿到流）
  // 默认折叠不抢占视觉；pending 轮询切到 available 时自动展开。手动操作后以用户为准。
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? status === "available";
  const [activeIndex, setActiveIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  // 流集合变化（切赛事 / 新数据）→ 重置选中与失败状态
  const streamKey = useMemo(() => streams.map((s) => s.embed_url).join("|"), [streams]);
  useEffect(() => {
    setActiveIndex(0);
    setExhausted(false);
  }, [streamKey]);

  // 用 ref 持有最新 streams 长度：让 handleError 保持稳定引用（依赖 []），
  // 既避免 pending→available 轮询切换瞬间的闭包过时，也避免 StreamPlayer 的
  // onError effect 因 handleError 每次变更而反复 re-subscribe。
  const streamCountRef = useRef(streams.length);
  streamCountRef.current = streams.length;

  // 当前源加载失败 → 切下一条；无下一条 → 全部失败
  const handleError = useCallback(() => {
    setActiveIndex((prev) => {
      const next = prev + 1;
      if (next >= streamCountRef.current) {
        setExhausted(true);
        return prev;
      }
      return next;
    });
  }, []);

  // 不渲染整块：首屏加载中 / 出错 / unavailable / 全源失败
  if (isLoading || isError) return null;
  if (status === "unavailable" || status == null) return null;

  const activeStream = streams[activeIndex];
  const canPlay = status === "available" && !!activeStream && !exhausted;
  // available 但全源失败 → 不渲染（不退回 pending 占位，避免误导）
  if (status === "available" && (exhausted || !activeStream)) return null;

  return (
    <div className="flex flex-col overflow-hidden rounded-16" data-figma-node="6123:94111">
      {/* Header：参考亚洲让球卡片（MatchBettingMarkets 的 MarketSection）样式 —— bg-secondary 头 + 粗体 title + 折叠 */}
      <button
        type="button"
        onClick={() => setManualOpen(!open)}
        aria-expanded={open}
        aria-label={t("liveStream.title")}
        style={{ touchAction: "manipulation" }}
        className="bg-secondary flex h-[48px] w-full min-h-[44px] items-center justify-between px-[16px]"
      >
        <span className="text-[16px] font-bold leading-[24px] text-primary">
          {t("liveStream.title")}
        </span>
        <div className="flex size-[24px] items-center justify-center rounded-8 bg-fill-input-modal">
          <CaretUpIcon
            size={18}
            className={`text-primary transition-transform duration-200 ${open ? "" : "rotate-180"}`}
          />
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-[8px] bg-secondary px-[16px] pb-[16px] pt-[8px]">
          {canPlay ? (
            <>
              <StreamSourceTabs
                streams={streams}
                activeIndex={activeIndex}
                onSelect={setActiveIndex}
                sourceFallbackLabel={t("liveStream.sourceFallback")}
              />
              <StreamPlayer
                embedUrl={activeStream.embed_url}
                liveLabel={t("liveStream.live")}
                disclaimer={{
                  title: t("liveStream.disclaimerTitle"),
                  body: t("liveStream.disclaimerBody"),
                  confirm: t("liveStream.disclaimerConfirm"),
                }}
                onError={handleError}
              />
              <p className="text-[12px] leading-[18px] text-tertiary">
                {t("liveStream.thirdPartyNotice")}
              </p>
            </>
          ) : (
            // status === 'pending'
            <StreamStatusFallback message={t("liveStream.startingSoon")} />
          )}
        </div>
      )}
    </div>
  );
}
