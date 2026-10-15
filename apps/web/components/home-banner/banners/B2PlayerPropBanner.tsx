import Image from "next/image";
import type { HomeBannerData } from "@/types/home-banner";
import { resolveDecoration } from "@/lib/home-banner-decorations";
import BannerBackdrop from "../parts/BannerBackdrop";
import BrandTag from "../parts/BrandTag";
import StatsCard from "../parts/StatsCard";

interface B2PlayerPropBannerProps {
  data: HomeBannerData;
  priority?: boolean;
}

// 4 张 stats card 的绝对定位（Figma 3110:44216）
// 2×2 网格：左列 left=31，右列 left=196；上行 top=167，下行 top=255
const CARD_POSITIONS = [
  { left: 31, top: 167 },
  { left: 196, top: 167 },
  { left: 31, top: 255 },
  { left: 196, top: 255 },
] as const;

/**
 * B2 球员特殊玩法（Figma 3110:44216）
 * 金棕底 #bf9517 + 5 层斜切 backdrop + Ronaldo 插画 + 绿色 PLAYER SPECIAL 标签
 *
 * 布局：纯绝对定位（不复用 BannerFrame 的 padding 流式布局）
 *   - 标题 left=31 top=56 单行 Poppins ExtraBold 36px
 *   - 副标题 row1 left=31 top=122：球员名（B2 是球员个人比赛，不展示国旗）
 *   - 副标题 row2 left=246 top=122：球衣图 + 位置/号码
 *   - 4 张 StatsCard 2×2 网格（CARD_POSITIONS）
 *   - 插画 left=354 top=29 308×402
 */
export default function B2PlayerPropBanner({ data, priority = false }: B2PlayerPropBannerProps) {
  const illustration = resolveDecoration(data.decoration_key, data.template_id);

  // subtitle 拆成 [球员名, 位置·号码]：split " · " 后第一段为名，其余用 "·"（无空格）拼回
  const [playerName = "", ...positionParts] = (data.subtitle ?? "").split(" · ");
  const playerPosition = positionParts.join("·");

  return (
    <div
      className="relative overflow-hidden flex-shrink-0"
      style={{
        width: 640,
        height: 360,
        borderRadius: 32,
        // @figma-hardcoded: #bf9517 banner-b2-bg — pending design token
        background: "#bf9517",
      }}
    >
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <BannerBackdrop variant="total_goals" />
      </div>

      {/* Ronaldo 插画 — Figma 3301:2236 */}
      <div
        className="absolute z-0 pointer-events-none"
        style={{ left: 354, top: 29, width: 308, height: 402 }}
      >
        <Image
          src={illustration}
          alt=""
          fill
          sizes="640px"
          className="object-contain"
          priority={priority}
        />
      </div>

      {/* 左上 PLAYER SPECIAL 标签 */}
      <div className="absolute z-20" style={{ top: 0, left: -1 }}>
        <BrandTag label={data.tag_text} color={data.tag_color} />
      </div>

      {/* 标题 — Figma 3110:44219 */}
      <h2
        className="absolute z-10 font-poppins font-extrabold text-white uppercase whitespace-nowrap"
        style={{
          left: 31,
          top: 56,
          fontSize: 36,
          lineHeight: 1.8,
          letterSpacing: -0.36,
          // @figma-hardcoded: #f8f8f8 banner-b2-title — pending design token
          color: "#f8f8f8",
        }}
      >
        {data.title}
      </h2>

      {/* 副标题 row1：球员名（B2 是球员个人比赛，不展示国旗 — Figma 3110:49454） */}
      <span
        className="absolute z-10 font-noto-sc font-bold text-white uppercase whitespace-nowrap"
        style={{ left: 31, top: 122, fontSize: 15, lineHeight: 1.8 }}
      >
        {playerName}
      </span>

      {/* 副标题 row2：球衣 + 位置·号码（Figma 3110:49523） */}
      <div className="absolute z-10 flex items-center" style={{ left: 246, top: 122, gap: 12 }}>
        <Image
          src="/banner/icons/jersey-pt.png"
          alt=""
          width={25}
          height={20}
          className="flex-shrink-0"
          style={{ width: 25, height: 19.318 }}
        />
        <span
          className="font-noto-sc font-bold text-white uppercase whitespace-nowrap"
          style={{ fontSize: 15, lineHeight: 1.8 }}
        >
          {playerPosition}
        </span>
      </div>

      {/* 2×2 stats card 网格 */}
      {data.items.slice(0, 4).map((item, idx) => {
        const pos = CARD_POSITIONS[idx];
        return (
          <div
            key={item.selection_id}
            className="absolute z-10"
            style={{ left: pos.left, top: pos.top }}
          >
            <StatsCard item={item} />
          </div>
        );
      })}
    </div>
  );
}
