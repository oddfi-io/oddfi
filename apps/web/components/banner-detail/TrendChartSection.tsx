"use client";

import Image from "next/image";
import type { BannerDetailFixture } from "@/lib/banner-detail-fixtures";
import type { TemplateId } from "@/types/home-banner";
import { useCountdown } from "@/hooks/useCountdown";
import CountdownPills from "./CountdownPills";
import TrendChart from "./TrendChart";

interface Props {
  /** banner 元数据 — 从 useMarketBanners list 取 */
  title: string;
  /** template_id，用于推导 thumbnail 路径 */
  bannerCode: TemplateId;
  /** trend 数据 — 后端不返回 trend，仍由 fixture 提供（Phase 3 后端补后切） */
  fixture: BannerDetailFixture;
  /** 截止时间（UTC+0，"YYYY-MM-DD HH:mm:ss" 后端格式）；
   *  传入则用 useCountdown 实时倒计时；未传降级到 fixture.countdown 静态值 */
  endTime?: string | null;
  /** BetSlip 激活时切单列（详情主区 704w，inner 640）；否则双列（inner 1104） */
  compact?: boolean;
  /** H5 模式：触发 H5 响应式布局（padding 16px、avatar 40px、title 16px、chart 178px）
   *  H5 模式通过 Tailwind 响应式断点实现，mobile prop 仅用于 chart height 计算 */
  mobile?: boolean;
}

/** 详情页缩略图路径（前端配置 — 待后端 detail 接口补 thumbnail_url 字段后切真值，2026-04-27 验收反馈）
 *  注：必须放在 next.config.mjs `localPatterns` 白名单内的 /banner/** 下，否则 next/image 返回 400 */
const THUMBNAIL_PATH: Record<TemplateId, string> = {
  top_wins_the_world_cup: "/banner/thumbnails/b1-thumbnail.png",
  total_goals: "/banner/thumbnails/b2-thumbnail.png",
  top_golden_ball_name: "/banner/thumbnails/b3-thumbnail.png",
  top_golden_boot_name: "/banner/thumbnails/b4-thumbnail.png",
  top_golden_glove_name: "/banner/thumbnails/b5-thumbnail.png",
};

/**
 * TrendChartSection：详情页趋势线区容器（DD-085 §3.4）
 *
 * Figma 节点：双列 [3550:74158](https://www.figma.com/design/6WH0v3q8t3rImMXpt7uGXs/oddfi-UI-UX?node-id=3550-74158)
 *           / 单列 [3547:10031](https://www.figma.com/design/6WH0v3q8t3rImMXpt7uGXs/oddfi-UI-UX?node-id=3547-10031)
 * 视觉：bg-[#111114] rounded-16 padding 36 32
 * 结构：圆头像 + 渐变标题 + CountdownPills + Legend + TrendChart（lightweight-charts 4× LineSeries）
 */
export default function TrendChartSection({
  title,
  bannerCode,
  fixture,
  endTime,
  compact = false,
  mobile = false,
}: Props) {
  const liveCountdown = useCountdown(endTime ?? null);
  // 仅当传入 endTime 且未过期时显示倒计时；否则不渲染（用户验收反馈）
  const countdown = endTime && !liveCountdown.isExpired ? liveCountdown : null;

  const avatarSrc = THUMBNAIL_PATH[bannerCode];
  const figmaNode = compact ? "3547:10031" : "3550:74158";
  // H5: chart 178px（Figma 3646:135905 inner chart area）；PC compact 240；PC default 280
  const chartHeight = mobile ? 178 : compact ? 240 : 280;

  return (
    // H5: p-4 rounded-2xl；PC: px-8 py-9 rounded-2xl
    <section
      className="w-full rounded-2xl bg-secondary p-4 md:px-8 md:py-9"
      data-figma-node={figmaNode}
    >
      <div className="flex flex-col gap-4 md:gap-6">
        {/* H5: 行 1 avatar+title / 行 2 countdown inline / 行 3 chart
            PC: 行 1 (avatar+title 与 countdown 同 row 右对齐) / 行 2 chart */}
        <div
          className={
            mobile
              ? "flex flex-col gap-4"
              : "flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
          }
          data-figma-node="3550:74082"
        >
          <div className="flex items-center gap-4 min-w-0">
            {/* H5: avatar 40×40；PC: 56×56 */}
            <div className="relative size-10 md:size-14 shrink-0 overflow-hidden rounded-full bg-tertiary">
              <Image
                src={avatarSrc}
                alt=""
                fill
                sizes="(max-width: 767px) 40px, 56px"
                className="object-cover"
                aria-hidden="true"
              />
            </div>
            {/* H5: text-[16px]；PC: text-[24px] */}
            <h2
              className="text-[16px] md:text-[24px] font-bold uppercase leading-[1.8] truncate"
              style={{
                // @figma-hardcoded: linear-gradient(90.36deg,#f8f8f8 0%,#fffadc 99.52%) title-gradient — pending design token
                backgroundImage: "linear-gradient(90.36deg, #f8f8f8 0%, #fffadc 99.52%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              {title}
            </h2>
          </div>
          {/* Countdown：H5 inline 整行（End in + pills），PC 右对齐 */}
          {countdown && (
            <div className={mobile ? "w-full" : "shrink-0"}>
              <CountdownPills countdown={countdown} mobile={mobile} />
            </div>
          )}
        </div>

        {/* Legend + TrendChart（4× LineSeries） */}
        <TrendChart series={fixture.trend.series} yMax={fixture.trend.yMax} height={chartHeight} />
      </div>
    </section>
  );
}
