"use client";

import { memo, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { usePortfolioHistory } from "@/hooks/usePortfolioHistory";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { ledgerToBet } from "@/lib/adapters/portfolio";
import { formatMatchTitle } from "@/lib/format/fixture";
import type { PortfolioBet } from "@/types/portfolio";
import { useBetSlipStore } from "@/stores/betSlipStore";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import {
  usePendingOnchainBetsStore,
  selectPendingByOrderId,
  toPendingBetList,
  type PendingOnchainBet,
} from "@/stores/pendingOnchainBetsStore";
import { useCashingOutBetsStore, selectCashingOutByBetId } from "@/stores/cashingOutBetsStore";
import MyBetCard from "./MyBetCard";

// ─── MyBetsView ──────────────────────────────────────────────────────────────
// BetSlip 侧边栏 My Bets 标签页。
// 数据源 = 乐观链上注单（pendingOnchainBetsStore，DD-140）∪ 后端 portfolio history
//   （GET /account/portfolio/history tab=active，DD-073 §3.5）。
// 链上 place_bet relay 200 即乐观入此列表（置顶），由 usePendingOnchainBets 后台跟踪
//   confirmed/failed；事件索引把注单回填进 history（onchainBetId 匹配）后丢弃乐观记录。
// 每张稳态卡由 MyBetCard 像素还原（Figma 3474:80595 / 80644 / 80653），内部自管 CashoutModal。

interface MyBetsViewProps {
  mobile?: boolean;
}

function MyBetsView({ mobile }: MyBetsViewProps) {
  // 注：乐观注单后台跟踪 hook usePendingOnchainBets 挂在父级 BetSlip（跨 tab 常驻，
  // 不随 MyBets/BetSlip tab 切换卸载而中断跟踪 —— REV-v1-A M-01）。

  const { data, isLoading } = usePortfolioHistory(
    { tab: "active", page_size: 50 },
    { preset: "realtime" }
  );

  const byOrderId = usePendingOnchainBetsStore(selectPendingByOrderId);
  const removePending = usePendingOnchainBetsStore((s) => s.remove);
  const removeManyPending = usePendingOnchainBetsStore((s) => s.removeMany);
  const cashingOutByBetId = useCashingOutBetsStore(selectCashingOutByBetId);
  const removeManyCashingOut = useCashingOutBetsStore((s) => s.removeMany);
  const addSelection = useBetSlipStore((s) => s.addSelection);

  // BUG-028 — rate 必须传入 ledgerToBet：传 null 时 convertOdd 按降级约定原样返回 ODD 值，
  // 而 MyBetCard 的 AmountValue 因全局 rate 已加载（canConvert=true）会把它标成 $ 主值，
  // 1000 ODD 被显示成 $1,000（与 PortfolioPageClient 同一 adapter 的正确用法对齐）
  const { rate } = useCurrencyDisplay();
  const historyBets = useMemo(() => {
    const records = data?.asset_ledgers ?? [];
    return records.map((r) => ledgerToBet(r, rate)).filter((b): b is PortfolioBet => b !== null);
  }, [data, rate]);

  // 后端已索引的链上注单 betId 集合 —— 乐观记录据此去重（history 为权威）
  const historyBetIds = useMemo(
    () => new Set(historyBets.map((b) => b.onchainBetId).filter((id): id is string => !!id)),
    [historyBets]
  );

  // 单次派生 toPendingBetList，再一次性分流为「已对账 id」与「待展示」，避免重复遍历+排序
  const allPending = useMemo(() => toPendingBetList(byOrderId), [byOrderId]);
  const reconciledIds = useMemo(
    () =>
      allPending
        .filter((p) => p.onchainBetId && historyBetIds.has(p.onchainBetId))
        .map((p) => p.orderId),
    [allPending, historyBetIds]
  );
  // 已被 history 接管的乐观单不再展示
  const pendingBets = useMemo(() => {
    const drop = new Set(reconciledIds);
    return allPending.filter((p) => !drop.has(p.orderId));
  }, [allPending, reconciledIds]);

  // BUG-024 — 乐观卡为准的去重：history 中 order_id 命中乐观单的行先抑制，避免「乐观卡 + history 卡」
  // 双卡闪烁（onchainBetId 回填慢于 history 出现，但 order_id 两侧即时可得）。乐观卡按 onchainBetId
  // 对账退场后，该 history 行自然解除抑制、接管稳态展示，全程恰好一张。
  const pendingOrderIds = useMemo(() => new Set(allPending.map((p) => p.orderId)), [allPending]);
  const visibleHistoryBets = useMemo(
    () =>
      historyBets.filter((b) => b.onchainOrderId == null || !pendingOrderIds.has(b.onchainOrderId)),
    [historyBets, pendingOrderIds]
  );

  // ENH-038 — 撤单乐观「正在取消」：撤单 receipt 成功后、后端 cash_out_state 回写 cashing_out 前
  // （refetch 往返窗口），active 仍以旧数据（cash_out_state=none、可点）返回；据本地乐观集合把该单
  // 提前标为 cashing_out（按钮禁用 + 显示「正在取消」），杜绝「按钮仍可点 → 二次 Cancel → 链上 revert」。
  // 后端回写 cashing_out 后即接管展示（同一视觉），cashed_out 终态则由后端移出 active。
  const activeHistoryBets = useMemo(
    () =>
      visibleHistoryBets.map((b) => {
        const optimisticCashingOut =
          !!b.onchainBetId && !!cashingOutByBetId[b.onchainBetId] && b.cashoutState === "none";
        return optimisticCashingOut
          ? { ...b, cashoutState: "cashing_out" as const, cashoutAvailable: false }
          : b;
      }),
    [visibleHistoryBets, cashingOutByBetId]
  );

  // 已对账（history 已含）的乐观单从 store 批量清理，避免内存累积（一次 removeMany，
  // 不逐个 remove 触发 O(n) 重渲染 —— REV-v1-A M-03）
  useEffect(() => {
    if (reconciledIds.length > 0) removeManyPending(reconciledIds);
  }, [reconciledIds, removeManyPending]);

  // ENH-038 — 乐观「正在取消」标记清理（桥接完成即退场）：
  //   (a) betId 已离开 active（后端翻 CASHED_OUT 移入 settled）；或
  //   (b) 后端 cash_out_state 已自行回写 cashing_out（权威接管，本地桥接无需再持有）。
  useEffect(() => {
    const backendCashingOut = new Set(
      historyBets
        .filter((b) => b.cashoutState === "cashing_out" && b.onchainBetId)
        .map((b) => b.onchainBetId as string)
    );
    const gone = Object.keys(cashingOutByBetId).filter(
      (id) => !historyBetIds.has(id) || backendCashingOut.has(id)
    );
    if (gone.length > 0) removeManyCashingOut(gone);
  }, [cashingOutByBetId, historyBetIds, historyBets, removeManyCashingOut]);

  const handleRetry = (p: PendingOnchainBet) => {
    // 加回 betslip（addSelection 内部切回 betslip tab）并移除失败的乐观卡
    addSelection(p.selection);
    removePending(p.orderId);
  };

  const hasAny = pendingBets.length > 0 || activeHistoryBets.length > 0;

  return (
    <div className="flex flex-col gap-[16px] flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-[12px]">
        {isLoading && !hasAny ? (
          <div className="flex flex-col items-center justify-center py-[40px]">
            <p className="text-secondary text-[14px]">Loading bets...</p>
          </div>
        ) : !hasAny ? (
          <div className="flex flex-col items-center justify-center py-[40px]">
            <p className="text-secondary text-[14px]">No active bets</p>
            <p className="text-tertiary text-[12px] mt-[4px]">Place a bet to see it here</p>
          </div>
        ) : (
          <>
            {/* 乐观链上注单（置顶，newest-first）：active → MyBetCard（打「上链中」badge），failed → 失败卡 */}
            {pendingBets.map((p) =>
              p.status === "failed" ? (
                <FailedPendingCard key={p.orderId} pending={p} onRetry={() => handleRetry(p)} />
              ) : (
                <MyBetCard key={p.orderId} bet={{ ...p.bet, confirming: true }} mobile={mobile} />
              )
            )}
            {/* 后端权威稳态注单（已抑制与乐观卡重复的同 order_id 行；撤单中行标 cashing_out 禁用 Cancel） */}
            {activeHistoryBets.map((bet) => (
              <MyBetCard key={bet.id} bet={bet} mobile={mobile} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── 链上下注失败卡（DD-140 B1）：展示 revert 原因 + 重投 ─────────────────────────
function FailedPendingCard({
  pending,
  onRetry,
}: {
  pending: PendingOnchainBet;
  onRetry: () => void;
}) {
  const t = useTranslations("betSlip");
  const tt = useTranslations("toast");
  const tMarkets = useTranslations("markets");
  const { bet, failReasonKey, failReasonArgs } = pending;
  // openPositionExceeded 等文案含 {symbol} 占位（与 BetSummary handleOnchainFailure 同口径）
  const reason = failReasonKey
    ? t(`error.${failReasonKey}`, { ...failReasonArgs, symbol: PLATFORM_TOKEN_DISPLAY })
    : tt("betFailed");

  return (
    <div className="bg-fill-card1 rounded-16 border border-dt-error p-[16px] flex flex-col gap-[12px] shrink-0">
      <p className="text-[14px] font-semibold leading-[19px] text-primary truncate">
        {formatMatchTitle(bet.homeTeam.name, bet.awayTeam.name)}
      </p>
      <p className="text-[13px] leading-[18px] text-red">{reason}</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-[44px] rounded-12 bg-btn-secondary flex items-center justify-center touch-manipulation"
        style={{ touchAction: "manipulation" }}
      >
        <span className="text-[14px] font-medium leading-[19px] text-primary">
          {tMarkets("retry")}
        </span>
      </button>
    </div>
  );
}

export default memo(MyBetsView);
