// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useBetSlipStore } from "@/stores/betSlipStore";
import { usePendingOnchainBetsStore } from "@/stores/pendingOnchainBetsStore";
import type { BetSelection } from "@/types/betting";

// next-intl: t(key) → key（避免 provider）
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// 货币展示固定为单一单位
vi.mock("@/hooks/useCurrencyDisplay", () => ({
  useCurrencyDisplay: () => ({
    canConvert: false,
    hasRate: false,
    isUsd: false,
    rate: null,
    convert: (v: string) => v,
  }),
}));

// toast spy
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
vi.mock("@/lib/toast", () => ({
  toastError: (...args: unknown[]) => toastErrorMock(...args),
  toastSuccess: (...args: unknown[]) => toastSuccessMock(...args),
}));

// API spy
const placeBetMock = vi.fn();
const placeBannerBetMock = vi.fn();
const onchainApproveMock = vi.fn();
const onchainPlaceBetMock = vi.fn();
const getOnchainMarketsMock = vi.fn();
const previewSignalMock = vi.fn();
vi.mock("@/lib/api", () => ({
  placeBet: (...args: unknown[]) => placeBetMock(...args),
  placeBannerBet: (...args: unknown[]) => placeBannerBetMock(...args),
  onchainApprove: (...args: unknown[]) => onchainApproveMock(...args),
  onchainPlaceBet: (...args: unknown[]) => onchainPlaceBetMock(...args),
  getOnchainMarkets: (...args: unknown[]) => getOnchainMarketsMock(...args),
  previewSignal: (...args: unknown[]) => previewSignalMock(...args),
  // BUG-022：中心化下注提交前 refreshOffchainOdds 会调它；默认返回空 → 回退快照（不影响既有断言）
  getMarketFixtureDetail: () => Promise.resolve([]),
}));

// network-mode：默认 mainnet（仅 testnet-case 内动态切换）
// vi.hoisted 把 state holder 也提到 mock factory 之前，避开 TDZ
const { isTestnetState } = vi.hoisted(() => ({
  isTestnetState: { value: false },
}));
vi.mock("@/lib/network-mode", () => ({
  get IS_TESTNET() {
    return isTestnetState.value;
  },
  ACTIVE_NETWORK: "mainnet",
  ACTIVE_CORE_CHAIN: { id: 56 },
}));

// onchain submitter spy — 避开内部 receipt 轮询（在自己的单测里覆盖）
const submitOnchainBetFromSelectionMock = vi.fn();
vi.mock("@/lib/betting/submit-onchain-from-selection", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/betting/submit-onchain-from-selection")>();
  return {
    ...actual,
    submitOnchainBetFromSelection: (...args: unknown[]) =>
      submitOnchainBetFromSelectionMock(...args),
  };
});

// ENH-040 前置 approve spy — 默认（clearAllMocks 后）返回 undefined → await 即成功（allowance 就绪）；
// 失败用例用 mockRejectedValueOnce 模拟前置 approve revert/超时。
const ensureBettingAllowanceMock = vi.fn();
vi.mock("@/lib/betting/ensure-betting-allowance", () => ({
  ensureBettingAllowance: (...args: unknown[]) => ensureBettingAllowanceMock(...args),
}));

// 缓存命中数据（成功后会被调用）
vi.mock("@/lib/recentBetsCache", () => ({
  cacheSuccessfulBets: vi.fn(),
}));

// 余额充足，避免 insufficientFunds 拦截
vi.mock("@/hooks/useAccountBalance", () => ({
  useAccountBalance: () => ({ data: { available_balance: "10000" } }),
}));

// QueryClient 桩（仅 invalidateQueries 被使用）
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  // DD-118 Batch 5c — useLiveTotalOdds 走 useQueries 拿 onchain markets；本测试不走 live 路径
  useQueries: () => [],
}));

// DD-118 Batch 5c — short-circuit live recalc to keep BetSummary tests focused on submit flow
vi.mock("@/hooks/useLiveTotalOdds", () => ({
  useLiveTotalOdds: () => ({
    liveTotalOdds: "1",
    livePotentialWin: "0",
    hasLiveDeviation: false,
  }),
}));

vi.mock("@/stores/walletSheetStore", () => ({
  useWalletSheetStore: (selector: (s: { triggerConnect: () => void }) => unknown) =>
    selector({ triggerConnect: () => {} }),
}));

// 已登录态
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
}));

// 幂等 ref id
vi.mock("@/hooks/useIdempotentRefId", () => ({
  useIdempotentRefId: () => ({
    getOrCreate: () => "ref-test",
    clear: vi.fn(),
  }),
  // 链上分支用 keyed 变体：按 selection.id 派生稳定 nonce（测试中回显 key 便于断言稳定性）
  useKeyedIdempotentRefId: () => ({
    getOrCreate: (key: string) => `ref-${key}`,
    clear: vi.fn(),
    clearAll: vi.fn(),
  }),
}));

// InsufficientFundsModal 是 portal 子组件，stub 掉避免渲染分支干扰
vi.mock("./InsufficientFundsModal", () => ({
  default: () => null,
}));

// QuickAmountBar 在 multi 模式不渲染，single 模式渲染但只读取 amount —— 简单 stub
vi.mock("./QuickAmountBar", () => ({
  default: () => null,
}));

import BetSummary from "./BetSummary";

const fixtureSelection: BetSelection = {
  id: "fix-1",
  oddId: 1001,
  fixtureId: 11,
  fixtureName: "Argentina vs Brazil",
  leagueName: "World Cup",
  marketType: "1x2",
  marketDescription: "Fulltime Result",
  selection: "Home",
  displayLabel: "Argentina",
  odds: "1.85",
};

// DD-147：single 真实赛事在两网都走链上，中心化 placeBet 仅由测试赛事（TEST_FIXTURE_IDS）触发。
// 需要断言中心化 placeBet 的用例改用此测试赛事 selection。
const testFixtureSelection: BetSelection = {
  id: "fix-1",
  oddId: 1001,
  fixtureId: 99200001, // TEST_FIXTURE_IDS member → 强制中心化 placeBet
  fixtureName: "Argentina vs Brazil",
  leagueName: "World Cup",
  marketType: "1x2",
  marketDescription: "Fulltime Result",
  selection: "Home",
  displayLabel: "Argentina",
  odds: "1.85",
};

const bannerSelection: BetSelection = {
  id: "bnr-1",
  oddId: 9001,
  fixtureId: 0,
  fixtureName: "World Cup Champion",
  leagueName: "World Cup",
  marketType: "1x2",
  marketDescription: "Champion Winner",
  selection: "Argentina",
  displayLabel: "Argentina to win",
  odds: "3.20",
  bannerMeta: {
    bannerId: "bnr_world_cup_champion",
    marketId: 1,
    selectionId: 1,
    market: "champion_winner",
  },
};

function seedStore(selections: BetSelection[], mode: "single" | "multi" = "single") {
  useBetSlipStore.setState({
    selections,
    amounts: Object.fromEntries(selections.map((s) => [s.id, "100"])),
    multiAmount: "100",
    mode,
    isOpen: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useBetSlipStore.getState().clearAll();
  useBetSlipStore.setState({ mode: "single", isOpen: true, activeTab: "betslip" });
  usePendingOnchainBetsStore.getState().clear();
  isTestnetState.value = false; // 每个 case 默认 mainnet；testnet describe 内部覆盖为 true
});

describe("BetSummary handlePlaceBet — banner / fixture 分流", () => {
  it("single 模式仅测试赛事 fixture：只调用 placeBet，不调用 placeBannerBet", async () => {
    placeBetMock.mockResolvedValue({
      msg: "ALL_SUCCESS",
      results: [{ odd_id: 1001, bet_id: 1, status: "SUCCESS" }],
    });
    seedStore([testFixtureSelection]);
    render(<BetSummary mobile />);
    fireEvent.click(screen.getByText("placeBet"));
    await waitFor(() => expect(placeBetMock).toHaveBeenCalledTimes(1));
    expect(placeBannerBetMock).not.toHaveBeenCalled();
    // DD-147：测试赛事强制中心化，不走链上 submit
    expect(submitOnchainBetFromSelectionMock).not.toHaveBeenCalled();
  });

  it("single 模式仅 banner：只调用 placeBannerBet，不调用 placeBet", async () => {
    placeBannerBetMock.mockResolvedValue({ bet_id: 9, status: "SUCCESS" });
    seedStore([bannerSelection]);
    render(<BetSummary mobile />);
    fireEvent.click(screen.getByText("placeBet"));
    await waitFor(() => expect(placeBannerBetMock).toHaveBeenCalledTimes(1));
    expect(placeBetMock).not.toHaveBeenCalled();
  });

  it("single 模式 banner+fixture 混合：两个 API 都被调用，不再展示『Cannot mix』错误", async () => {
    placeBetMock.mockResolvedValue({
      msg: "ALL_SUCCESS",
      results: [{ odd_id: 1001, bet_id: 1, status: "SUCCESS" }],
    });
    placeBannerBetMock.mockResolvedValue({ bet_id: 9, status: "SUCCESS" });
    // fixture 腿用测试赛事，保持走中心化 placeBet（DD-147 后真实赛事 single 走链上）
    seedStore([bannerSelection, testFixtureSelection]);
    render(<BetSummary mobile />);
    fireEvent.click(screen.getByText("placeBet"));

    await waitFor(() => {
      expect(placeBannerBetMock).toHaveBeenCalledTimes(1);
      expect(placeBetMock).toHaveBeenCalledTimes(1);
    });

    // banner 请求体
    const bannerReq = placeBannerBetMock.mock.calls[0][0];
    expect(bannerReq.banner_code).toBe("bnr_world_cup_champion");
    // fixture 请求体仅包含 fixture leg
    const fixtureReq = placeBetMock.mock.calls[0][0];
    expect(fixtureReq.odd_ids).toEqual([1001]);
    expect(fixtureReq.type).toBe("single");

    // 不再吐出旧文案
    const errorMsgs = toastErrorMock.mock.calls.map((c) => c[0]);
    expect(
      errorMsgs.some((m: unknown) => typeof m === "string" && /mix banner and fixture/i.test(m))
    ).toBe(false);
  });

  it("multi 模式 banner+fixture 混合：拦截，两个 API 都不被调用", async () => {
    seedStore([bannerSelection, fixtureSelection], "multi");
    render(<BetSummary mobile />);
    fireEvent.click(screen.getByText("placeBet"));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(placeBannerBetMock).not.toHaveBeenCalled();
    expect(placeBetMock).not.toHaveBeenCalled();
    const firstMsg = toastErrorMock.mock.calls[0][0];
    expect(typeof firstMsg).toBe("string");
    expect(firstMsg).toMatch(/parlay/i);
  });

  it("multi 模式仅 banner：拦截，placeBannerBet 不被调用", async () => {
    const banner2: BetSelection = {
      ...bannerSelection,
      id: "bnr-2",
      oddId: 9002,
      fixtureId: 1, // 避开 hasConflict（同 fixtureId 触发冲突）
    };
    seedStore([bannerSelection, banner2], "multi");
    render(<BetSummary mobile />);
    fireEvent.click(screen.getByText("placeBet"));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(placeBannerBetMock).not.toHaveBeenCalled();
  });
});

// ============================================================
// DD-147: 两网统一链上分流（mainnet 也走链上，删除 IS_TESTNET 业务闸）
// ============================================================

describe("BetSummary handlePlaceBet — DD-147 两网统一链上分流", () => {
  beforeEach(() => {
    // 关键回归：mainnet（IS_TESTNET=false）下 single 真实赛事也必须走链上
    isTestnetState.value = false;
  });

  it("mainnet + single + 真实赛事: 走 onchain deferReceipt，乐观入 MyBets + 切 tab，不调 placeBet", async () => {
    submitOnchainBetFromSelectionMock.mockResolvedValueOnce({
      approveTxHash: "0xAAA",
      betTxHash: "0xBBB",
      orderId: 777,
    });
    seedStore([fixtureSelection], "single");
    render(<BetSummary mobile />);
    fireEvent.click(screen.getByText("placeBet"));

    await waitFor(() => expect(submitOnchainBetFromSelectionMock).toHaveBeenCalled());
    expect(placeBetMock).not.toHaveBeenCalled();
    const call = submitOnchainBetFromSelectionMock.mock.calls[0][0];
    expect(call.selection.fixtureId).toBe(11);
    expect(call.stakeOdd).toBe("100");
    // nonce 按 selection.id 稳定派生（keyed mock 回显 key）→ 重试/idx 漂移恒定，后端可去重
    expect(call.seq).toBe(`ref-${fixtureSelection.id}`);
    // DD-127：approve 不再透传 spender 地址，target 在 submit 内部固定 "betting"
    expect(call.spender).toBeUndefined();
    // DD-140 A1：deferReceipt 模式 + place_bet 200 即乐观入 pending store + 切到 MyBets tab
    expect(call.deferReceipt).toBe(true);
    await waitFor(() =>
      expect(usePendingOnchainBetsStore.getState().byOrderId[777]?.status).toBe("pending")
    );
    expect(useBetSlipStore.getState().activeTab).toBe("mybets");
    // 提交后该腿从投注车移除
    expect(useBetSlipStore.getState().selections).toHaveLength(0);
    // T1：提交成功弹「下单成功，正在上链确认」toast（t mock 返回 key）
    expect(toastSuccessMock).toHaveBeenCalledWith("betOnchainSubmitted");
  });

  it("multi mode（串关）: 不走 onchain，走中心化 placeBet 路径", async () => {
    placeBetMock.mockResolvedValueOnce({ msg: "ALL_SUCCESS", results: [] });
    const fix2: BetSelection = { ...fixtureSelection, id: "fix-2", oddId: 1002, fixtureId: 12 };
    seedStore([fixtureSelection, fix2], "multi");
    render(<BetSummary mobile />);
    fireEvent.click(screen.getByText("placeBet"));

    await waitFor(() => expect(placeBetMock).toHaveBeenCalled());
    expect(submitOnchainBetFromSelectionMock).not.toHaveBeenCalled();
  });

  it("banner: 仍走中心化 placeBannerBet（链上不支持 banner）", async () => {
    placeBannerBetMock.mockResolvedValueOnce({
      bet_id: 1,
      status: "SUCCESS",
      banner_code: "x",
      market_id: 1,
      selection_id: 1,
      stake: "100",
      odds: "3.2",
      payout: "320",
    });
    seedStore([bannerSelection], "single");
    render(<BetSummary mobile />);
    fireEvent.click(screen.getByText("placeBet"));

    await waitFor(() => expect(placeBannerBetMock).toHaveBeenCalled());
    expect(submitOnchainBetFromSelectionMock).not.toHaveBeenCalled();
  });

  it("single 真实赛事链上失败: 触发 toastError 而非 success", async () => {
    submitOnchainBetFromSelectionMock.mockRejectedValueOnce(new Error("revert"));
    seedStore([fixtureSelection], "single");
    render(<BetSummary mobile />);
    fireEvent.click(screen.getByText("placeBet"));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  // ─── 多腿链上并行提交（后端 MAX approve 根治 BUG-002 后恢复并行） ─────────────
  it("多腿 onchain 并行提交 —— 第二腿无需等第一腿 resolve 即提交", async () => {
    // 第一腿返回受控 deferred 始终挂起；并行下第二腿应在第一腿未 resolve 时就已提交。
    // （串行实现会卡在第一腿，第二腿永不被调用 → 该断言失败，反向锁住并行行为）
    let resolveFirst!: (v: { approveTxHash: string; betTxHash: string; orderId: number }) => void;
    const firstPending = new Promise<{
      approveTxHash: string;
      betTxHash: string;
      orderId: number;
    }>((res) => {
      resolveFirst = res;
    });
    submitOnchainBetFromSelectionMock
      .mockReturnValueOnce(firstPending)
      .mockResolvedValueOnce({ approveTxHash: "0xC2", betTxHash: "0xD2", orderId: 888 });

    const fix2: BetSelection = { ...fixtureSelection, id: "fix-2", oddId: 1002, fixtureId: 12 };
    seedStore([fixtureSelection, fix2], "single");
    render(<BetSummary mobile />);
    fireEvent.click(screen.getByText("placeBet"));

    // 并行：第一腿仍挂起时，第二腿已并发提交 → 两腿都被调用
    await waitFor(() => expect(submitOnchainBetFromSelectionMock).toHaveBeenCalledTimes(2));

    // 收尾：resolve 第一腿，避免悬挂 promise 泄漏到后续用例
    resolveFirst({ approveTxHash: "0xC1", betTxHash: "0xD1", orderId: 999 });
  });

  // ─── ENH-040 前置 approve 门控 ───────────────────────────────────────────
  it("ENH-040: 前置 ensureBettingAllowance 失败 → 一笔 place_bet 都不提交，弹错误", async () => {
    ensureBettingAllowanceMock.mockRejectedValueOnce(new Error("approve revert"));
    const fix2: BetSelection = { ...fixtureSelection, id: "fix-2", oddId: 1002, fixtureId: 12 };
    seedStore([fixtureSelection, fix2], "single");
    render(<BetSummary mobile />);
    fireEvent.click(screen.getByText("placeBet"));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    // 前置 approve 失败 → 跳过全部腿的 place_bet
    expect(submitOnchainBetFromSelectionMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
    // 两腿都留在 betslip（一笔都没提交）
    expect(useBetSlipStore.getState().selections).toHaveLength(2);
  });

  // ─── DD-117 §3.3 信号灯门控 ─────────────────────────────────────────────
  it("DD-117: signalDisabledById 命中任一 selection → submit 拦截，不调 onchain submit", async () => {
    seedStore([fixtureSelection], "single");
    useBetSlipStore.setState({ signalDisabledById: { [fixtureSelection.id]: true } });
    render(<BetSummary mobile />);
    fireEvent.click(screen.getByText("placeBet"));

    // 等一个 tick 给可能的 async 路径机会执行
    await new Promise((r) => setTimeout(r, 0));
    expect(submitOnchainBetFromSelectionMock).not.toHaveBeenCalled();
    expect(placeBetMock).not.toHaveBeenCalled();
  });

  it("DD-117: signalDisabledById 全为 false → submit 正常走 onchain", async () => {
    submitOnchainBetFromSelectionMock.mockResolvedValueOnce({
      approveTxHash: "0xAAA",
      betTxHash: "0xBBB",
    });
    seedStore([fixtureSelection], "single");
    useBetSlipStore.setState({ signalDisabledById: { [fixtureSelection.id]: false } });
    render(<BetSummary mobile />);
    fireEvent.click(screen.getByText("placeBet"));

    await waitFor(() => expect(submitOnchainBetFromSelectionMock).toHaveBeenCalled());
  });
});

describe("BetSummary handlePlaceBet — DD-119 P2 异常告警条", () => {
  it("placeBet 网络异常 → 设置底部告警条（err），渲染 BetSlipAlert", async () => {
    placeBetMock.mockRejectedValueOnce(new Error("network down"));
    // betAlert 仅由中心化 placeBet 错误分支设置 → 用测试赛事保持走中心化路径（DD-147）
    seedStore([testFixtureSelection], "single");
    render(<BetSummary />);
    fireEvent.click(screen.getByText("placeBet"));

    await waitFor(() =>
      expect(useBetSlipStore.getState().betAlert).toEqual({
        variant: "err",
        message: "alertNetworkRetry",
      })
    );
    expect(screen.getByRole("alert").getAttribute("data-variant")).toBe("err");
  });

  it("重新提交时先清除旧告警条", async () => {
    useBetSlipStore.setState({ betAlert: { variant: "err", message: "old" } });
    placeBetMock.mockResolvedValueOnce({ msg: "ALL_SUCCESS", results: [] });
    seedStore([testFixtureSelection], "single");
    render(<BetSummary />);
    fireEvent.click(screen.getByText("placeBet"));

    await waitFor(() => expect(placeBetMock).toHaveBeenCalled());
    expect(useBetSlipStore.getState().betAlert).toBeNull();
  });
});
