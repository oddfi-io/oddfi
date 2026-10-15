"use client";

/**
 * DD-119: 链上信号灯模拟浮窗（可拖拽，react-rnd）。
 *
 * 由 DevToolsModal 的「激活」开关控制挂载（signalSimActive）。激活后浮窗常驻页面、
 * 可拖到任意角落，便于一边操作注入、一边肉眼观察页面赔率格的实时刷新 / 涨跌闪烁 / 红灯锁定。
 *
 * 依赖 lib/ws/odds-ws.ts 的 dev-only injectMockOddsPush（生产构建 DCE 后 no-op）。
 * 拖拽复用 react-rnd（同 AiChatModal），不手写 pointer 拖拽逻辑。
 */

import { useEffect, useState } from "react";
import { Rnd } from "react-rnd";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { DotsSixIcon, XIcon } from "@phosphor-icons/react";

import { useDevToolsStore } from "@/stores/devToolsStore";
import { injectMockOddsPush, oddsWs } from "@/lib/ws/odds-ws";
import { onchainOddsStore } from "@/stores/onchainOddsStore";
import { formatContractOdds } from "@/lib/odds";
import type { SignalLevel, OnchainMarketRes } from "@/types/onchain-betting";
import type { SportmonksFixture } from "@/types/api";

const DRAG_HANDLE = "signal-sim-drag-handle";

const MARKET_TYPE_LABEL = ["1X2", "AH", "OU"] as const;

/**
 * dev-only：从 React Query 缓存拼 `marketId(小写) → "Home vs Away · 1X2"` 标签，
 * 让 sim 用比赛对决标题选场次而非裸 marketId。
 *
 * - marketId → fixture_id：扫 `["onchain-markets", *]` 缓存（OnchainMarket 带 fixture_id）
 * - fixture_id → 标题：形状嗅探整棵缓存（兼容分页 / 按日期等散落 query key），
 *   命中 `{ id:number, participants:[{name, meta.location}] }` 的对象即视为赛事
 */
function buildMarketTitleMap(qc: QueryClient): Map<string, string> {
  const titleByFixture = new Map<number, string>();
  const seen = new Set<unknown>();
  const walk = (node: unknown, depth: number): void => {
    if (!node || depth > 5 || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (typeof obj.id === "number" && Array.isArray(obj.participants)) {
      const fx = obj as unknown as SportmonksFixture;
      const home = fx.participants.find((p) => p.meta?.location === "home")?.name;
      const away = fx.participants.find((p) => p.meta?.location === "away")?.name;
      const title = home && away ? `${home} vs ${away}` : (fx.name ?? "");
      if (title && !titleByFixture.has(fx.id)) titleByFixture.set(fx.id, title);
    }
    for (const v of Object.values(obj)) walk(v, depth + 1);
  };
  for (const q of qc.getQueryCache().getAll()) walk(q.state.data, 0);

  const out = new Map<string, string>();
  for (const [, res] of qc.getQueriesData<OnchainMarketRes>({ queryKey: ["onchain-markets"] })) {
    if (!res?.markets) continue;
    for (const m of res.markets) {
      const title = titleByFixture.get(m.fixture_id);
      if (title) {
        const mt = MARKET_TYPE_LABEL[m.market_type] ?? `mt${m.market_type}`;
        out.set(m.market_id.toLowerCase(), `${title} · ${mt}`);
      }
    }
  }
  return out;
}

export function SignalLightSimFloating() {
  const setActive = useDevToolsStore((s) => s.setSignalSimActive);
  const qc = useQueryClient();

  // 周期性重读非响应式的订阅列表 / store 快照
  const [tick, setTick] = useState(0);
  const [simMarketId, setSimMarketId] = useState("");
  const mockEnabled =
    typeof window !== "undefined" &&
    typeof (window as unknown as { __oddsWsMock?: unknown }).__oddsWsMock !== "undefined";

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 800);
    return () => clearInterval(t);
  }, []);
  void tick;

  const subscribedIds = mockEnabled ? [...oddsWs.activeMarketIds] : [];
  const activeMid =
    simMarketId && subscribedIds.includes(simMarketId) ? simMarketId : (subscribedIds[0] ?? "");
  const entry = activeMid ? onchainOddsStore.getState().byMarketId[activeMid] : undefined;

  // 比赛对决标题（"Home vs Away · 1X2"）替代裸 marketId，便于挑场次测试；缓存未命中回退截断 id
  const titleMap = mockEnabled ? buildMarketTitleMap(qc) : new Map<string, string>();
  const labelFor = (mid: string) =>
    titleMap.get(mid.toLowerCase()) ?? `${mid.slice(0, 8)}…${mid.slice(-4)}`;

  const pushSignal = (signal: SignalLevel) => {
    if (!activeMid) return;
    injectMockOddsPush(activeMid, { signal });
    setTick((n) => n + 1);
  };

  const pushDelta = (factor: number) => {
    if (!activeMid) return;
    const cur = onchainOddsStore.getState().byMarketId[activeMid];
    const base = cur?.quotedOdds ?? ["20000", "20000"];
    // 万分位整数；下限钳到 1.01（10100）避免非法赔率
    const next = base.map((s) => String(Math.max(10100, Math.round(Number(s) * factor))));
    injectMockOddsPush(activeMid, { signal: 0, quotedOdds: next });
    setTick((n) => n + 1);
  };

  return (
    <Rnd
      default={{ x: 16, y: 88, width: 300, height: 392 }}
      minWidth={260}
      minHeight={300}
      bounds="window"
      dragHandleClassName={DRAG_HANDLE}
      enableResizing={false}
      className="z-50"
    >
      <div className="flex h-full w-full flex-col overflow-hidden rounded-12 border border-divider bg-secondary shadow-2xl">
        {/* 标题栏（拖拽手柄） */}
        <div
          className={`${DRAG_HANDLE} flex h-9 cursor-move select-none items-center justify-between bg-fill-input px-3`}
        >
          <div className="flex items-center gap-1.5">
            <DotsSixIcon size={14} weight="bold" className="text-tertiary" />
            <span className="text-[11px] font-semibold text-primary">信号灯模拟器</span>
          </div>
          <button
            onClick={() => setActive(false)}
            aria-label="关闭模拟器"
            className="flex h-6 w-6 items-center justify-center rounded-8 text-tertiary transition-colors hover:bg-fill-input-modal hover:text-primary"
            style={{ touchAction: "manipulation" }}
          >
            <XIcon size={14} weight="bold" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
          {!mockEnabled ? (
            <p className="font-mono text-[11px] text-fn-orange">
              当前构建未启用 mock 注入（仅 dev / testnet）
            </p>
          ) : subscribedIds.length === 0 ? (
            <p className="font-mono text-[11px] text-tertiary">
              无活跃订阅 —— 先打开带链上赔率的赛事页
            </p>
          ) : (
            <>
              <select
                value={activeMid}
                onChange={(e) => setSimMarketId(e.target.value)}
                className="h-9 w-full rounded-8 border border-divider bg-fill-input px-2 font-mono text-[11px] text-primary outline-none focus:border-fn-brand"
              >
                {subscribedIds.map((mid) => (
                  <option key={mid} value={mid}>
                    {labelFor(mid)}
                  </option>
                ))}
              </select>

              <p className="font-mono text-[11px] leading-relaxed text-tertiary">
                信号=<span className="text-primary">{entry ? entry.signal : "—"}</span>
                <br />
                quoted=
                <span className="text-primary">
                  {entry ? entry.quotedOdds.map(formatContractOdds).join(" / ") : "—"}
                </span>
                <br />
                mid=
                <span className="text-primary">
                  {activeMid ? `${activeMid.slice(0, 8)}…${activeMid.slice(-4)}` : "—"}
                </span>
                <br />共 {subscribedIds.length} 个订阅
              </p>

              {/* 信号灯：绿 / 黄 / 橙 / 红 */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => pushSignal(0)}
                  className="min-h-[36px] rounded-8 bg-fn-green text-[11px] font-semibold text-static-black transition-opacity hover:opacity-90"
                  style={{ touchAction: "manipulation" }}
                >
                  绿 0
                </button>
                <button
                  onClick={() => pushSignal(1)}
                  className="min-h-[36px] rounded-8 bg-fn-yellow text-[11px] font-semibold text-static-black transition-opacity hover:opacity-90"
                  style={{ touchAction: "manipulation" }}
                >
                  黄 1
                </button>
                <button
                  onClick={() => pushSignal(2)}
                  className="min-h-[36px] rounded-8 bg-fn-orange text-[11px] font-semibold text-static-black transition-opacity hover:opacity-90"
                  style={{ touchAction: "manipulation" }}
                >
                  橙 2
                </button>
                <button
                  onClick={() => pushSignal(3)}
                  className="min-h-[36px] rounded-8 bg-fn-red text-[11px] font-semibold text-static-black transition-opacity hover:opacity-90"
                  style={{ touchAction: "manipulation" }}
                >
                  红 3
                </button>
              </div>

              {/* 赔率涨跌 → 涨绿 / 跌红 闪烁 */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => pushDelta(1.08)}
                  className="min-h-[36px] rounded-8 border border-fn-green bg-fill-input text-[11px] font-semibold text-fn-green transition-colors hover:bg-fn-green/10"
                  style={{ touchAction: "manipulation" }}
                >
                  赔率 +8%
                </button>
                <button
                  onClick={() => pushDelta(0.92)}
                  className="min-h-[36px] rounded-8 border border-fn-red bg-fill-input text-[11px] font-semibold text-fn-red transition-colors hover:bg-fn-red/10"
                  style={{ touchAction: "manipulation" }}
                >
                  赔率 −8%
                </button>
              </div>

              <p className="text-[10px] leading-snug text-tertiary">
                拖动标题栏可移动。注入时观察页面赔率格 —— 信号 3（红灯）锁定为{" "}
                <span className="font-mono">--</span>，±8% 触发涨绿/跌红闪烁。
              </p>
            </>
          )}
        </div>
      </div>
    </Rnd>
  );
}
