import Image from "next/image";
import type { BannerItem } from "@/types/home-banner";
import { formatAmount } from "@/lib/decimal";

interface StatsCardProps {
  item: BannerItem;
}

/**
 * B2 球员特殊玩法档位卡（Figma 3110:49488）
 * 170.5 × auto, 左半红渐变 from-#dd2444 to-transparent，只左侧圆角
 * is_favorite → Poppins SemiBold 标签；否则 Regular
 */
export default function StatsCard({ item }: StatsCardProps) {
  const isFavorite = item.extra.is_favorite ?? false;
  return (
    <div
      className="flex flex-col items-start justify-center"
      style={{
        width: 170.5, // @figma intentional non-integer
        paddingLeft: 17.6,
        paddingRight: 17.6,
        paddingTop: 8.8,
        paddingBottom: 8.8,
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12,
        // @figma-hardcoded: #dd2444 → rgba(221,36,68,0) stats-card-bg — pending design token
        background: "linear-gradient(90deg, #dd2444 0%, rgba(221,36,68,0) 100%)",
      }}
    >
      <div className="flex items-center gap-[4.4px] w-full">
        <Image
          src="/banner/icons/soccer-ball.png"
          alt=""
          width={15}
          height={15}
          sizes="15px"
          className="flex-shrink-0"
          style={{ width: 14.3, height: 14.3 }}
        />
        <span
          className={`font-poppins text-white whitespace-nowrap ${
            isFavorite ? "font-semibold" : "font-normal"
          }`}
          style={{ fontSize: 13.2, lineHeight: 1.8 }}
        >
          {item.name}
        </span>
      </div>
      <span
        className="font-poppins font-bold text-white tabular-nums"
        style={{ fontSize: 17.6, lineHeight: 1.8 }}
      >
        {formatAmount(item.odds, 2)}
      </span>
    </div>
  );
}
