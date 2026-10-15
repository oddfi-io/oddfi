"use client";

import { useMemo, useState } from "react";
import { DISCOUNT_TIERS, BASE_COSTS } from "@/lib/agent/discount";
import { MOCK_USER, generateDailyConsumption } from "@/lib/agent/mockData";

type Range = 7 | 30 | 90;

export function AccountTab() {
  const [range, setRange] = useState<Range>(30);

  const dailyData = useMemo(() => generateDailyConsumption(range), [range]);
  const maxVal = useMemo(() => Math.max(1, ...dailyData), [dailyData]);

  const currentTier = MOCK_USER.tier;
  const tierInfo = DISCOUNT_TIERS.find((t) => t.tier === currentTier)!;

  const preMatchActualCost = Math.max(1, Math.round(BASE_COSTS.preMatch * tierInfo.discountRate));

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-card border border-edge p-6">
        <header className="flex items-center justify-between mb-6 pb-4 border-b border-edge">
          <h2 className="text-base font-semibold">Credits 用量</h2>
          <div className="flex gap-2">
            <button className="bg-accent text-[#0a0e12] text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-accent-dim transition-colors">
              充值
            </button>
            <button className="bg-elevated border border-edge text-ink-2 text-xs px-3 py-1.5 rounded-md hover:border-edge-light transition-colors">
              升级 VIP
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-elevated rounded-md p-4 border border-edge">
            <div className="text-xs text-ink-3 mb-1">余额</div>
            <div className="text-3xl font-bold text-accent">{MOCK_USER.creditsBalance}</div>
            <div className="text-[10px] text-ink-3 mt-1">
              ≈ ${(MOCK_USER.creditsBalance * tierInfo.unitPriceUsd).toFixed(2)} USD
            </div>
          </div>
          <div className="bg-elevated rounded-md p-4 border border-edge">
            <div className="text-xs text-ink-3 mb-1">本月消耗</div>
            <div className="text-3xl font-bold">{MOCK_USER.monthlyConsumed}</div>
            <div className="text-[10px] text-ink-3 mt-1">
              ≈ ${(MOCK_USER.monthlyConsumed * tierInfo.unitPriceUsd).toFixed(2)} USD
            </div>
          </div>
        </div>

        <div className="flex items-baseline justify-between mb-3">
          <div className="text-sm font-semibold">每日消耗</div>
          <div className="inline-flex bg-elevated rounded-md p-0.5 border border-edge">
            {([7, 30, 90] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  range === r ? "bg-accent text-[#0a0e12] font-semibold" : "text-ink-3 hover:text-ink-2"
                }`}
              >
                {r} 天
              </button>
            ))}
          </div>
        </div>
        <div className="bg-elevated rounded-md p-3 border border-edge">
          <div className="flex items-end gap-[2px] h-32">
            {dailyData.map((v, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-all ${
                  v === 0 ? "bg-edge" : v === maxVal ? "bg-accent shadow-[0_0_8px_var(--accent)]" : "bg-accent-dim"
                }`}
                style={{
                  height: v === 0 ? "2px" : `${(v / maxVal) * 100}%`,
                  minHeight: v === 0 ? "2px" : "3px",
                }}
                title={`Day ${i + 1}: ${v} Credits`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-ink-3 mt-2 font-mono">
            <span>{range} 天前</span>
            <span>今天</span>
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-card border border-edge p-6">
        <header className="flex items-baseline gap-2 mb-6 pb-4 border-b border-edge">
          <span className="font-mono text-xs text-ink-3">06</span>
          <h2 className="text-base font-semibold">等级与 Credits 折扣</h2>
          <span className="text-xs text-ink-3 ml-2">VIP 等级越高，AI 调用越便宜</span>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-3 border-b border-edge">
                <th className="text-left py-2 px-3 font-normal">等级</th>
                <th className="text-right py-2 px-3 font-normal">折扣率</th>
                <th className="text-right py-2 px-3 font-normal">1 Credit 单价</th>
                <th className="text-right py-2 px-3 font-normal">节省</th>
              </tr>
            </thead>
            <tbody>
              {DISCOUNT_TIERS.map((t) => {
                const isCurrent = t.tier === currentTier;
                return (
                  <tr
                    key={t.tier}
                    className={`border-b border-edge last:border-b-0 ${
                      isCurrent ? "bg-accent-bg font-semibold" : ""
                    }`}
                  >
                    <td className={`py-2 px-3 ${isCurrent ? "text-accent" : ""}`}>
                      {t.name}
                      {isCurrent && <span className="ml-2 text-xs">◀ 你</span>}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">{t.discountRate.toFixed(2)}x</td>
                    <td className="py-2 px-3 text-right font-mono">${t.unitPriceUsd.toFixed(4)} USD</td>
                    <td className="py-2 px-3 text-right text-accent">
                      {t.savePct ? `${t.savePct}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-ink-3 mt-4 leading-relaxed">
          <span className="text-ink-2 font-semibold">基础消耗：</span>
          对话 {BASE_COSTS.chat} / 赛前分析 {BASE_COSTS.preMatch} / 临场更新 {BASE_COSTS.liveUpdate}{" "}
          / 复盘 {BASE_COSTS.recap} / 主动新闻 {BASE_COSTS.proactivePush} Credits
          <br />
          实际扣减 = max(1, round(基础 × 折扣率))。例：{tierInfo.name} 调用赛前分析 ={" "}
          {BASE_COSTS.preMatch} × {tierInfo.discountRate} ≈{" "}
          <span className="text-accent font-semibold">{preMatchActualCost} Credits</span>。
        </div>
      </section>
    </div>
  );
}
