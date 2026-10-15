"use client";

import { useEffect, useState } from "react";
import { MOCK_RECAP } from "@/lib/agent/dockMockData";
import { getAnalysis, type AnalysisData } from "@/lib/agent/backend";

type Section = "upcoming" | "finished";

export function AnalysisPanel() {
  const [section, setSection] = useState<Section>("upcoming");
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await getAnalysis();
        if (cancelled) return;
        if (r.ready && r.analysis) {
          setAnalysis(r.analysis);
          setReason("");
        } else {
          setAnalysis(null);
          setReason(r.reason ?? "暂未生成");
        }
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          console.warn("getAnalysis failed:", e);
          setReason("连不上后端");
          setLoading(false);
        }
      }
    };
    tick();
    const id = setInterval(tick, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="h-full overflow-y-auto px-4 pb-2">
      <div className="inline-flex self-start border border-[#212124] p-1 rounded-full mb-3 mt-1">
        <button
          type="button"
          onClick={() => setSection("upcoming")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
            section === "upcoming"
              ? "bg-brand-fade text-brand"
              : "text-ink-2 hover:text-white"
          }`}
        >
          欧冠决赛
        </button>
        <button
          type="button"
          onClick={() => setSection("finished")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
            section === "finished"
              ? "bg-brand-fade text-brand"
              : "text-ink-2 hover:text-white"
          }`}
        >
          今天已结束
        </button>
      </div>

      {section === "upcoming" && (
        <>
          {loading ? (
            <div className="bg-dock-3 border border-dashed border-dock-edge rounded-xl p-6 text-center">
              <div className="text-xs text-[#8b8d93]">加载中…</div>
            </div>
          ) : analysis ? (
            <UpcomingCard a={analysis} />
          ) : (
            <div className="bg-dock-3 border border-dashed border-dock-edge rounded-xl p-6 text-center">
              <div className="text-2xl mb-2 opacity-50">⏳</div>
              <div className="text-xs text-[#8b8d93] mb-1">分析生成中</div>
              <div className="text-[10px] text-[#5c5d61] leading-relaxed">
                {reason}
                <br />
                后端每 1 小时基于 Twitter 推送 + LLM 知识自动生成欧冠决赛分析
              </div>
            </div>
          )}
        </>
      )}

      {section === "finished" && (
        <div className="flex flex-col gap-3">
          {MOCK_RECAP.map((r) => {
            const profit = r.payout - r.stake;
            return (
              <article
                key={r.id}
                className="bg-dock-2 border border-dock-edge rounded-2xl p-3"
              >
                <header className="flex items-baseline justify-between mb-2">
                  <div className="text-sm font-bold">{r.match}</div>
                  <div className="text-[11px] text-ink-3">{r.finishedAt}</div>
                </header>

                <div className="text-xs text-ink-2 mb-3 font-mono">
                  {r.result}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-dock-3 rounded-lg p-2.5">
                    <div className="text-[10px] text-ink-3 mb-1">你的下注</div>
                    <div className="text-xs font-semibold">{r.yourBet}</div>
                    <div className="text-[10px] text-ink-3 mt-0.5 font-mono">
                      {r.stake} ODD
                    </div>
                  </div>
                  <div className="bg-brand-fade rounded-lg p-2.5">
                    <div className="text-[10px] text-brand mb-1">收益</div>
                    <div className="text-xs font-semibold text-brand font-mono">
                      +{profit} ODD
                    </div>
                    <div className="text-[10px] text-ink-3 mt-0.5">
                      赔付 {r.payout} ODD
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3 text-[11px]">
                  <span className="text-ink-3">AI 判断：</span>
                  <span
                    className={`px-2 py-0.5 rounded ${r.aiCallCorrect ? "bg-brand-fade text-brand" : "bg-danger-bg text-danger"}`}
                  >
                    {r.aiCallCorrect ? "✓ 命中" : "✗ 未中"}
                  </span>
                  <span className="text-white">{r.yourBet}</span>
                </div>

                <div className="flex justify-between text-[11px] pt-3 border-t border-dock-edge">
                  <div>
                    <span className="text-ink-3">今日累计：</span>
                    <span
                      className={
                        r.todayPnl > 0
                          ? "text-brand font-mono font-bold"
                          : "text-danger font-mono font-bold"
                      }
                    >
                      {r.todayPnl > 0 ? "+" : ""}
                      {r.todayPnl} ODD
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-3">本周累计：</span>
                    <span
                      className={
                        r.weekPnl > 0
                          ? "text-brand font-mono font-bold"
                          : "text-danger font-mono font-bold"
                      }
                    >
                      {r.weekPnl > 0 ? "+" : ""}
                      {r.weekPnl} ODD
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UpcomingCard({ a }: { a: AnalysisData }) {
  const diffPp = a.aiProb.home - a.marketProb.home;
  const updatedDate = new Date(a.updatedAt);
  const updatedStr = updatedDate.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <article className="bg-dock-2 border border-dock-edge rounded-2xl p-3">
      <header className="mb-2">
        <div className="text-sm font-bold">🏆 {a.match}</div>
        <div className="text-[10px] text-ink-3 mt-0.5">UEFA 欧冠决赛 · 2025-26 赛季</div>
      </header>

      <div className="bg-brand-fade border-l-2 border-brand rounded-r-md px-2.5 py-1.5 text-[11px] text-white mb-3 leading-relaxed">
        💡 {a.summary}
      </div>

      <div className="mb-3">
        <div className="text-[10px] text-ink-3 mb-1 tracking-wider">
          AI vs 市场（主胜）
        </div>
        <div className="flex items-baseline gap-3">
          <div>
            <span className="text-brand font-bold font-display text-xl">
              {a.aiProb.home}%
            </span>
            <span className="text-[10px] text-ink-3 ml-1">AI</span>
          </div>
          <span className="text-ink-3 text-xs">vs</span>
          <div>
            <span className="text-white font-bold font-display text-xl">
              {a.marketProb.home}%
            </span>
            <span className="text-[10px] text-ink-3 ml-1">市场</span>
          </div>
          <span
            className={`ml-auto text-[11px] font-bold ${
              diffPp > 0 ? "text-brand" : "text-warn"
            }`}
          >
            {diffPp > 0 ? "+" : ""}
            {diffPp}pp
          </span>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-[10px] text-ink-3 mb-1.5 tracking-wider">
          关键论据 ({a.evidence.length} 条)
        </div>
        <ul className="space-y-1">
          {a.evidence.map((e, i) => (
            <li
              key={i}
              className="text-xs text-white leading-relaxed flex gap-1.5"
            >
              <span className="text-brand flex-shrink-0">·</span>
              <span>{e}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-warn-bg border-l-2 border-warn rounded-r-md px-3 py-2 mb-3">
        <div className="text-[10px] text-warn font-bold mb-0.5 tracking-wider">
          不知道的事
        </div>
        <p className="text-xs text-white leading-relaxed">{a.unknown}</p>
      </div>

      <div className="bg-dock-3 rounded-lg p-2.5 mb-3">
        <div className="text-[10px] text-ink-3 mb-1">建议仓位</div>
        <div className="text-sm font-bold text-white">{a.suggestionRange}</div>
      </div>

      <button
        type="button"
        className="w-full bg-brand text-black text-xs font-bold py-2.5 rounded-lg hover:bg-brand-bright transition-colors cursor-pointer"
      >
        {a.pickLabel} @ {a.pickOdds.toFixed(2)} · 主推下注
      </button>

      <div className="mt-3 text-[10px] text-ink-3 text-center">
        分析更新于 {updatedStr} · 基于 {a.basedOnTweets} 条 Twitter 推送
      </div>
    </article>
  );
}
