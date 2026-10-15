"use client";

import { memo, useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { TrashIcon } from "@phosphor-icons/react";
import { useBetSlipStore, selectHasConflict, selectTotalBet } from "@/stores/betSlipStore";
import { useLiveTotalOdds } from "@/hooks/useLiveTotalOdds";
import { formatAmount, isGt, convertOdd, div, add } from "@/lib/decimal";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import {
  MIN_BET_ODD,
  isStakeBelowMin,
  toOddAmount,
  isTestFixtureId,
} from "@/lib/betting/constants";
import { IS_SUBSCRIPTION_MODE } from "@/lib/subscription-mode";
import { toastError, toastSuccess } from "@/lib/toast";
import QuickAmountBar from "./QuickAmountBar";
import InsufficientFundsModal from "./InsufficientFundsModal";
import BetSlipAlert from "./BetSlipAlert";
import { useAuthStore } from "@/stores/authStore";
import { useWalletSheetStore } from "@/stores/walletSheetStore";
import { useAccountBalance } from "@/hooks/useAccountBalance";
import { useIdempotentRefId, useKeyedIdempotentRefId } from "@/hooks/useIdempotentRefId";
import { accountKeys } from "@/lib/query-keys";
import { placeBet, placeBannerBet } from "@/lib/api";
import { isBannerSelection } from "@/lib/banner-bet-mapper";
import { HTTPError } from "ky";
import { parseUnits } from "viem";
import {
  submitOnchainBetFromSelection,
  findOnchainMarket,
  selectionToOnchainOutcome,
  UnsupportedSelectionError,
  OnchainMarketNotFoundError,
} from "@/lib/betting/submit-onchain-from-selection";
import { refreshOffchainOdds } from "@/lib/betting/refresh-offchain-odds";
import { ensureBettingAllowance } from "@/lib/betting/ensure-betting-allowance";
import { previewSignal, getOnchainMarkets } from "@/lib/api";
import { ONCHAIN_MARKETS } from "@/lib/react-query-keys";
import type { QueryClient } from "@tanstack/react-query";
import type { OnchainMarketRes } from "@/types/onchain-betting";
import { ReceiptTimeoutError } from "@/lib/onchain/receipt-poller";
import { BetRevertedError, ApproveRevertedError } from "@/lib/betting/submit-onchain-bet";
import { decodeRevertedTx } from "@/lib/onchain/revert-decoder";
import { revertKindToI18nKey, formatRevertArgs } from "@/lib/betting/onchain-error-i18n";
import { buildPendingPortfolioBet } from "@/lib/adapters/pending-onchain-bet";
import { usePendingOnchainBetsStore } from "@/stores/pendingOnchainBetsStore";

/**
 * DD-117 §3.4 — submit 前抓 preview-signal 拿 lockedOddsBps + degraded。
 * 失败时返回 null，让下游 computeMinOddsBps 走 base_odds 兜底。
 * REV-v3 M-01：优先复用 React Query 缓存的 markets，避免 submit 时的 2N 请求。
 */
async function fetchPreviewForSelection(
  sel: BetSelection,
  stakeOdd: string,
  queryClient: QueryClient
): Promise<{
  lockedOddsBps: string | null;
  degraded: boolean;
  /** DD-119 P2 — 预期部分成交 */
  partialFill: boolean;
  /** DD-119 P2 — 预期成交额（ODD wei）；partial 时作为 min_accepted override */
  acceptedAmountWei: string;
} | null> {
  try {
    const cached = queryClient.getQueryData<OnchainMarketRes>(ONCHAIN_MARKETS(sel.fixtureId));
    const marketsRes: OnchainMarketRes =
      cached ??
      (await queryClient.fetchQuery<OnchainMarketRes>({
        queryKey: ONCHAIN_MARKETS(sel.fixtureId),
        queryFn: () => getOnchainMarkets(sel.fixtureId),
      }));
    const market = findOnchainMarket(marketsRes.markets, sel);
    const outcome = selectionToOnchainOutcome(sel);
    const amountWei = parseUnits(stakeOdd as `${number}`, 18).toString();
    const preview = await previewSignal(market.market_id, {
      outcome,
      requestedAmount: amountWei,
    });
    return {
      lockedOddsBps: preview.lockedOdds,
      degraded: preview.degraded === true,
      partialFill: preview.partialFill === true,
      acceptedAmountWei: preview.acceptedAmount,
    };
  } catch (e) {
    // 任何前置失败（UnsupportedSelection / market not found / 网络）→ null 兜底
    if (!(e instanceof UnsupportedSelectionError)) {
      console.warn("[BetSummary] preview-signal pre-submit failed, using base_odds", e);
    }
    return null;
  }
}
import type {
  PlaceBetReq,
  PlaceBannerBetReq,
  BetMarket,
  BetLabel,
  BetSelection,
} from "@/types/betting";
import { useQueryClient } from "@tanstack/react-query";
import { cacheSuccessfulBets } from "@/lib/recentBetsCache";

const MARKET_MAP: Record<BetSelection["marketType"], BetMarket> = {
  "1x2": "fulltime_result",
  asian_handicap: "asian_handicap",
  asian_total: "asian_over_under",
};

const selectionToMarket = (s: BetSelection): BetMarket => MARKET_MAP[s.marketType];
const selectionToLabel = (s: BetSelection): BetLabel => {
  switch (s.selection) {
    case "Home":
      return "1";
    case "Away":
      return "2";
    case "Draw":
      return "draw";
    case "Over":
      return "over";
    case "Under":
      return "under";
    default:
      throw new Error(`[BetSummary] Unknown selection: ${s.selection}`);
  }
};

interface BetSummaryProps {
  mobile?: boolean;
  insufficientFunds?: boolean;
  /** H5: close the BetSlip sheet so deposit/connect UI isn't obscured */
  onRequestClose?: () => void;
  onDeposit?: () => void;
}

function BetSummary({
  mobile,
  insufficientFunds: insufficientFundsProp,
  onRequestClose,
  onDeposit,
}: BetSummaryProps = {}) {
  const mode = useBetSlipStore((s) => s.mode);
  const selections = useBetSlipStore((s) => s.selections);
  const amounts = useBetSlipStore((s) => s.amounts);
  const multiAmount = useBetSlipStore((s) => s.multiAmount);
  const setMultiAmount = useBetSlipStore((s) => s.setMultiAmount);
  const clearAll = useBetSlipStore((s) => s.clearAll);
  // DD-119 P2 — 异常态底部告警条（超时/网络）
  const betAlert = useBetSlipStore((s) => s.betAlert);
  const setBetAlert = useBetSlipStore((s) => s.setBetAlert);

  const hasConflict = useBetSlipStore(selectHasConflict);
  // DD-118 Batch 5c — 串单总赔率/潜在收益走 WS live 重算（与单卡 live 赔率展示一致）
  const { liveTotalOdds: totalOdds, livePotentialWin: potentialWin } = useLiveTotalOdds();
  const totalBet = useBetSlipStore(selectTotalBet);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const triggerConnect = useWalletSheetStore((s) => s.triggerConnect);
  const queryClient = useQueryClient();
  const { data: accountBalance } = useAccountBalance();
  const balance = accountBalance?.available_balance ?? "0";
  const placingRef = useRef(false);
  // 下注幂等 key：网络错/超时/自动 retry 复用同一 uuid，拿到明确响应后清空切换下一笔
  // （banner / 中心化 offchain 分支用）
  const refId = useIdempotentRefId();
  // 链上下注 keyed 幂等 nonce：每腿 keyed by selection.id 稳定派生，失败腿重试 / idx 漂移
  // 都不变 nonce → 后端 place_bet 按 sha256(userID|amount|nonce) 去重，避免 MAX allowance 下双重下注。
  const onchainRefId = useKeyedIdempotentRefId();

  // betslip 清空（Clear All / 逐条移除 / 全成功）→ 同步清空 keyed nonce Map，
  // 防止失败后 clearAll 残留的孤儿 nonce 被「重新加同一选注 + 相同金额」复用 → 后端去重 → 静默不下单。
  // 失败腿仍在 betslip 时 length≠0 → 不触发，nonce 正常保留供重试（REV-v1-code-reviewer M-02）。
  const selectionCount = selections.length;
  useEffect(() => {
    if (selectionCount === 0) onchainRefId.clearAll();
  }, [selectionCount, onchainRefId]);

  const t = useTranslations("betSlip");
  const tt = useTranslations("toast");
  const tMarkets = useTranslations("markets");
  const [isPlacing, setIsPlacing] = useState(false);
  const [showFundsModal, setShowFundsModal] = useState(false);
  const { canConvert, hasRate, rate, convert, isUsd } = useCurrencyDisplay();
  const unitLabel = canConvert ? "USD" : PLATFORM_TOKEN_DISPLAY;
  // Convert user-entered amount (USD or ODD) → ODD for API submission（共用 lib/betting/constants）
  const toOdd = (userAmount: string): string => toOddAmount(userAmount, canConvert, rate);
  const effectiveBalance = canConvert ? convert(balance) : balance;

  const insufficientFunds =
    insufficientFundsProp ?? (isGt(totalBet, "0") && isGt(totalBet, effectiveBalance));

  // 任一 leg 折算后 < 100 ODD → 合约会以 BetAmountBelowMinimum revert，前端先拦截
  const belowMin =
    mode === "multi"
      ? isStakeBelowMin(toOdd(multiAmount))
      : selections.some((s) => isStakeBelowMin(toOdd(amounts[s.id] || "0")));

  // DD-117 — 任一 onchain selection 的信号灯禁用（red/degraded/error）即阻止 submit
  const signalDisabledById = useBetSlipStore((s) => s.signalDisabledById);
  const anySignalDisabled = selections.some((s) => signalDisabledById[s.id]);

  const canPlace =
    selections.length > 0 &&
    !(mode === "multi" && hasConflict) &&
    !isPlacing &&
    isGt(totalBet, "0") &&
    !insufficientFunds &&
    !belowMin &&
    !anySignalDisabled &&
    // DD-113: 认购模式冻结提交（按钮灰置 + handlePlaceBet 顶部短路兜底）
    !IS_SUBSCRIPTION_MODE;

  // Dual display: primary unit + secondary (opposite unit) in parentheses
  // totalBet / potentialWin 已经累加自用户输入（即当前 display unit），主展示直接用原值；
  // secondary 走对面单位换算：canConvert（USD 主显）→ div(USD, rate) = ODD；ODD 主显 → mul(ODD, rate) = USD
  const totalBetPrimary = formatAmount(totalBet, 2);
  const totalBetSecondary = hasRate
    ? canConvert
      ? formatAmount(div(totalBet || "0", rate as string), 2)
      : formatAmount(convertOdd(totalBet, rate), 2)
    : null;
  const potentialWinPrimary = formatAmount(potentialWin, 2);
  const potentialWinSecondary = hasRate
    ? canConvert
      ? formatAmount(div(potentialWin || "0", rate as string), 2)
      : formatAmount(convertOdd(potentialWin, rate), 2)
    : null;
  const secondaryUnit = canConvert ? PLATFORM_TOKEN_DISPLAY : "USD";
  const balancePrimary = formatAmount(isUsd && canConvert ? convert(balance) : balance, 2);

  const handlePlaceBet = async () => {
    if (placingRef.current) return;
    // DD-113: 认购模式短路 — 按钮已 disabled 兜底，防御性拦截避免任何路径触发下单
    if (IS_SUBSCRIPTION_MODE) return;
    // DD-117 §3.3 — 信号灯红灯/降级/错误 → 阻止下单（按钮 className 已置 disabled，此为防御性短路）
    if (anySignalDisabled) return;
    placingRef.current = true;
    setIsPlacing(true);
    // 新一轮提交先清旧告警条（重试时 reset；已成功的单靠 refId 幂等不重复提交）
    setBetAlert(null);

    // 1. 鉴权检查 — 未登录直接弹出钱包连接
    if (!isAuthenticated) {
      onRequestClose?.();
      triggerConnect();
      placingRef.current = false;
      setIsPlacing(false);
      return;
    }

    // 2. 前端余额预校验（totalBet 与 balance 统一在主单位下比较）
    if (isGt(totalBet, effectiveBalance)) {
      toastError(tt("insufficientBalance"), {
        actionLabel: tt("insufficientBalanceAction"),
        onAction: () => setShowFundsModal(true),
      });
      placingRef.current = false;
      setIsPlacing(false);
      return;
    }

    // 2.1 合约最低下注金额校验（折算到 ODD 后 < MIN_BET_ODD 直接拦截）
    if (belowMin) {
      toastError(
        canConvert && rate
          ? t("minBetWarning", {
              min: formatAmount(convertOdd(String(MIN_BET_ODD), rate), 2),
              symbol: "USD",
            })
          : t("minBetWarning", { min: MIN_BET_ODD, symbol: PLATFORM_TOKEN_DISPLAY })
      );
      placingRef.current = false;
      setIsPlacing(false);
      return;
    }

    // 2.5 Banner / Fixture 分流（DD-085 §3.5 #12）
    // banner 走 placeBannerBet（单 leg 一次调用，不支持 parlay），fixture 走 placeBet（支持 single/parlay）。
    // single 模式下两者可混合下注：分别请求各自后端，UI 合并展示。
    // multi 模式下混入 banner 直接拦截（banner 没有串关接口）。
    const bannerSelections = selections.filter(isBannerSelection);
    const fixtureSelections = selections.filter((s) => !isBannerSelection(s));

    if (mode === "multi" && bannerSelections.length > 0) {
      toastError("Banner bets are not supported in parlay mode");
      placingRef.current = false;
      setIsPlacing(false);
      return;
    }

    let bannerFailedCount = 0;
    let fixtureFailedCount = 0;
    let didPlaceAny = false;

    try {
      // 3. Banner 分支
      if (bannerSelections.length > 0) {
        didPlaceAny = true;
        try {
          const baseRefId = refId.getOrCreate();
          const results = await Promise.all(
            bannerSelections.map((sel, idx) => {
              const meta = sel.bannerMeta!;
              const req: PlaceBannerBetReq = {
                banner_code: meta.bannerId,
                market_id: meta.marketId,
                selection_id: meta.selectionId,
                market: meta.market,
                selection: sel.selection,
                stake: toOdd(amounts[sel.id] || "0"),
                odds: sel.odds,
                ref_id: `${baseRefId}-b${idx}`,
              };
              return placeBannerBet(req)
                .then((res) => ({ ok: true as const, sel, res }))
                .catch((e: unknown) => ({ ok: false as const, sel, error: e }));
            })
          );
          refId.clear();
          const succeeded = results.filter((r) => r.ok);
          const failed = results.filter((r) => !r.ok);
          for (const r of succeeded) {
            toastSuccess(
              tt("betSuccess", {
                amount: `${formatAmount(amounts[r.sel.id] || "0", 2)}${canConvert ? " USD" : ""}`,
                selection: r.sel.displayLabel,
                odds: formatAmount(r.sel.odds, 2),
              })
            );
            useBetSlipStore.getState().removeSelection(r.sel.id);
          }
          bannerFailedCount = failed.length;
          if (failed.length > 0) {
            // 后端常见 1001 INSUFFICIENT_BALANCE_OR_LOCK_ERROR 等已含 message，统一 betFailed toast
            toastError(tt("betFailed"));
          }
        } catch (e) {
          console.error("[BetSummary] Failed to place banner bet", e);
          toastError(tt("networkError") ?? "Network error, please try again");
          bannerFailedCount = bannerSelections.length;
        }
      }

      // 链上 reverted 失败统一处理：尝试 eth_call 重放拿 revert reason，按 kind 映射 i18n。
      // 失败 / 未知 selector / 无 publicClient 时 fallback 到通用 betFailed toast。
      const handleOnchainFailure = async (reason: unknown): Promise<void> => {
        if (reason instanceof ReceiptTimeoutError) {
          // 超时不等于失败：tx 可能已上链。专用文案引导去注单页看结果（REV-DD105-v1 M-01）
          toastError(tt("betPendingOnchain"));
          return;
        }
        if (reason instanceof OnchainMarketNotFoundError) {
          // BUG-021：展示线与链上盘错位（30s 缓存窗口内线刚下架/对齐前的旧选注）。
          // 立即作废该 fixture 的 onchain markets 缓存 → 卡片/详情页自动重新对齐展示线，
          // 避免用户在缓存过期前反复点击反复失败（REV-v1 critic Critical#1 自愈闭环）。
          void queryClient.invalidateQueries({ queryKey: ONCHAIN_MARKETS(reason.fixtureId) });
          toastError(tt("betFailed"));
          return;
        }
        if (reason instanceof BetRevertedError || reason instanceof ApproveRevertedError) {
          try {
            const decoded = await decodeRevertedTx(reason.txHash as `0x${string}`);
            if (decoded && decoded.kind !== "unknown") {
              // contract-panic 是合约内部断言失败（数组越界等），属链上 bug 非业务条件，
              // 友好 toast 之外仍记录 panic code + txHash 供 Sentry 排查（BUG-018）
              if (decoded.kind === "contract-panic") {
                console.error(
                  "[BetSummary] Onchain placeBet panic — likely contract/market-state bug",
                  { panicCode: decoded.args[0], txHash: reason.txHash }
                );
              }
              const key = revertKindToI18nKey(decoded.kind);
              const args = { ...formatRevertArgs(decoded), symbol: PLATFORM_TOKEN_DISPLAY };
              toastError(t(`error.${key}`, args));
              return;
            }
          } catch (e) {
            console.error("[BetSummary] revert decode failed", e);
          }
        }
        console.error("[BetSummary] Onchain bet failed", reason);
        toastError(tt("betFailed"));
      };

      // 4. Fixture 分支
      // DD-105/DD-147：single 模式真实赛事 → 走链上 onchain place_bet（testnet/mainnet 统一）。
      // 测试赛事（TEST_FIXTURE_IDS）强制走中心化 placeBet，便于 QA 演练。
      // parlay（串关）链上不支持 → 全部走中心化分支（中心化分支非死代码，parlay 依赖）。
      // 注：此处无需 bannerMeta 防卫 —— banner 已在上方第 §2.5 被 isBannerSelection 分流进
      // bannerSelections，fixtureSelections 不含 banner，故 goesOnchain 仅看 single/parlay 即可
      // （与 BetCard.tsx 的 signal-preview 门控需额外防 banner 穿透不同）。
      const goesOnchain = mode === "single";
      const onchainFixtureSelections = goesOnchain
        ? fixtureSelections.filter((s) => !isTestFixtureId(s.fixtureId))
        : [];
      const offchainFixtureSelections = goesOnchain
        ? fixtureSelections.filter((s) => isTestFixtureId(s.fixtureId))
        : fixtureSelections;

      if (onchainFixtureSelections.length > 0) {
        didPlaceAny = true;
        try {
          // DD-117/119：先并行抓 preview（lockedOdds/degraded + DD-119 P2 partialFill/acceptedAmount）
          const stakeOdds = onchainFixtureSelections.map((sel) => toOdd(amounts[sel.id] || "0"));
          const previews = await Promise.all(
            onchainFixtureSelections.map((sel, idx) =>
              fetchPreviewForSelection(sel, stakeOdds[idx], queryClient)
            )
          );
          // ENH-040 前置一次性确保 betting allowance（一次 approve 覆盖所有腿）：把 approve 从
          // per-leg 前置到这里 → 下方并行 place_bet 时 per-leg approve 因 allowance 已足额自动短路
          // （快）→ 所有 place_bet 200 ~同时返回 → 一起进 MyBets，消除「每腿各等自己 approve 上链
          // 回执」导致的逐条进 MyBets。amount 传所有腿之和（含税口径在 helper 内），后端实授 MAX。
          // 失败（approve revert / 回执超时）→ allowanceReady=false → 一笔都不提交，全部留在 slip。
          const totalStakeOdd = stakeOdds.reduce((acc, s) => add(acc, s), "0");
          let allowanceReady = true;
          try {
            await ensureBettingAllowance(totalStakeOdd);
          } catch (reason) {
            await handleOnchainFailure(reason);
            fixtureFailedCount += onchainFixtureSelections.length;
            allowanceReady = false;
          }
          // 并行提交（多腿同时 place_bet，耗时从 N×approve-receipt 压到 ≈1×）。背景：原串行根因
          // DD-138 BUG-002（多腿共用 proxy allowance 槽 + approve 覆盖式赋值）已由后端 MAX approve
          // 根治（oddfi-backend dev `6522755`）；approve 既已前置短路，此处只剩纯 place_bet 并发。
          // 共享热钱包 nonce 由 relay per-sponsor submitMu 锁串行广播（BUG-001 修复），并行无 race。
          // 叠加 DD-140 A1：每腿 place_bet relay 200 即乐观入 MyBets，bet receipt / 结算由
          // usePendingOnchainBets 后台跟踪，不阻塞 bet slip。
          // DD-119 P2 partial：仍传 minAccepted override 允许部分成交，真实剩余由 MyBets 权威卡
          // （refundAmount）呈现，不在此回填 betslip。
          // allowance 未就绪 → 空数组跳过全部腿（前置 approve 失败已计全失败 + 友好提示）。
          const legSelections = allowanceReady ? onchainFixtureSelections : [];
          const legResults = await Promise.all(
            legSelections.map(async (sel, idx) => {
              const pv = previews[idx];
              try {
                const res = await submitOnchainBetFromSelection({
                  selection: sel,
                  stakeOdd: stakeOdds[idx],
                  // 每腿 nonce keyed by selection.id（内容派生，重试/idx 漂移恒定），
                  // 失败腿重试复用同一 nonce → 后端去重；成功后下方 clear 释放。
                  // 注：amount 不计入 key —— 后端幂等键是 sha256(userID|amount|nonce)，amount 变化即
                  // 新键、后端不去重、正确放行（用户改金额=想下一笔不同的注）。若未来要按 amount 细粒度
                  // 去重需把 key 改为 `${sel.id}-${amount}`，属产品决策，勿擅自合入。
                  seq: onchainRefId.getOrCreate(sel.id),
                  lockedOddsBps: pv?.lockedOddsBps ?? null,
                  degraded: pv?.degraded,
                  minAcceptedWeiOverride: pv?.partialFill ? pv.acceptedAmountWei : undefined,
                  deferReceipt: true,
                });
                // 乐观入 MyBets：build 展示卡 + 入 pending store，从 betslip 移除该腿
                const now = Date.now();
                usePendingOnchainBetsStore.getState().add({
                  orderId: res.orderId,
                  txHash: res.betTxHash,
                  selection: sel,
                  bet: buildPendingPortfolioBet({
                    selection: sel,
                    stakeOdd: stakeOdds[idx],
                    rate: canConvert ? rate : null,
                    now,
                  }),
                  status: "pending",
                  createdAt: now,
                });
                // place_bet relay 200（拿到 order_id）= 该腿明确成功 → 释放其 nonce，
                // 下次同选注下注生成新 nonce（避免复用旧 nonce + 相同 amount 被后端误判去重）。
                onchainRefId.clear(sel.id);
                useBetSlipStore.getState().removeSelection(sel.id);
                // T1：提交成功（place_bet relay 200）→「下单成功，正在上链确认」；
                // 真正上链确认的 toast（T2）由 usePendingOnchainBets 跟踪到 confirmed 时弹
                toastSuccess(tt("betOnchainSubmitted", { selection: sel.displayLabel }));
                return true;
              } catch (reason) {
                // 失败腿：不 clear，保留其 nonce 供下次重试复用 → 后端按相同 nonce 去重
                // place_bet 200 之前失败（approve revert / 市场未找到 / relay 错误）→ 即时失败提示
                await handleOnchainFailure(reason);
                return false;
              }
            })
          );
          // 失败腿计数从结果聚合（避免在并行回调里读改同一闭包计数器）。
          // 注：不在此无条件 clear。每腿成功时已 onchainRefId.clear(sel.id) 释放；
          // 失败腿 nonce 故意保留，下次点击 Place Bet 重试时 getOrCreate(sel.id) 复用同一 nonce，
          // 后端 sha256(userID|amount|nonce) 去重 → 同一腿不会被重复上链（MAX allowance 下硬门控）。
          // 切到 MyBets + 保面板打开由下方统一收尾处理（didPlaceAny 且非全失败 → setActiveTab+setOpen），
          // 此处不重复（REV-v1-A Minor）。乐观注单已入 store，后台 tracker 跟踪状态。
          fixtureFailedCount += legResults.filter((ok) => !ok).length;
        } catch (e) {
          // 兜底：per-leg 链上 revert / 市场未找到已在上方循环内由 handleOnchainFailure 消化；
          // 此处仅捕获 preview 并行抓取等非 per-leg 的意外同步/异步异常（onchainRefId.getOrCreate 不抛）
          console.error("[BetSummary] Onchain bet path crashed", e);
          toastError(tt("betFailed"));
          fixtureFailedCount += onchainFixtureSelections.length;
        }
      }

      if (offchainFixtureSelections.length > 0) {
        didPlaceAny = true;
        try {
          // BUG-022：提交前用最新 SportMonks 赔率刷新快照（等价于"删除卡片再重新添加"），
          // 规避久置后快照与后端当前赔率漂移 > 0.05 触发 ODDS_CHANGED。
          // 取不到的腿回退快照（freshOdds.get(id) ?? s.odds），不阻断下注主流程。
          const freshOdds = await refreshOffchainOdds(offchainFixtureSelections);

          // 构造请求（ref_id 来自 useIdempotentRefId，挂起中复用，clear 后换新）
          const req: PlaceBetReq = {
            odd_ids: offchainFixtureSelections.map((s) => s.oddId),
            stakes:
              mode === "single"
                ? offchainFixtureSelections.map((s) => toOdd(amounts[s.id] || "0"))
                : offchainFixtureSelections.map(() => toOdd(multiAmount)), // parlay: 每 leg 传相同金额（后端要求等长）
            type: mode === "single" ? "single" : "parlay",
            market: offchainFixtureSelections.map(selectionToMarket),
            label: offchainFixtureSelections.map(selectionToLabel),
            // 1X2 玩法无盘口线，传 "0" 占位
            handicapline: offchainFixtureSelections.map((s) => s.handicap ?? s.total ?? "0"),
            odds: offchainFixtureSelections.map((s) => freshOdds.get(s.id) ?? s.odds),
            ref_id: refId.getOrCreate(),
          };

          const res = await placeBet(req);

          // 拿到明确响应 → 清 ref_id，下一次点击将生成新的
          refId.clear();

          // 响应分支处理
          switch (res.msg) {
            case "ALL_SUCCESS":
              cacheSuccessfulBets(res.results, offchainFixtureSelections);
              for (const sel of offchainFixtureSelections) {
                toastSuccess(
                  tt("betSuccess", {
                    amount: `${formatAmount(amounts[sel.id] || "0", 2)}${canConvert ? " USD" : ""}`,
                    selection:
                      sel.selection === "Draw"
                        ? `${sel.fixtureName} ${tMarkets("draw")}`
                        : sel.displayLabel,
                    odds: formatAmount(freshOdds.get(sel.id) ?? sel.odds, 2),
                  })
                );
                useBetSlipStore.getState().removeSelection(sel.id);
              }
              break;

            case "PARTIAL_SUCCESS": {
              const succeeded = res.results.filter((r) => r.status === "SUCCESS");
              const failed = res.results.filter((r) => r.status !== "SUCCESS");
              cacheSuccessfulBets(succeeded, offchainFixtureSelections);
              for (const r of succeeded) {
                const sel = offchainFixtureSelections.find((s) => s.oddId === r.odd_id);
                if (sel) {
                  useBetSlipStore.getState().removeSelection(sel.id);
                } else {
                  console.warn("[BetSummary] Cannot match odd_id from response", r.odd_id);
                }
              }
              toastError(
                tt("betPartialSuccess", { succeeded: succeeded.length, failed: failed.length })
              );
              fixtureFailedCount += failed.length;
              break;
            }

            case "FAILED":
              toastError(tt("betFailed"));
              fixtureFailedCount += offchainFixtureSelections.length;
              break;
          }
        } catch (e) {
          fixtureFailedCount += offchainFixtureSelections.length;
          if (e instanceof HTTPError) {
            // 后端有响应 → 清 ref_id，下一次点击生成新的
            refId.clear();
            if (e.response.status === 401) {
              toastError(tt("sessionExpired"));
            } else if (e.response.status === 400) {
              try {
                const body = await e.response.json();
                const errCode = body?.data?.err;
                if (errCode === "INSUFFICIENT_BALANCE") {
                  setShowFundsModal(true);
                } else {
                  toastError(tt("betFailed"));
                }
              } catch {
                toastError(tt("betFailed"));
              }
            } else {
              // 5xx / 其他 → 底部告警条可重试（PRD §异常场景）
              setBetAlert({ variant: "err", message: t("alertNetworkRetry") });
            }
          } else {
            // 网络/超时 → 保留 pendingRefIdRef，下一次点击复用以触发后端幂等
            // PRD §异常场景：底部告警条「网络异常，请稍后重试」红色可重试
            console.error("[BetSummary] Failed to place bet", e);
            setBetAlert({ variant: "err", message: t("alertNetworkRetry") });
          }
        }
      }

      // 5. 刷新余额 + 保持面板打开并切到 mybets tab
      // 下注成功后所有 selection 被 removeSelection 移除 → count 归 0，
      // removeSelection 会把 isOpen 置 false，PC 右栏/详情页面板均按 count/isOpen 决定挂载，
      // 仅 setActiveTab 无法阻止面板卸载。这里显式 setOpen(true) 让面板留在 My Bets。
      if (
        didPlaceAny &&
        bannerFailedCount + fixtureFailedCount < bannerSelections.length + fixtureSelections.length
      ) {
        queryClient.invalidateQueries({ queryKey: accountKeys.all });
        useBetSlipStore.getState().setActiveTab("mybets");
        useBetSlipStore.getState().setOpen(true);
      }
    } finally {
      placingRef.current = false;
      setIsPlacing(false);
    }
  };

  /* ---- Mobile layout ---- */
  if (mobile) {
    const txtSize = "text-[12px]";

    const handleClearAndClose = () => {
      clearAll();
      onRequestClose?.();
    };

    return (
      <div className="flex flex-col gap-[12px]">
        {/* Available Balance — moved from BetSlip header */}
        <div className="flex justify-between items-center">
          <span className={`text-secondary ${txtSize} font-normal`}>{t("availableBalance")}:</span>
          <div className="flex gap-[4px] items-center">
            <span className={`text-primary ${txtSize} font-semibold`}>{balancePrimary}</span>
            <span className={`text-tertiary ${txtSize} font-medium`}>{unitLabel}</span>
            {onDeposit && (
              <button type="button" onClick={onDeposit} aria-label="Deposit" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/deposit/add.svg" alt="" className="size-[16px]" />
              </button>
            )}
          </div>
        </div>

        {/* Multi mode: shared amount input */}
        {mode === "multi" && selections.length >= 2 && (
          <div className="flex flex-col gap-[12px]">
            <div className="bg-tertiary h-[40px] rounded-8 px-[16px] flex items-center justify-between">
              <input
                type="text"
                inputMode="decimal"
                placeholder={t("inputAmount")}
                value={multiAmount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d*$/.test(v)) setMultiAmount(v);
                }}
                className="bg-transparent text-primary text-[14px] placeholder:text-tertiary focus:outline-none w-full min-w-0"
              />
              <div className="flex items-center gap-[8px] shrink-0 ml-[8px]">
                <span className="text-primary text-[14px] font-medium">{unitLabel}</span>
                <button
                  type="button"
                  className="text-brand-default text-[14px] font-medium"
                  onClick={() => setMultiAmount(canConvert ? convert(balance) : balance)}
                >
                  {t("max")}
                </button>
              </div>
            </div>
            <QuickAmountBar currentAmount={multiAmount} onSelect={setMultiAmount} mobile />
          </div>
        )}

        {hasConflict && mode === "multi" && (
          <p className={`${txtSize} text-fn-red`}>{t("conflictWarning")}</p>
        )}

        {mode === "multi" && selections.length >= 2 && (
          <div className="flex justify-between items-center">
            <span className={`text-secondary ${txtSize} font-medium`}>{t("totalOdds")}</span>
            <span className={`text-brand-default ${txtSize} font-semibold`}>
              {formatAmount(totalOdds, 2)}
            </span>
          </div>
        )}

        {/* Total Bet */}
        <div className="flex justify-between items-center">
          <span className={`text-secondary ${txtSize} font-medium`}>{t("totalBet")}</span>
          <div className="flex gap-[4px] items-center">
            <span className={`text-primary ${txtSize} font-semibold`}>{totalBetPrimary}</span>
            <span className={`text-tertiary ${txtSize} font-medium`}>{unitLabel}</span>
          </div>
        </div>

        {/* Potential Win */}
        <div className="flex justify-between items-center">
          <span className={`text-secondary ${txtSize} font-medium`}>{t("potentialWin")}</span>
          <div className="flex gap-[4px] items-center">
            <span className={`text-primary ${txtSize} font-semibold`}>{potentialWinPrimary}</span>
            <span className={`text-tertiary ${txtSize} font-medium`}>{unitLabel}</span>
          </div>
        </div>

        {/* DD-119 P2 — 异常态底部告警条（按钮上方） */}
        {betAlert && <BetSlipAlert variant={betAlert.variant} message={betAlert.message} />}

        {/* Bottom row: trash (clear+close) + Place Bet */}
        <div className="flex gap-[12px] items-center mt-[4px]">
          <button
            type="button"
            onClick={handleClearAndClose}
            aria-label="Clear all selections"
            className="bg-btn-tertiary size-[40px] rounded-12 flex items-center justify-center shrink-0"
          >
            <TrashIcon size={18} className="text-primary" />
          </button>
          <button
            onClick={handlePlaceBet}
            className={`flex-1 h-[40px] bg-btn-primary-white rounded-12 text-static-black text-[14px] font-medium transition-colors ${!canPlace ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {/* DD-113: 认购模式下提交按钮文案改 Coming Soon */}
            {IS_SUBSCRIPTION_MODE ? "Coming Soon" : isPlacing ? t("confirming") : t("placeBet")}
          </button>
        </div>

        <InsufficientFundsModal
          isOpen={showFundsModal}
          onClose={() => setShowFundsModal(false)}
          required={totalBet}
          available={balance}
          onRequestClose={onRequestClose}
        />
      </div>
    );
  }

  /* ---- PC layout (Figma 647-58865 redesign) ---- */
  return (
    <div className="flex flex-col gap-[24px]">
      {/* Info section — Figma gap-12 */}
      <div className="flex flex-col gap-[12px]">
        {/* Multi mode: shared amount input + QuickAmountBar */}
        {mode === "multi" && selections.length >= 2 && (
          <div className="flex flex-col gap-[12px]">
            {/* @figma-hardcoded: #1c1c1f bet-input-bg — pending design token */}
            <div className="bg-[#1c1c1f] h-[48px] rounded-8 px-[16px] flex items-center justify-between">
              <input
                type="text"
                inputMode="decimal"
                placeholder={t("inputAmount")}
                value={multiAmount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d*$/.test(v)) setMultiAmount(v);
                }}
                className="bg-transparent text-primary text-[14px] placeholder:text-tertiary focus:outline-none w-full min-w-0"
              />
              <div className="flex items-center gap-[8px] shrink-0 ml-[8px]">
                <span className="text-primary text-[14px] font-medium">{unitLabel}</span>
                <button
                  type="button"
                  className="text-brand-default text-[14px] font-medium"
                  onClick={() => setMultiAmount(canConvert ? convert(balance) : balance)}
                >
                  {t("max")}
                </button>
              </div>
            </div>
            <QuickAmountBar currentAmount={multiAmount} onSelect={setMultiAmount} />
          </div>
        )}

        {/* Conflict warning */}
        {hasConflict && mode === "multi" && (
          <p className="text-[12px] text-fn-red">{t("conflictWarning")}</p>
        )}

        {/* Total Odds (multi mode only) */}
        {mode === "multi" && selections.length >= 2 && (
          <div className="flex justify-between items-center">
            <span className="text-secondary text-[14px] font-medium">{t("totalOdds")}</span>
            <span className="text-brand-default text-[14px] font-semibold">
              {formatAmount(totalOdds, 2)}
            </span>
          </div>
        )}

        {/* Available Balance — Figma 899:129997 */}
        <div className="flex justify-between items-center">
          <span className="text-secondary text-[14px]">{t("availableBalance")}</span>
          <div className="flex gap-[8px] items-center">
            <div className="flex gap-[4px] items-center">
              <span className="text-primary text-[14px] font-bold">{balancePrimary}</span>
              <span className="text-tertiary text-[14px] font-bold">{unitLabel}</span>
            </div>
            {onDeposit && (
              <button type="button" onClick={onDeposit} aria-label="Deposit" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/deposit/add.svg" alt="" className="size-[16px]" />
              </button>
            )}
          </div>
        </div>

        {/* Total Bet — primary unit + secondary (opposite) in parentheses */}
        <div className="flex justify-between items-center">
          <span className="text-secondary text-[14px]">{t("totalBet")}</span>
          <div className="flex gap-[8px] items-center">
            <div className="flex gap-[4px] items-center">
              <span className="text-primary text-[14px] font-bold">{totalBetPrimary}</span>
              <span className="text-tertiary text-[14px] font-bold">{unitLabel}</span>
            </div>
            {totalBetSecondary && !isUsd && (
              <span className="text-tertiary text-[12px] font-medium">
                ({"\u2248"}${totalBetSecondary} {secondaryUnit})
              </span>
            )}
          </div>
        </div>

        {/* Potential Win — primary unit + secondary (opposite) in parentheses */}
        <div className="flex justify-between items-center">
          <span className="text-secondary text-[14px]">{t("potentialWin")}</span>
          <div className="flex gap-[8px] items-center">
            <div className="flex gap-[4px] items-center">
              <span className="text-primary text-[14px] font-bold">{potentialWinPrimary}</span>
              <span className="text-tertiary text-[14px] font-bold">{unitLabel}</span>
            </div>
            {potentialWinSecondary && !isUsd && (
              <span className="text-tertiary text-[12px] font-medium">
                ({"\u2248"}${potentialWinSecondary} {secondaryUnit})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* DD-119 P2 — 异常态底部告警条（按钮上方） */}
      {betAlert && <BetSlipAlert variant={betAlert.variant} message={betAlert.message} />}

      {/* Bottom buttons — Figma 1440:81127: delete 48x48 + Place Bet flex-1 */}
      <div className="flex gap-[16px] items-start">
        <button
          type="button"
          onClick={clearAll}
          aria-label="Clear all selections"
          className="bg-btn-tertiary size-[48px] rounded-12 shadow-sm flex items-center justify-center shrink-0"
        >
          <TrashIcon size={20} className="text-primary" />
        </button>
        <button
          onClick={handlePlaceBet}
          className={`flex-1 h-[48px] rounded-12 text-static-black text-[14px] font-medium shadow-sm transition-colors ${!canPlace ? "bg-btn-primary-white-disable cursor-not-allowed" : "bg-btn-primary-white hover:bg-btn-primary-white-hover active:bg-btn-primary-white-press"}`}
        >
          {/* DD-113: 认购模式下提交按钮文案改 Coming Soon */}
          {IS_SUBSCRIPTION_MODE ? "Coming Soon" : isPlacing ? t("confirming") : t("placeBet")}
        </button>
      </div>

      <InsufficientFundsModal
        isOpen={showFundsModal}
        onClose={() => setShowFundsModal(false)}
        required={totalBet}
        available={balance}
        onRequestClose={onRequestClose}
      />
    </div>
  );
}

export default memo(BetSummary);
