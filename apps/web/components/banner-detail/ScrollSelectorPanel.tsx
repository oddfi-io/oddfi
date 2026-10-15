"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BannerItemDetail } from "@/types/home-banner";
import { FootballBannerIcon } from "@/components/icons/BannerTabIcons";
import ScrollSelector from "./ScrollSelector";
import ScrollSelectorBetForm from "./ScrollSelectorBetForm";

interface Props {
  /** B2 详情接口返回的 items（10 档：0-8 + 8+） */
  items: BannerItemDetail[];
  /** Bet 点击 — 父组件 add(selection) */
  onBet: (item: BannerItemDetail, e: React.MouseEvent) => void;
  /** BetSlip 激活时切上下结构（704w）；否则双列横排（1168w） */
  compact?: boolean;
  /** H5 模式：渲染 343×235 紧凑卡（Figma 3702:70861） */
  mobile?: boolean;
}

/**
 * ScrollSelectorPanel：B2 滚动块模式整体容器（DD-085 §3.4）
 *
 * Figma 节点：上下合并 [3646:137236](https://www.figma.com/design/6WH0v3q8t3rImMXpt7uGXs/oddfi-UI-UX?node-id=3646-137236)
 *           / 双列横排 [3602:11890](https://www.figma.com/design/6WH0v3q8t3rImMXpt7uGXs/oddfi-UI-UX?node-id=3602-11890)
 *
 * compact=true → 上下结构（704w）；compact=false → 双列横排（1168w）
 * 默认选中 goals_slot=7（与 Figma 默认值一致），用户切换更新本地 state（本轮不持久）
 */
export default function ScrollSelectorPanel({
  items,
  onBet,
  compact = false,
  mobile = false,
}: Props) {
  // 按 goals_slot 升序排（确保滑块刻度顺序固定）
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.extra.goals_slot ?? 0) - (b.extra.goals_slot ?? 0)),
    [items]
  );

  // 默认选中 goals_slot=7，找不到则取最后一档
  const defaultIdx = useMemo(() => {
    const idx = sortedItems.findIndex((it) => it.extra.goals_slot === 7);
    return idx >= 0 ? idx : Math.max(0, sortedItems.length - 1);
  }, [sortedItems]);

  const [selectedIndex, setSelectedIndex] = useState(defaultIdx);

  if (sortedItems.length === 0) return null;

  const safeIdx = Math.min(Math.max(0, selectedIndex), sortedItems.length - 1);
  const selectedItem = sortedItems[safeIdx];

  const labels = sortedItems.map((it) => {
    const slot = it.extra.goals_slot;
    // 最后一档 8+（goals_slot=9 in fixture; 后端 name "8+ goals"）
    if (it.name.includes("+") || slot === 9) return { label: "8+" };
    return { label: String(slot ?? "?") };
  });

  // ── Mobile branch (H5 343×235 紧凑卡 · Figma 3702:70861) ──────────────────
  if (mobile) {
    return (
      <MobileScrollSelectorPanel
        sortedItems={sortedItems}
        labels={labels}
        safeIdx={safeIdx}
        selectedItem={selectedItem}
        onSelect={setSelectedIndex}
        onBet={onBet}
      />
    );
  }

  // ── PC branches ──────────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div
        className="flex w-full flex-col gap-7 rounded-2xl bg-secondary p-6"
        data-figma-node="3646:137236"
      >
        <ScrollSelector values={labels} selectedIndex={safeIdx} onChange={setSelectedIndex} />
        <ScrollSelectorBetForm
          item={selectedItem}
          goalsLabel={labels[safeIdx]?.label ?? ""}
          onBet={onBet}
        />
      </div>
    );
  }

  return (
    <div
      className="flex w-full items-center gap-6 rounded-2xl bg-secondary p-6"
      data-figma-node="3602:11890"
    >
      <div className="min-w-0 flex-1">
        <ScrollSelector values={labels} selectedIndex={safeIdx} onChange={setSelectedIndex} />
      </div>
      <div className="w-[555px] shrink-0">
        <ScrollSelectorBetForm
          item={selectedItem}
          goalsLabel={labels[safeIdx]?.label ?? ""}
          onBet={onBet}
        />
      </div>
    </div>
  );
}

// ── Mobile 子组件（独立组件以便挂 hooks · 拖拽 + scrollIntoView） ──────────────
interface MobileProps {
  sortedItems: BannerItemDetail[];
  labels: { label: string }[];
  safeIdx: number;
  selectedItem: BannerItemDetail;
  onSelect: (idx: number) => void;
  onBet: (item: BannerItemDetail, e: React.MouseEvent) => void;
}

function MobileScrollSelectorPanel({
  sortedItems,
  labels,
  safeIdx,
  selectedItem,
  onSelect,
  onBet,
}: MobileProps) {
  const total = sortedItems.length;
  const progressPct = total > 1 ? (safeIdx / (total - 1)) * 100 : 0;

  // 拖拽态 + track ref（与 PC ScrollSelector 等价的 pointer 处理）
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || total <= 1) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      const ratio = (clientX - rect.left) / rect.width;
      const clamped = Math.min(1, Math.max(0, ratio));
      const idx = Math.round(clamped * (total - 1));
      if (idx !== safeIdx) onSelect(idx);
    },
    [total, safeIdx, onSelect]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    trackRef.current?.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    trackRef.current?.releasePointerCapture(e.pointerId);
  };

  useEffect(() => () => setIsDragging(false), []);

  return (
    <div className="w-full rounded-[16px] bg-secondary" data-figma-node="3702:70861">
      {/* 卡背景内容区 left-16 top-31 w-312 */}
      <div
        className="flex flex-col gap-[16px] px-[16px] pb-[24px] pt-[31px]"
        data-figma-node="3702:70912"
      >
        {/* 顶部进度条 + 数字带 */}
        <div className="flex flex-col gap-[12px] items-end w-full" data-figma-node="3702:70872">
          {/* 进度条（h-12px 热区，内含 4px track + dots，整条响应 pointer 拖拽） */}
          <div
            ref={trackRef}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={total - 1}
            aria-valuenow={safeIdx}
            aria-valuetext={labels[safeIdx]?.label}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative h-[12px] w-full select-none"
            style={{ touchAction: "none" }}
            data-figma-node="3702:70873"
          >
            {/* Inactive track（右侧剩余段） */}
            <div className="pointer-events-none absolute inset-x-0 top-[4px] h-[4px] rounded-[12px] bg-tertiary" />
            {/* Active fill（teal，基于 progressPct） */}
            <div
              className="pointer-events-none absolute left-0 top-[4px] h-[4px] rounded-[12px]"
              style={{
                backgroundColor: "var(--text-brand-default)",
                width: `${progressPct}%`,
              }}
            />
            {/* 10 个圆点（点击转 onSelect；拖拽中触发的 click 忽略） */}
            {sortedItems.map((_, i) => {
              const left = total > 1 ? (i / (total - 1)) * 100 : 0;
              const isCurrent = i === safeIdx;
              const isReached = i < safeIdx;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    if (isDragging) return;
                    e.stopPropagation();
                    onSelect(i);
                  }}
                  aria-label={`Select ${labels[i]?.label}`}
                  aria-current={isCurrent ? "true" : undefined}
                  className={[
                    "absolute rounded-full",
                    isCurrent
                      ? "top-0 size-3 ring-2 ring-white/15"
                      : isReached
                        ? "top-[2px] size-2 bg-white"
                        : "top-[2px] size-2 bg-tertiary",
                  ].join(" ")}
                  style={{
                    left: `${left}%`,
                    transform: "translateX(-50%)",
                    ...(isCurrent && {
                      backgroundColor: "var(--text-brand-default)",
                    }),
                    touchAction: "manipulation",
                  }}
                />
              );
            })}
          </div>

          {/* 数字带 0–8+ */}
          <div
            className="flex w-full items-center justify-between rounded-[48px] bg-secondary py-1"
            data-figma-node="3702:70886"
          >
            {labels.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelect(i)}
                className={[
                  "flex items-center justify-center px-1 text-[14px] font-bold leading-[19px]",
                  i === safeIdx ? "text-brand-default" : "text-primary",
                ].join(" ")}
                style={{ touchAction: "manipulation" }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 内层卡片：输入行 + 大 Bet 按钮 */}
        <div
          className="flex w-full flex-col gap-[16px] rounded-[12px] bg-tertiary px-[16px] py-[24px]"
          data-figma-node="3702:70913"
        >
          {/* 输入行 */}
          <div className="flex w-full items-center justify-between" data-figma-node="3702:70914">
            {/* 左侧：足球图标 + Goals 标签 + 数字 input */}
            <div className="flex items-center gap-[8px]" data-figma-node="3702:70915">
              {/* 足球图标 16×16（白色 — 用 currentColor SVG 组件而非 Image，避免 Image 不支持 text 颜色继承） */}
              <FootballBannerIcon size={16} className="shrink-0 text-white" />
              <span
                className="shrink-0 text-[14px] font-medium leading-[19px] text-white"
                data-figma-node="3702:70917"
              >
                Goals
              </span>
              {/* Input 框 48×32 */}
              <div
                className="flex h-[32px] w-[48px] shrink-0 items-center justify-between rounded-[8px] border border-divider bg-tertiary px-[12px]"
                data-figma-node="3718:71469"
              >
                <span className="text-[14px] font-bold leading-[19px] text-primary">
                  {labels[safeIdx]?.label ?? "0"}
                </span>
              </div>
            </div>

            {/* 右侧：赔率展示 pill（teal bg，显示 odds 值） */}
            <div
              className="flex h-[32px] shrink-0 items-center justify-center rounded-[8px] px-[16px]"
              style={{
                // @figma-hardcoded: rgba(40,244,210,0.1) odds-pill-bg — pending design token
                backgroundColor: "rgba(40,244,210,0.1)",
              }}
              data-figma-node="3702:71016"
            >
              <span className="text-[14px] font-bold leading-[19px] text-brand-default">
                {selectedItem.odds}x
              </span>
            </div>
          </div>

          {/* 大 Bet 按钮 280×32（全宽） */}
          <button
            type="button"
            onClick={(e) => onBet(selectedItem, e)}
            aria-label={`Bet on ${selectedItem.name}`}
            className="flex h-[32px] w-full items-center justify-center rounded-[50px] text-[12px] font-bold leading-[1.8] transition-opacity hover:opacity-90 active:opacity-80"
            style={{
              backgroundColor: "var(--text-brand-default)",
              // @figma-hardcoded: #060724 bet-btn-fg — pending design token
              color: "#060724",
              touchAction: "manipulation",
            }}
            data-figma-node="3702:70922"
          >
            Bet
          </button>
        </div>
      </div>
    </div>
  );
}
