"use client";

/**
 * VenueCard — Figma 5107:182841 (球场底图) + 5107:182910 (frosted overlay)
 *
 * 球场底图分层结构（自下而上）：
 *   1. 灰色基底 #696969 (236.25px)
 *   2. 右半侧线性渐变高光（白色 8% from-1/2）
 *   3. 草地 40×40 平铺 (venue-tile.png)
 *   4. 球场标线 SVG (venue-field-fill.svg)
 *   5. 装饰光斑：左/右/4 角/中心（opacity-20 暖色椭圆）
 *   6. 底部径向渐变压暗
 *
 * 真实场馆图片（venue.image_path）若存在则覆盖以上所有层。
 *
 * 居中浮层 274×158：backdrop-blur frosted glass，承载 5 个 slide 轮播。
 */

import { memo, useState } from "react";
import type { MatchOverviewDomain } from "@/types/match-detail-domain";
import VenueCarouselControls from "./VenueCarouselControls";
import SlideGoalsAndScorers from "./venue/SlideGoalsAndScorers";
import SlideVenue from "./venue/SlideVenue";
import SlideLeaguePosition from "./venue/SlideLeaguePosition";
import SlidePeriodGoals from "./venue/SlidePeriodGoals";
import SlideWinProbability from "./venue/SlideWinProbability";
import SlideKickoff from "./venue/SlideKickoff";

const SLIDE_COUNT = 6;
/** Figma 5107:182910 frosted overlay 固定尺寸 */
const OVERLAY_WIDTH = 274;
const OVERLAY_HEIGHT_DEFAULT = 158;
// compact: 容器 140 - 顶/底各 5px - 底部 24px controls = 106 视觉 → 至 scale 0.75 ≈ logical 140
const OVERLAY_HEIGHT_COMPACT = 140;
/** Figma 5107:182841 容器高度（compact 模式压缩到 140 适配市场页详情列） */
const CONTAINER_HEIGHT_DEFAULT = 236.25;
const CONTAINER_HEIGHT_COMPACT = 140;

/** DD-104 Batch 3：接 MatchOverviewDomain（整包透传给 5 Slides）。 */
interface Props {
  domain: MatchOverviewDomain;
  /** 紧凑模式：frosted overlay 缩放 0.75 以适配市场页详情列的双列布局半列宽度 */
  compact?: boolean;
}

/** 球场合成底图（无真实场馆图时使用） */
function SyntheticFieldBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
      data-figma-node="5107:182841"
      // @figma-hardcoded: #696969 venue-field-base — pending design token
      style={{ backgroundColor: "#696969" }}
    >
      {/* 右半侧线性高光（Figma 5107:182842） */}
      <div
        className="absolute"
        style={{
          inset: "4% -1.5% 4% 3.5%",
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0) 50%)",
        }}
      />

      {/* 球场标线（Figma 5107:182851 — imgGroup3）— 改用 background-image 100% 拉伸，
          避免 <img> 自然尺寸不拉伸导致单侧偏移 */}
      <div
        className="absolute"
        style={{
          top: "1.47%",
          bottom: "1.47%",
          left: "1.15%",
          right: "1.15%",
          backgroundImage: "url('/images/match-detail/venue-field-fill.svg')",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* 装饰光斑 · 左右两侧（Figma 5107:182893/182895，opacity-20） */}
      <div
        className="absolute opacity-20"
        style={{
          top: "38.03%",
          right: "90.77%",
          bottom: "38.03%",
          left: "3.85%",
          backgroundImage: "url('/images/match-detail/venue-mark-side.svg')",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        className="absolute opacity-20"
        style={{
          top: "38.03%",
          right: "3.85%",
          bottom: "38.03%",
          left: "90.77%",
          backgroundImage: "url('/images/match-detail/venue-mark-side.svg')",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          transform: "scaleX(-1)",
        }}
      />

      {/* 装饰光斑 · 中心（Figma 5107:182905） */}
      <div
        className="absolute opacity-20"
        style={{
          top: "24.36%",
          right: "25%",
          bottom: "24.36%",
          left: "25%",
          backgroundImage: "url('/images/match-detail/venue-mark-center.svg')",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* 径向渐变压暗（Figma 5107:182907） */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.15) 100%)",
        }}
      />

      {/* 草地 40×40 tile（Figma 5107:182908） */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/images/match-detail/venue-tile.png')",
          backgroundSize: "40px 40px",
          backgroundPosition: "top left",
          backgroundRepeat: "repeat",
        }}
      />
    </div>
  );
}

function VenueCard({ domain, compact = false }: Props) {
  const [slideIndex, setSlideIndex] = useState(0);
  const realImage = domain.venue.imagePath;
  const overlayScale = compact ? 0.75 : 1;
  const overlayHeight = compact ? OVERLAY_HEIGHT_COMPACT : OVERLAY_HEIGHT_DEFAULT;
  const containerHeight = compact ? CONTAINER_HEIGHT_COMPACT : CONTAINER_HEIGHT_DEFAULT;

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: containerHeight }}
      data-figma-node="5107:182909"
    >
      {/* 底图：真实场馆图（若有）覆盖合成球场底图 */}
      {realImage ? (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: `url('${realImage}') center/cover no-repeat` }}
        />
      ) : (
        <SyntheticFieldBackdrop />
      )}

      {/* 居中浮层 — Figma 5107:182910，274×158 frosted glass */}
      {/* @figma-hardcoded: rgba(0,0,0,0.25) venue-overlay-bg — pending design token */}
      <div
        className="absolute left-1/2 rounded-[12px] overflow-hidden"
        style={{
          width: OVERLAY_WIDTH,
          height: overlayHeight,
          // compact 模式 top=5 顶部留 5px；default 模式按缩放后视觉高度居中
          top: compact ? 5 : `calc(50% - 9px - ${(overlayHeight * overlayScale) / 2}px)`,
          backgroundColor: "rgba(0,0,0,0.25)",
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          transform: `translateX(-50%) scale(${overlayScale})`,
          transformOrigin: "top center",
        }}
        data-figma-node="5107:182910"
      >
        {/* Slide 内容：高度按 compact 状态动态切（default 158 / compact 140） */}
        <div className="size-full overflow-hidden" style={{ height: overlayHeight }}>
          {slideIndex === 0 && (
            <SlideGoalsAndScorers seasonGoals={domain.seasonGoals} topScorers={domain.topScorers} />
          )}
          {slideIndex === 1 && <SlideVenue domain={domain.venue} />}
          {slideIndex === 2 && (
            <SlideLeaguePosition
              standingsRank={domain.standingsRank}
              formPercentage={domain.formPercentage}
              recentResults={domain.recentResults}
            />
          )}
          {slideIndex === 3 && <SlidePeriodGoals periodGoals={domain.periodGoals} />}
          {slideIndex === 4 && (
            <SlideWinProbability
              winProbability={domain.winProbability}
              h2hSummary={domain.h2hSummary}
              homeShortCode={domain.homeTeam.shortCode}
              awayShortCode={domain.awayTeam.shortCode}
            />
          )}
          {slideIndex === 5 && (
            <SlideKickoff
              kickoff={domain.kickoff}
              referee={domain.referee}
              managers={domain.managers}
            />
          )}
        </div>
      </div>

      {/* Carousel controls：浮层下方，垂直对齐到容器底部留白区 */}
      <div className="absolute left-0 right-0 bottom-0">
        <VenueCarouselControls
          count={SLIDE_COUNT}
          current={slideIndex}
          onChange={setSlideIndex}
          compact={compact}
        />
      </div>
    </div>
  );
}

// ENH-031 B2.3：overview prop 由父级 useMemo 收窄稳定，compact 字面量。
export default memo(VenueCard);
