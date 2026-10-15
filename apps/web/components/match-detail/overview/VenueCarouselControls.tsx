"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";

interface Props {
  count: number;
  current: number;
  onChange: (next: number) => void;
  /** 紧凑模式：用于市场页详情列 140px 高的容器 */
  compact?: boolean;
}

export default function VenueCarouselControls({
  count,
  current,
  onChange,
  compact = false,
}: Props) {
  const handlePrev = () => {
    onChange(current > 0 ? current - 1 : count - 1);
  };

  const handleNext = () => {
    onChange(current < count - 1 ? current + 1 : 0);
  };

  const rowHeight = compact ? "h-[24px]" : "min-h-[44px]";
  const btnSize = compact ? "size-[24px]" : "size-[44px]";
  const iconSize = compact ? 12 : 16;

  return (
    <div className={`flex items-center justify-center gap-3 ${rowHeight}`}>
      <button
        type="button"
        aria-label="Previous slide"
        onClick={handlePrev}
        style={{ touchAction: "manipulation" }}
        className={`flex items-center justify-center ${btnSize} text-[rgba(224,224,224,0.5)] hover:text-[#e0e0e0] transition-colors`}
      >
        <CaretLeftIcon size={iconSize} weight="bold" />
      </button>

      <div className="flex items-center gap-[6px]">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => onChange(i)}
            style={{ touchAction: "manipulation" }}
            className={`rounded-full transition-all ${
              i === current ? "size-[6px] bg-[#e0e0e0]" : "size-[4px] bg-[rgba(224,224,224,0.4)]"
            }`}
          />
        ))}
      </div>

      <button
        type="button"
        aria-label="Next slide"
        onClick={handleNext}
        style={{ touchAction: "manipulation" }}
        className={`flex items-center justify-center ${btnSize} text-[rgba(224,224,224,0.5)] hover:text-[#e0e0e0] transition-colors`}
      >
        <CaretRightIcon size={iconSize} weight="bold" />
      </button>
    </div>
  );
}
