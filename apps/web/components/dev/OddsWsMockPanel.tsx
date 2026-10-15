/**
 * DD-118 Batch 5a — Dev-only floating panel for injecting fake odds pushes.
 *
 * Renders ONLY when `?mockOddsWs=1` is present in URL AND NODE_ENV !== production.
 * The mount-site guard in `app/providers.tsx` already DCE's the import in
 * production builds; the URL flag is a runtime convenience to keep dev workflows
 * unaffected unless explicitly opted in.
 *
 * Usage:
 *   pnpm dev:testnet → http://localhost:4002/...?mockOddsWs=1
 *   Open a chain-market detail page (so a WS subscribe fires) → panel lists the
 *   subscribed marketId. Click ↑ / ↓ / 🎲 to inject a synthetic push.
 */
"use client";

import { useEffect, useState } from "react";
import { oddsWs, injectMockOddsPush } from "@/lib/ws/odds-ws";
import { onchainOddsStore } from "@/stores/onchainOddsStore";

const UP_FACTOR = 1.05;
const DOWN_FACTOR = 0.95;
const MIN_RAW = 10_000; // 1.00x — contract floor

type Direction = "up" | "down" | "random";

function applyFactor(raw: string[], factor: number): string[] {
  return raw.map((s) => {
    const n = Math.max(MIN_RAW, Math.round(Number(s) * factor));
    return n.toString();
  });
}

export function OddsWsMockPanel() {
  const [enabled, setEnabled] = useState(false);
  const [marketIds, setMarketIds] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = new URLSearchParams(window.location.search).get("mockOddsWs");
    setEnabled(flag === "1");
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => setMarketIds(Array.from(oddsWs.activeMarketIds));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  const handlePush = (mid: string, dir: Direction) => {
    const factor =
      dir === "up"
        ? UP_FACTOR
        : dir === "down"
          ? DOWN_FACTOR
          : Math.random() > 0.5
            ? UP_FACTOR
            : DOWN_FACTOR;
    const entry = onchainOddsStore.getState().byMarketId[mid];
    const baseQuoted = entry?.quotedOdds ?? ["20000", "20000"];
    const newQuoted = applyFactor(baseQuoted, factor);
    injectMockOddsPush(mid, { quotedOdds: newQuoted });
  };

  return (
    <div
      data-testid="odds-ws-mock-panel"
      className="fixed bottom-4 right-4 z-[9999] max-w-[320px] rounded-lg border border-divider bg-secondary p-3 text-xs font-mono shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-bold text-primary">🧪 OddsWs Mock ({marketIds.length})</span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-secondary hover:text-primary"
          aria-label={collapsed ? "展开" : "折叠"}
        >
          {collapsed ? "▢" : "—"}
        </button>
      </div>
      {!collapsed && (
        <>
          {marketIds.length === 0 ? (
            <div className="text-tertiary">无已订阅市场。打开链上市场详情页或列表以订阅。</div>
          ) : (
            <ul className="max-h-[300px] space-y-2 overflow-y-auto">
              {marketIds.map((mid) => (
                <li key={mid} className="border-b border-divider pb-2 last:border-b-0">
                  <div
                    className="truncate text-[10px] text-secondary"
                    title={mid}
                  >{`${mid.slice(0, 10)}…${mid.slice(-6)}`}</div>
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      onClick={() => handlePush(mid, "up")}
                      className="rounded bg-fn-green/20 px-2 py-1 text-green hover:bg-fn-green/30"
                      data-testid={`mock-up-${mid}`}
                    >
                      ↑ +5%
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePush(mid, "down")}
                      className="rounded bg-fn-red/20 px-2 py-1 text-red hover:bg-fn-red/30"
                      data-testid={`mock-down-${mid}`}
                    >
                      ↓ -5%
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePush(mid, "random")}
                      className="rounded bg-tertiary px-2 py-1 text-primary hover:bg-fill-card2"
                      data-testid={`mock-random-${mid}`}
                    >
                      🎲
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
