"use client";

import { useEffect, useMemo, useReducer, useState, useCallback } from "react";
import { addDays, format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import PortfolioSummary from "@/components/portfolio/PortfolioSummary";
import PortfolioTabs, { type PortfolioTab } from "@/components/portfolio/PortfolioTabs";
import BetsSwitcher, { type BetsView } from "@/components/portfolio/BetsSwitcher";
import ActiveBetsTable from "@/components/portfolio/bets/ActiveBetsTable";
import ActiveBetCard from "@/components/portfolio/bets/ActiveBetCard";
import SettledBetsTable from "@/components/portfolio/bets/SettledBetsTable";
import SettledBetCard from "@/components/portfolio/bets/SettledBetCard";
import BetsFilterBar, { type BetsFilterState } from "@/components/portfolio/bets/BetsFilterBar";
import LoadMoreButton from "@/components/portfolio/common/LoadMoreButton";
import {
  BETS_SORT_DEFAULT,
  toggleBetsSort,
  type BetsSortColumn,
  type BetsSortState,
} from "@/components/portfolio/bets/bets-sort";
import TransactionHistory from "@/components/portfolio/transactions/TransactionHistory";
import ClaimModal from "@/components/portfolio/claim/ClaimModal";
import ClaimSignatureModal from "@/components/portfolio/claim/ClaimSignatureModal";
import ClaimSuccessModal from "@/components/portfolio/claim/ClaimSuccessModal";
import WithdrawFormModal from "@/components/portfolio/withdraw/WithdrawFormModal";
import WithdrawResultModal from "@/components/portfolio/withdraw/WithdrawResultModal";
import GlobalDepositSheet from "@/components/deposit/GlobalDepositSheet";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { useClaimFlow } from "@/hooks/useClaimFlow";
import { useClaimBet } from "@/hooks/useClaimBet";
import { useOnchainClaim } from "@/hooks/useOnchainClaim";
import { useWithdrawFlow } from "@/hooks/useWithdrawFlow";
import { useWithdrawTx, type WithdrawErrorKey } from "@/hooks/useWithdrawTx";
import { useWithdrawStatus } from "@/hooks/useWithdrawStatus";
import { usePortfolioHistoryInfinite } from "@/hooks/usePortfolioHistoryInfinite";
import { ledgerToBet } from "@/lib/adapters/portfolio";
import { useCashingOutBetsStore, selectCashingOutByBetId } from "@/stores/cashingOutBetsStore";
import { statusToApiParams, type FilterStatus } from "@/lib/portfolio-filter";
import type { PortfolioBet } from "@/types/portfolio";

// 投注页 filter reducer — 与 BetsFilterBar.Patch 对齐
type FilterAction =
  | { search: string }
  | { status: FilterStatus }
  | { beginDate?: string; endDate?: string };

function makeInitialFilters(): BetsFilterState {
  const today = new Date();
  return {
    search: "",
    status: "all",
    beginDate: format(addDays(today, -30), "yyyy-MM-dd"),
    endDate: format(today, "yyyy-MM-dd"),
  };
}
const INITIAL_FILTERS = makeInitialFilters();

function filtersReducer(state: BetsFilterState, patch: FilterAction): BetsFilterState {
  return { ...state, ...patch };
}

export default function PortfolioPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const initialTab = (searchParams.get("tab") as PortfolioTab | null) ?? "bets";
  const [tab, setTab] = useState<PortfolioTab>(initialTab);
  const [betsView, setBetsView] = useState<BetsView>("active");
  const [betsFilters, dispatchFilter] = useReducer(filtersReducer, INITIAL_FILTERS);
  const [betsSort, setBetsSort] = useState<BetsSortState>(BETS_SORT_DEFAULT);
  const claim = useClaimFlow();
  // 签名弹窗"确认"→ 调 bet_claim → 成功后跳 success step
  const claimMutation = useClaimBet({ onSuccess: claim.goToSuccess });
  // DD-105 Batch 7 §c — 链上 Claim mutation,bet.isOnchain 时走这条
  // DD-141：claim 幂等键由后端按 bet_id 派生，前端不再需要 seq/useIdempotentRefId。
  const onchainClaimMutation = useOnchainClaim({
    onSuccess: () => {
      claim.goToSuccess();
    },
  });
  const withdraw = useWithdrawFlow();
  const withdrawTx = useWithdrawTx();
  const { rate } = useCurrencyDisplay();

  // DD-087 Batch 4：行级 Claim 入口 → 进入 useClaimFlow（reward 步骤）
  const handleOpenClaimModal = useCallback(
    (bet: PortfolioBet) => {
      claim.openWithBets([bet]);
    },
    [claim]
  );

  const handleSortToggle = useCallback((column: BetsSortColumn) => {
    setBetsSort((prev) => toggleBetsSort(prev, column));
  }, []);

  const handleFilterChange = useCallback((patch: FilterAction) => {
    dispatchFilter(patch);
  }, []);

  // 切换 Active/Settled 时同步 status：Active 必须无 type 参数，Settled 默认 bet_all
  useEffect(() => {
    if (betsView === "active" && betsFilters.status !== "all") {
      dispatchFilter({ status: "all" });
    } else if (betsView === "settled" && betsFilters.status === "all") {
      dispatchFilter({ status: "bet_all" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [betsView]);

  const sharedParams = {
    search: betsFilters.search || undefined,
    ...statusToApiParams(betsFilters.status),
    begin_date: betsFilters.beginDate,
    end_date: betsFilters.endDate,
    order_by: betsSort.orderBy,
    sort: betsSort.sort,
  };

  const activeQuery = usePortfolioHistoryInfinite(
    { tab: "active", ...sharedParams },
    { preset: "realtime" }
  );
  const settledQuery = usePortfolioHistoryInfinite({ tab: "settled", ...sharedParams });

  // ENH-038 — 撤单乐观「正在取消」（与 MyBetsView 同口径）：receipt 成功后、后端 cash_out_state 回写前，
  // 把该单提前标 cashing_out（ActiveBetCard 据此禁用 Cancel + 显示「正在取消」，而非隐藏）。
  const cashingOutByBetId = useCashingOutBetsStore(selectCashingOutByBetId);
  const removeManyCashingOut = useCashingOutBetsStore((s) => s.removeMany);
  // 原始 active 注单（未叠乐观态）—— 供 overlay 与 prune 共用，避免重复 map
  const rawActiveBets = useMemo<PortfolioBet[]>(() => {
    const records = activeQuery.data?.pages.flatMap((p) => p.asset_ledgers) ?? [];
    return records.map((r) => ledgerToBet(r, rate)).filter((b): b is PortfolioBet => b !== null);
  }, [activeQuery.data, rate]);
  const activeBets = useMemo<PortfolioBet[]>(
    () =>
      rawActiveBets.map((b) => {
        const optimisticCashingOut =
          !!b.onchainBetId && !!cashingOutByBetId[b.onchainBetId] && b.cashoutState === "none";
        return optimisticCashingOut
          ? { ...b, cashoutState: "cashing_out" as const, cashoutAvailable: false }
          : b;
      }),
    [rawActiveBets, cashingOutByBetId]
  );

  // ENH-038 — 乐观「正在取消」标记 prune（与 MyBetsView 同口径，REV-v1 M-01）：betId 离开 active（翻 CASHED_OUT
  // 移入 settled）或后端已自行回写 cashing_out（权威接管）即清理；否则超时回退 none 后本地标记残留会锁死按钮。
  useEffect(() => {
    const activeBetIds = new Set(
      rawActiveBets.map((b) => b.onchainBetId).filter((id): id is string => !!id)
    );
    const backendCashingOut = new Set(
      rawActiveBets
        .filter((b) => b.cashoutState === "cashing_out" && b.onchainBetId)
        .map((b) => b.onchainBetId as string)
    );
    const gone = Object.keys(cashingOutByBetId).filter(
      (id) => !activeBetIds.has(id) || backendCashingOut.has(id)
    );
    if (gone.length > 0) removeManyCashingOut(gone);
  }, [cashingOutByBetId, rawActiveBets, removeManyCashingOut]);

  const settledBets = useMemo<PortfolioBet[]>(() => {
    const records = settledQuery.data?.pages.flatMap((p) => p.asset_ledgers) ?? [];
    return records.map((r) => ledgerToBet(r, rate)).filter((b): b is PortfolioBet => b !== null);
  }, [settledQuery.data, rate]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/markets");
    }
  }, [isAuthenticated, router]);

  const isWithdrawSubmitting = withdrawTx.phase === "signing" || withdrawTx.phase === "submitting";

  const handleWithdrawContinue = useCallback(
    async (args: { address: string; amount: string }) => {
      await withdrawTx.execute(args);
      withdraw.goToResult();
    },
    [withdrawTx, withdraw]
  );

  const handleWithdrawClose = useCallback(() => {
    withdraw.close();
    withdrawTx.reset();
  }, [withdraw, withdrawTx]);

  const queryClient = useQueryClient();
  const handleWithdrawGoToHistory = useCallback(() => {
    // DD-123: 涵盖正常成功 + 409 nonce 重放（实际后端已落库）两种入口；
    // 主动 invalidate 整个 ["account", ...] 命名空间确保 balance / history / history-infinite 全刷
    queryClient.invalidateQueries({ queryKey: ["account"] });
    setTab("transactions");
    router.replace("/portfolio?tab=transactions");
    handleWithdrawClose();
  }, [queryClient, router, handleWithdrawClose]);

  // 轮询 apply 后订单的真实状态：仅在 result 弹窗打开且 apply 成功时开启
  // 终态 4/5/6（驳回/打款失败/用户取消）→ 切换到 failed variant；3 / 1-2 继续显示 success
  const pendingOrderSn =
    withdraw.isOpen && withdraw.step === "result" && withdrawTx.phase === "success"
      ? (withdrawTx.result?.order_sn ?? null)
      : null;
  const withdrawStatus = useWithdrawStatus(pendingOrderSn);

  const withdrawResultVariant: "success" | "failed" =
    withdrawTx.phase === "failed" || withdrawStatus.isFailed ? "failed" : "success";
  const withdrawResultErrorKey: WithdrawErrorKey | undefined =
    withdrawTx.errorKey ?? (withdrawStatus.isFailed ? "wdErrFailedDesc" : undefined);

  if (!isAuthenticated) return null;

  return (
    <div className="w-full max-w-[1200px] mx-auto px-[16px] lg:px-[24px] py-[24px] lg:py-[32px] flex flex-col gap-[24px] lg:gap-[32px]">
      <PortfolioSummary onWithdraw={withdraw.open} />

      {/* H5: Tabs + Switcher sticky below navbar / PC: normal flow */}
      <div className="sticky top-[64px] z-20 -mx-[16px] px-[16px] pb-[16px] bg-primary lg:static lg:mx-0 lg:px-0 lg:pb-0 lg:bg-transparent">
        <PortfolioTabs activeTab={tab} onTabChange={setTab} />
        {tab === "bets" && (
          <div className="mt-[16px] lg:mt-[24px]">
            <BetsSwitcher activeView={betsView} onViewChange={setBetsView} />
          </div>
        )}
      </div>

      {tab === "bets" && (
        <div className="flex flex-col gap-[16px] lg:gap-[24px]">
          <BetsFilterBar betsView={betsView} filters={betsFilters} onChange={handleFilterChange} />

          {betsView === "active" &&
            (activeQuery.isLoading && !activeQuery.data ? (
              <div className="flex flex-col gap-[16px] lg:gap-[24px]">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-[72px] rounded-8 bg-secondary animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* PC: Table */}
                <div className="hidden lg:block">
                  <ActiveBetsTable
                    bets={activeBets}
                    sort={betsSort}
                    onSortChange={handleSortToggle}
                  />
                </div>
                {/* H5: Card list */}
                <div className="flex lg:hidden flex-col gap-[12px]">
                  {activeBets.map((bet) => (
                    <ActiveBetCard key={bet.id} bet={bet} />
                  ))}
                </div>
                <LoadMoreButton
                  hasNextPage={activeQuery.hasNextPage}
                  isFetchingNextPage={activeQuery.isFetchingNextPage}
                  onLoadMore={() => activeQuery.fetchNextPage()}
                />
              </>
            ))}

          {betsView === "settled" &&
            (settledQuery.isLoading && !settledQuery.data ? (
              <div className="flex flex-col gap-[16px] lg:gap-[24px]">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-[72px] rounded-8 bg-secondary animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* PC: Table */}
                <div className="hidden lg:block">
                  <SettledBetsTable
                    bets={settledBets}
                    onClaim={handleOpenClaimModal}
                    sort={betsSort}
                    onSortChange={handleSortToggle}
                  />
                </div>
                {/* H5: Card list */}
                <div className="flex lg:hidden flex-col gap-[12px]">
                  {settledBets.map((bet) => (
                    <SettledBetCard key={bet.id} bet={bet} onClaim={handleOpenClaimModal} />
                  ))}
                </div>
                <LoadMoreButton
                  hasNextPage={settledQuery.hasNextPage}
                  isFetchingNextPage={settledQuery.isFetchingNextPage}
                  onLoadMore={() => settledQuery.fetchNextPage()}
                />
              </>
            ))}
        </div>
      )}

      {tab === "transactions" && <TransactionHistory />}

      {/* Claim flow modals — useClaimFlow 单源管理 reward → signature → success */}
      <ClaimModal
        isOpen={claim.isOpen && claim.step === "reward"}
        onClose={claim.close}
        bets={claim.bets}
        onConfirm={claim.goToSignature}
      />
      <ClaimSignatureModal
        isOpen={claim.isOpen && claim.step === "signature"}
        onClose={claim.close}
        onBack={claim.goBack}
        onConfirm={() => {
          const bet = claim.bets[0];
          if (!bet) return;
          // DD-105 Batch 7 §c — 链上注单走 submitOnchainClaim,链下走 claimPrize
          if (bet.isOnchain) {
            if (!bet.onchainBetId) return; // 事件索引未回填,按钮在外层已挡住,这里兜底
            onchainClaimMutation.mutate({
              betId: bet.onchainBetId,
            });
            return;
          }
          if (bet.betId == null) return;
          claimMutation.mutate({ bet_id: bet.betId });
        }}
        loading={claimMutation.isPending || onchainClaimMutation.isPending}
        bets={claim.bets}
      />
      <ClaimSuccessModal isOpen={claim.isOpen && claim.step === "success"} onClose={claim.close} />

      {/* Withdraw flow modals */}
      <WithdrawFormModal
        isOpen={withdraw.isOpen && withdraw.step === "form"}
        onClose={handleWithdrawClose}
        onContinue={handleWithdrawContinue}
        loading={isWithdrawSubmitting}
      />
      <WithdrawResultModal
        isOpen={withdraw.isOpen && withdraw.step === "result"}
        onClose={handleWithdrawClose}
        onGoToHistory={handleWithdrawGoToHistory}
        variant={withdrawResultVariant}
        result={withdrawTx.result}
        errorKey={withdrawResultErrorKey}
      />

      <GlobalDepositSheet />
    </div>
  );
}
