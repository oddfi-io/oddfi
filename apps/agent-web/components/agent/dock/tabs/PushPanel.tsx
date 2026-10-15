"use client";

import { useEffect, useState } from "react";
import {
  type DockPush,
  type PushTagKind,
} from "@/lib/agent/dockMockData";

const TAG_STYLES: Record<PushTagKind, string> = {
  odds: "bg-[rgba(40,244,210,0.16)] text-brand",
  match: "bg-[rgba(251,191,36,0.16)] text-[#fbbf24]",
  market: "bg-[rgba(101,133,255,0.16)] text-[#6585ff]",
};

interface PushPanelProps {
  items: DockPush[];
  totalCount: number;
  filterMode: "watched" | "all";
  onFilterChange: (m: "watched" | "all") => void;
}

function handleAction(
  entry: DockPush,
  kind: "primary" | "alt" | "enter" | "observe",
) {
  if (!entry.suggest) {
    alert(kind === "enter" ? "已开始下注流程" : "已加入观察清单");
    return;
  }
  const labels: Record<string, string> = {
    primary: entry.suggest.action,
    alt: entry.suggest.alt,
    observe: "已加入观察清单",
    enter: "已开始下注流程",
  };
  alert(`${labels[kind]}\n\n${entry.title ?? entry.originalText.slice(0, 60)}`);
}

// 浏览器时区相对/绝对时间格式化
// - < 1 分钟：刚刚
// - < 1 小时：N 分钟前
// - 同一天：HH:mm
// - 不同天：MM/DD HH:mm
function formatLocalTime(createdAtMs: number, now: number): string {
  if (!createdAtMs) return "";
  const diff = now - createdAtMs;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;

  const d = new Date(createdAtMs);
  const today = new Date(now);
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");

  if (sameDay) return `${hh}:${mm}`;
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  return `${M}/${D} ${hh}:${mm}`;
}

export function PushPanel({
  items,
  totalCount,
  filterMode,
  onFilterChange,
}: PushPanelProps) {
  // 每 30 秒刷一次，让 "N 分钟前" 自动跳
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // 关注过滤开着、有推文但都没命中
  const filteredEmpty =
    filterMode === "watched" && items.length === 0 && totalCount > 0;

  return (
    <div className="h-full overflow-y-auto px-4 pb-2">
      <div className="flex items-center justify-between pt-2 mb-3">
        <div>
          <span className="text-[13px] font-bold text-white">📡 Twitter 推送</span>
          <span className="ml-2 text-[10px] text-[#5c5d61]">
            {items.length} 条
            {filterMode === "watched" && totalCount > items.length
              ? ` · 共 ${totalCount}`
              : ""}
          </span>
        </div>
        <div className="inline-flex bg-dock-2 border border-dock-edge rounded-full p-0.5">
          {(["watched", "all"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onFilterChange(m)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                filterMode === m
                  ? "bg-brand-fade text-brand"
                  : "text-[#8b8d93] hover:text-white"
              }`}
            >
              {m === "watched" ? "已关注" : "全部"}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-dock-3 border border-dashed border-dock-edge rounded-xl p-6 text-center mt-2">
          <div className="text-2xl mb-2 opacity-50">{filteredEmpty ? "🔍" : "📭"}</div>
          <div className="text-xs text-[#8b8d93] mb-1">
            {filteredEmpty ? "关注列表暂无匹配" : "暂无推送"}
          </div>
          <div className="text-[10px] text-[#5c5d61] leading-relaxed">
            {filteredEmpty ? (
              <>
                共 {totalCount} 条推送，无一命中你的关注词。
                <br />
                <button
                  type="button"
                  onClick={() => onFilterChange("all")}
                  className="text-brand hover:underline mt-1 cursor-pointer"
                >
                  查看全部 →
                </button>
              </>
            ) : (
              "等待 Twitter 监控有新推文进入…"
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((p) => (
            <PushCard key={p.id} entry={p} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}

function PushCard({ entry, now }: { entry: DockPush; now: number }) {
  const pos = entry.position;
  const hasAI = entry.aiEnriched && entry.aiAnalysis;
  const tagStyle =
    entry.tag && entry.tag in TAG_STYLES
      ? TAG_STYLES[entry.tag as PushTagKind]
      : "bg-dock-edge text-[#8b8d93]";

  const timeLabel = formatLocalTime(entry.createdAt, now);

  return (
    <article className="bg-dock-3 border border-dock-edge rounded-[10px] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-dock-edge">
        {entry.tagLabel ? (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wider ${tagStyle}`}
          >
            {entry.tagLabel}
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded tracking-wider bg-dock-edge text-[#8b8d93]">
            🤖 AI 解读中…
          </span>
        )}
        <span className="relative group text-[10px] text-[#5c5d61] font-mono cursor-pointer">
          {timeLabel}
          {entry.createdAt > 0 && (
            <span className="pointer-events-none absolute right-0 top-full mt-1.5 z-20 whitespace-nowrap rounded-md border border-dock-edge bg-dock-2 px-2.5 py-1.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 shadow-lg">
              {new Date(entry.createdAt).toLocaleString("zh-CN", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })}
            </span>
          )}
        </span>
      </div>

      <div className="px-3 py-2.5">
        {entry.title && (
          <div className="text-[13px] font-bold text-white leading-snug mb-1.5">
            {entry.title}
          </div>
        )}

        <div className="text-[12px] text-white leading-relaxed mb-2 whitespace-pre-wrap break-words">
          {entry.originalText}
        </div>

        <div className="text-[10px] text-[#5c5d61] pb-2 border-b border-dashed border-dock-edge mb-2">
          {entry.authorName && (
            <span className="text-[#8b8d93] mr-1">{entry.authorName}</span>
          )}
          来源 · {entry.source}{" "}
          {entry.sourceUrl && (
            <a
              href={`https://${entry.sourceUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline ml-1"
            >
              ↗
            </a>
          )}
        </div>

        {hasAI && (
          <section className="mb-2">
            <div className="text-[11px] font-bold text-[#8b8d93] mb-1.5">
              🤖 AI 解读
            </div>
            <div className="text-[11px] text-[#8b8d93] leading-relaxed pl-[18px] -indent-[18px]">
              📊 变化：{entry.aiAnalysis!.change}
            </div>
            <div
              className="text-[11px] text-[#8b8d93] leading-relaxed pl-[18px] -indent-[18px]"
              dangerouslySetInnerHTML={{
                __html: "💰 赔率：" + entry.aiAnalysis!.priceImpact,
              }}
            />
            <div
              className="text-[11px] text-[#8b8d93] leading-relaxed pl-[18px] -indent-[18px]"
              dangerouslySetInnerHTML={{
                __html: "🎯 赢率：" + entry.aiAnalysis!.probImpact,
              }}
            />
          </section>
        )}

        {pos && (
          <section className="mb-2">
            <div className="text-[11px] font-bold text-[#8b8d93] mb-1.5">
              📍 你的持仓
            </div>
            <div
              className="border-l-2 border-brand rounded-r px-2.5 py-1.5 text-[11px] text-white leading-relaxed"
              style={{ background: "rgba(40,244,210,0.06)" }}
            >
              <div className="flex justify-between">
                <span>
                  <b className="font-bold">{pos.pick}</b> @{" "}
                  {pos.entryOdd.toFixed(2)}
                </span>
                <span>
                  <b className="font-bold">{pos.stake} ODD</b>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5c5d61]">
                  当前 → @ {pos.newOdd.toFixed(2)}
                </span>
                <span
                  className={
                    pos.pnl >= 0
                      ? "text-brand font-bold"
                      : "text-[#f87171] font-bold"
                  }
                >
                  {pos.pnl >= 0 ? "+" : ""}
                  {pos.pnl.toFixed(2)} ODD
                </span>
              </div>
            </div>
          </section>
        )}

        {entry.suggest && (
          <div
            className="rounded text-[11px] text-white leading-relaxed px-2.5 py-1.5 mt-2"
            style={{ background: "rgba(40,244,210,0.06)" }}
            dangerouslySetInnerHTML={{ __html: "💡 " + entry.suggest.text }}
          />
        )}
      </div>

      <div className="flex gap-1.5 px-3 py-2 border-t border-dashed border-dock-edge bg-black/10">
        {entry.suggest ? (
          pos ? (
            <>
              <button
                type="button"
                onClick={() => handleAction(entry, "primary")}
                className="flex-1 px-2.5 py-1.5 text-[11px] font-bold rounded-md bg-brand text-[#04060c] hover:bg-brand-bright transition-colors cursor-pointer"
              >
                {entry.suggest.action}
              </button>
              <button
                type="button"
                onClick={() => handleAction(entry, "alt")}
                className="flex-1 px-2.5 py-1.5 text-[11px] font-bold rounded-md bg-transparent text-[#8b8d93] border border-dock-edge hover:text-white hover:border-[#8b8d93] transition-colors cursor-pointer"
              >
                {entry.suggest.alt}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleAction(entry, "enter")}
                className="flex-1 px-2.5 py-1.5 text-[11px] font-bold rounded-md bg-brand text-[#04060c] hover:bg-brand-bright transition-colors cursor-pointer"
              >
                立即下单
              </button>
              <button
                type="button"
                onClick={() => handleAction(entry, "observe")}
                className="flex-1 px-2.5 py-1.5 text-[11px] font-bold rounded-md bg-transparent text-[#8b8d93] border border-dock-edge hover:text-white hover:border-[#8b8d93] transition-colors cursor-pointer"
              >
                仅观察
              </button>
            </>
          )
        ) : (
          <a
            href={entry.sourceUrl ? `https://${entry.sourceUrl}` : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-2.5 py-1.5 text-[11px] font-bold rounded-md bg-transparent text-[#8b8d93] border border-dock-edge hover:text-white hover:border-[#8b8d93] transition-colors cursor-pointer text-center"
          >
            🐦 查看原推
          </a>
        )}
      </div>
    </article>
  );
}
