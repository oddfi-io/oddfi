"use client";

import { useState } from "react";
import { Switch } from "../ui/Switch";
import { RISK_LABELS, ODD_TO_USD_RATE, MIN_BET_AMOUNT_ODD } from "@/lib/agent/mockData";

type Currency = "ODD" | "USD";

export function BehaviorTab() {
  const [risk, setRisk] = useState(4);
  const [betAmount, setBetAmount] = useState(1000);
  const [currency, setCurrency] = useState<Currency>("ODD");
  const [tiltBrakeEnabled, setTiltBrakeEnabled] = useState(true);

  const usdEquivalent = (betAmount * ODD_TO_USD_RATE).toFixed(0);

  return (
    <section className="rounded-lg bg-card border border-edge p-6">
      <header className="flex items-baseline gap-2 mb-6 pb-4 border-b border-edge">
        <span className="font-mono text-xs text-ink-3">04</span>
        <h2 className="text-base font-semibold">风险偏好与节制器</h2>
        <span className="text-xs text-ink-3 ml-2">AI 在你上头时拉住你</span>
      </header>

      <div className="grid grid-cols-[140px_1fr] gap-6 items-start mb-8">
        <div className="text-sm text-ink-2 pt-2">
          <div>风险偏好</div>
          <div className="text-xs text-ink-3 mt-0.5 font-normal">
            0–10 精细调节；越右越激进，AI 推仓位也越大
          </div>
        </div>
        <div className="max-w-md">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-sm">
              <span className="text-2xl font-bold text-accent">{risk}</span>
              <span className="text-ink-3"> / 10</span>
              <span className="text-ink-2 ml-2">· {RISK_LABELS[risk]}</span>
            </div>
            <div className="text-[10px] tracking-widest text-ink-3 font-mono">
              RISK PREFERENCE
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={risk}
            onChange={(e) => setRisk(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[10px] text-ink-3 mt-1 font-mono">
            {Array.from({ length: 11 }, (_, i) => (
              <span key={i}>{i}</span>
            ))}
          </div>
          <div className="flex justify-between text-xs text-ink-3 mt-1">
            <span>极度保守</span>
            <span>极度进取</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[140px_1fr] gap-6 items-start mb-8">
        <div className="text-sm text-ink-2 pt-2">
          <div>通常单注金额</div>
          <div className="text-xs text-ink-3 mt-0.5 font-normal">
            AI 用此作为「常规仓位」基准；最低起注 1,000 ODD
          </div>
        </div>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="number"
              value={betAmount}
              min={MIN_BET_AMOUNT_ODD}
              onChange={(e) => setBetAmount(Math.max(MIN_BET_AMOUNT_ODD, Number(e.target.value) || MIN_BET_AMOUNT_ODD))}
              className="w-32 bg-input border border-edge rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
            />
            <div className="inline-flex bg-elevated rounded-md p-0.5 border border-edge">
              {(["ODD", "USD"] as Currency[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-3 py-1 rounded text-xs transition-colors ${
                    currency === c
                      ? "bg-accent text-[#0a0e12] font-semibold"
                      : "text-ink-3 hover:text-ink-2"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <span className="text-xs text-ink-3">
              ≈ ${usdEquivalent} USD
            </span>
          </div>
          <div className="text-xs text-ink-3 mt-2">
            最小起注：<span className="text-ink-2 font-semibold">1,000 ODD ≈ $100</span>。换算汇率
            1 ODD = 0.10 USD（即时锁价由桥接层维护）。
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[140px_1fr] gap-6 items-start">
        <div className="text-sm text-ink-2 pt-1">
          <div>节制器</div>
          <div className="text-xs text-ink-3 mt-0.5 font-normal">
            命中 Tilt 信号时主动反向劝阻
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={tiltBrakeEnabled} onChange={setTiltBrakeEnabled} label="节制器开关" />
          <span className="text-xs text-ink-3">
            {tiltBrakeEnabled
              ? "已开启 · 命中 Tilt 时 AI 会主动劝阻"
              : "已关闭 · 不建议关闭，AI 不再发出反向劝阻"}
          </span>
        </div>
      </div>
    </section>
  );
}
