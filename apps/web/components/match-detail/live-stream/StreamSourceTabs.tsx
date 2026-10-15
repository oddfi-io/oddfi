"use client";

/**
 * StreamSourceTabs — DD-126 多源切换（≥2 条流时展示）。
 *
 * 后端已按 hd desc, stream_no asc 排序；标签 = language（空则兜底 "Source N"）+ HD 标记。
 * 设计稿未给多源态，沿用项目 chip 语言（active=brand tag）。纯展示，受控。
 */
import type { FixtureStreamItem } from "@/types/streams";

interface Props {
  streams: FixtureStreamItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /** language 为空时的兜底标签前缀（已本地化，如 "Source"） */
  sourceFallbackLabel: string;
}

export default function StreamSourceTabs({
  streams,
  activeIndex,
  onSelect,
  sourceFallbackLabel,
}: Props) {
  if (streams.length < 2) return null;

  return (
    <div className="flex flex-wrap gap-[8px]" role="tablist">
      {streams.map((s, i) => {
        const active = i === activeIndex;
        const label = s.language?.trim() || `${sourceFallbackLabel} ${s.stream_no}`;
        return (
          <button
            key={`${s.stream_no}-${i}`}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(i)}
            style={{ touchAction: "manipulation" }}
            className={[
              // Tab 切换器：按 mobile-h5.md 规则用 36px（segmented control 例外，非操作按钮不强制 44px）
              "flex min-h-[36px] items-center gap-[4px] rounded-8 px-[10px] py-[6px] text-[12px] leading-[18px] transition-colors",
              active
                ? "bg-tag-brand text-brand-default"
                : "bg-fill-input-modal text-secondary hover:text-primary",
            ].join(" ")}
          >
            <span>{label}</span>
            {s.hd && (
              <span
                className={`text-[10px] font-semibold leading-[14px] ${active ? "text-brand-default" : "text-tertiary"}`}
              >
                HD
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
