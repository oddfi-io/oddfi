// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MyBetsView from "./MyBetsView";
import type { PortfolioHistoryRes } from "@/types/auth";
import { usePendingOnchainBetsStore } from "@/stores/pendingOnchainBetsStore";
import { useCashingOutBetsStore } from "@/stores/cashingOutBetsStore";
import type { PortfolioBet } from "@/types/portfolio";
import type { BetSelection } from "@/types/betting";

function addPending(o: {
  orderId: number;
  status: "pending" | "confirmed" | "failed";
  home: string;
  away: string;
  failReasonKey?: string;
  onchainBetId?: string;
}) {
  usePendingOnchainBetsStore.getState().add({
    orderId: o.orderId,
    txHash: `0x${o.orderId}`,
    selection: { id: `sel-${o.orderId}` } as BetSelection,
    bet: {
      id: `pending-${o.orderId}`,
      odds: "1.90",
      homeTeam: { name: o.home, iconUrl: "/x.svg" },
      awayTeam: { name: o.away, iconUrl: "/x.svg" },
    } as PortfolioBet,
    status: o.status,
    failReasonKey: o.failReasonKey,
    onchainBetId: o.onchainBetId,
    createdAt: o.orderId,
  });
}

// next-intl: t(key) → key（避免缺 provider 报错）
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// MyBetsView 取 rate 喂 ledgerToBet，MyBetCard 内 AmountValue 取 canConvert 决定主单位。
// 可变对象 + beforeEach 重置，便于单测内切换「rate 已加载」场景（BUG-028）
const mockCurrency = vi.hoisted(() => ({
  canConvert: false,
  hasRate: false,
  isUsd: false,
  rate: null as string | null,
}));
vi.mock("@/hooks/useCurrencyDisplay", () => ({
  useCurrencyDisplay: () => mockCurrency,
}));

// CashoutModal 间接依赖 useCancelBet (TanStack Query)；测试只关心列表渲染，stub 成空
vi.mock("@/components/portfolio/cashout/CashoutModal", () => ({
  default: () => null,
}));

vi.mock("@/hooks/usePortfolioHistory", () => ({
  usePortfolioHistory: vi.fn(),
}));

// 乐观链上注单跟踪 hook（内含 useQuery）—— 本测试聚焦列表渲染，stub 成 no-op
vi.mock("@/hooks/usePendingOnchainBets", () => ({
  usePendingOnchainBets: vi.fn(),
}));

import { usePortfolioHistory } from "@/hooks/usePortfolioHistory";

const mockUse = usePortfolioHistory as unknown as ReturnType<typeof vi.fn>;

function mockData(res: PortfolioHistoryRes | undefined, isLoading = false) {
  mockUse.mockReturnValue({ data: res, isLoading } as ReturnType<typeof usePortfolioHistory>);
}

describe("MyBetsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePendingOnchainBetsStore.getState().clear();
    useCashingOutBetsStore.getState().clear();
    Object.assign(mockCurrency, { canConvert: false, hasRate: false, isUsd: false, rate: null });
  });

  it("Loading 状态显示骨架提示", () => {
    mockData(undefined, true);
    render(<MyBetsView />);
    expect(screen.getByText("Loading bets...")).toBeTruthy();
  });

  it("空态显示 No active bets", () => {
    mockData({ total: 0, asset_ledgers: [] });
    render(<MyBetsView />);
    expect(screen.getByText("No active bets")).toBeTruthy();
  });

  it("渲染 PENDING 单注 bet（标题 + Blend 赔率）", () => {
    mockData({
      total: 1,
      asset_ledgers: [
        {
          business_type: "single",
          amount: "-100",
          ref_id: "BET-001",
          created_at: "2026-04-18T10:00:00Z",
          event_info: {
            odd_id: 42,
            stake: "100.00",
            status: "PENDING",
            type: "single",
            odds: "2.50",
            payout: "250.00",
            fixture_name: "Argentina vs Brazil",
            fixture_time: "2030-01-01T12:00:00Z",
            market_type: "Fulltime Result",
            selection: "Home",
          },
        },
      ],
    });
    render(<MyBetsView />);
    // MyBetCard 单注标题：`${home} VS ${away}`（大写 VS）
    expect(screen.getAllByText("Argentina VS Brazil").length).toBeGreaterThan(0);
    // Blend 行显示赔率
    expect(screen.getAllByText("2.50x").length).toBeGreaterThan(0);
    // Stats 五行 label —— mock 把 t(key) 直接返回 key
    expect(screen.getAllByText("blend").length).toBeGreaterThan(0);
    expect(screen.getAllByText("totalBet").length).toBeGreaterThan(0);
    expect(screen.getAllByText("potentialWin").length).toBeGreaterThan(0);
  });

  it("event_info == null 的记录被 filter 过滤掉", () => {
    mockData({
      total: 2,
      asset_ledgers: [
        {
          business_type: "withdraw",
          amount: "-500",
          event_info: null,
          created_at: "2026-04-18T10:00:00Z",
        },
        {
          business_type: "single",
          amount: "-100",
          ref_id: "BET-001",
          created_at: "2026-04-18T10:00:00Z",
          event_info: {
            odd_id: 42,
            stake: "100.00",
            status: "PENDING",
            type: "single",
            odds: "2.50",
            payout: "250.00",
            fixture_name: "A vs B",
            fixture_time: "2030-01-01T12:00:00Z",
            market_type: "FTR",
            selection: "Home",
          },
        },
      ],
    });
    render(<MyBetsView />);
    expect(screen.queryByText("No active bets")).toBeNull();
    expect(screen.getAllByText("A VS B").length).toBeGreaterThan(0);
  });

  // BUG-028: MyBetsView 曾给 ledgerToBet 传 rate=null → betAmountUsd 是未换算的 ODD 原值，
  // 而 AmountValue 因全局 rate 已加载（canConvert=true）把它标成 $，1000 ODD 显示成 $1,000。
  it("BUG-028: rate 已加载时卡片 USD 主值 = stake × rate（1000 ODD × 0.1 → $100.00）", () => {
    Object.assign(mockCurrency, { canConvert: true, hasRate: true, isUsd: true, rate: "0.1" });
    mockData({
      total: 1,
      asset_ledgers: [
        {
          business_type: "onchain_single",
          amount: "-1000",
          ref_id: "onchain:4171",
          bet_id: "0xBET4171",
          created_at: "2026-06-11T10:00:00Z",
          event_info: {
            odd_id: 1,
            stake: "1000",
            status: "PENDING",
            type: "single",
            odds: "1.88",
            payout: "1880",
            fixture_name: "Inter vs Milan",
            fixture_time: "2030-01-01T12:00:00Z",
            market_type: "FTR",
            selection: "Home",
          },
        },
      ],
    });
    render(<MyBetsView />);
    // bet.betAmountUsd = stake × rate = 1000 × 0.1 = $100.00
    // bet.potentialWinUsd = payout × rate = 1880 × 0.1 = $188.00
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$188.00").length).toBeGreaterThan(0);
    // 未换算的 ODD 原值不得作为 $ 主值出现
    expect(screen.queryByText("$1,000.00")).toBeNull();
    expect(screen.queryByText("$1,880.00")).toBeNull();
  });

  // ── DD-140 乐观链上注单 ──
  it("DD-140: confirmed 乐观单作为卡片展示（即使 history 为空）", () => {
    mockData({ total: 0, asset_ledgers: [] });
    addPending({ orderId: 1, status: "confirmed", home: "PSG", away: "Lyon" });
    render(<MyBetsView />);
    expect(screen.queryByText("No active bets")).toBeNull();
    expect(screen.getAllByText("PSG VS Lyon").length).toBeGreaterThan(0);
  });

  it("DD-140 B1: failed 乐观单显示失败原因 + 重投按钮", () => {
    mockData({ total: 0, asset_ledgers: [] });
    addPending({
      orderId: 2,
      status: "failed",
      home: "Roma",
      away: "Lazio",
      failReasonKey: "openPositionExceeded",
    });
    render(<MyBetsView />);
    // 失败卡标题 + reason（next-intl mock 把 t(key) 原样返回 → "error.openPositionExceeded"）
    expect(screen.getByText("Roma VS Lazio")).toBeTruthy();
    expect(screen.getByText("error.openPositionExceeded")).toBeTruthy();
    // 重投按钮文案 = markets.retry → mock 返回 "retry"
    expect(screen.getByText("retry")).toBeTruthy();
  });

  it("DD-140: 乐观单 onchainBetId 已在 history 中 → 去重不重复展示", () => {
    mockData({
      total: 1,
      asset_ledgers: [
        {
          business_type: "onchain_single",
          amount: "-100",
          ref_id: "BET-9",
          bet_id: "0xBET9",
          created_at: "2026-04-18T10:00:00Z",
          event_info: {
            odd_id: 9,
            stake: "100.00",
            status: "PENDING",
            type: "single",
            odds: "1.90",
            payout: "190.00",
            fixture_name: "Inter vs Milan",
            fixture_time: "2030-01-01T12:00:00Z",
            market_type: "FTR",
            selection: "Home",
          },
        },
      ],
    });
    // 同一注单的乐观记录已回填 onchainBetId=0xBET9 → 应被 history 去重
    addPending({
      orderId: 3,
      status: "confirmed",
      home: "Inter",
      away: "Milan",
      onchainBetId: "0xBET9",
    });
    render(<MyBetsView />);
    // 只剩 history 那张（来自 ledgerToBet），乐观卡被去重 → "Inter VS Milan" 仅 1 张
    expect(screen.getAllByText("Inter VS Milan").length).toBe(1);
  });

  it("BUG-024: onchainBetId 未回填时按 order_id 抑制 history 重复行（只剩乐观卡 + 上链中 badge）", () => {
    // history 已索引该 onchain 单（ref_id=onchain:777），但乐观单还没回填 onchainBetId（confirmed 但未对账）。
    // 旧逻辑只按 onchainBetId 去重 → 两边匹配不上 → 双卡；新逻辑按 order_id 抑制 history 行 → 仅乐观卡。
    mockData({
      total: 1,
      asset_ledgers: [
        {
          business_type: "onchain_single",
          amount: "-100",
          ref_id: "onchain:777",
          bet_id: "0xBET777",
          created_at: "2026-04-18T10:00:00Z",
          event_info: {
            odd_id: 7,
            stake: "100.00",
            status: "PENDING",
            type: "single",
            odds: "1.90",
            payout: "190.00",
            fixture_name: "Inter vs Milan",
            fixture_time: "2030-01-01T12:00:00Z",
            market_type: "FTR",
            selection: "Home",
          },
        },
      ],
    });
    // 乐观单 orderId=777 与 ref_id 的 order_id 对齐，但 onchainBetId 尚未回填
    addPending({ orderId: 777, status: "confirmed", home: "Inter", away: "Milan" });
    render(<MyBetsView />);
    // 恰好一张卡（history 同 order_id 行被抑制）
    expect(screen.getAllByText("Inter VS Milan").length).toBe(1);
    // 留下的是乐观卡 → 带「上链中」badge（next-intl mock 把 t("confirming") 原样返回）
    expect(screen.getAllByText("confirming").length).toBe(1);
  });

  it("ENH-038: 乐观「正在取消」标记的 active 行仍展示，但按钮禁用切「正在取消」（不隐藏）", () => {
    // history active 仍以旧数据返回该 onchain 单（后端 cash_out_state 回写未到），但 cashingOutBetsStore
    // 已乐观标记 → active 列表把该单标 cashing_out：卡片仍在、Cancel 按钮禁用并显示「正在取消」，
    // 杜绝「按钮仍可点 → 二次 Cancel → revert」。
    mockData({
      total: 1,
      asset_ledgers: [
        {
          business_type: "onchain_single",
          amount: "-100",
          ref_id: "onchain:42",
          bet_id: "0xCANCEL",
          created_at: "2026-04-18T10:00:00Z",
          event_info: {
            odd_id: 42,
            stake: "100.00",
            status: "PENDING",
            type: "single",
            odds: "1.90",
            payout: "190.00",
            fixture_name: "Bayern vs Dortmund",
            fixture_time: "2030-01-01T12:00:00Z",
            market_type: "FTR",
            selection: "Home",
          },
        },
      ],
    });
    useCashingOutBetsStore.getState().markCashingOut("0xCANCEL");
    render(<MyBetsView />);
    // 卡片仍展示（不隐藏）
    expect(screen.getAllByText("Bayern VS Dortmund").length).toBeGreaterThan(0);
    // 「正在取消」禁用按钮文案出现（next-intl mock 把 t("cancelling") 原样返回）
    expect(screen.getAllByText("cancelling").length).toBeGreaterThan(0);
    // 不再显示可点的 Cancel
    expect(screen.queryByText("cancelBet")).toBeNull();
  });

  it("ENH-038: 后端 cash_out_state=cashing_out 直接驱动禁用态（无需本地乐观标记）", () => {
    mockData({
      total: 1,
      asset_ledgers: [
        {
          business_type: "onchain_single",
          amount: "-100",
          ref_id: "onchain:88",
          bet_id: "0xBACKEND",
          created_at: "2026-04-18T10:00:00Z",
          event_info: {
            odd_id: 88,
            stake: "100.00",
            status: "PENDING",
            type: "single",
            odds: "1.90",
            payout: "190.00",
            fixture_name: "Ajax vs Feyenoord",
            fixture_time: "2030-01-01T12:00:00Z",
            market_type: "FTR",
            selection: "Home",
            cash_out_state: "cashing_out",
          },
        },
      ],
    });
    render(<MyBetsView />);
    expect(screen.getAllByText("Ajax VS Feyenoord").length).toBeGreaterThan(0);
    expect(screen.getAllByText("cancelling").length).toBeGreaterThan(0);
    expect(screen.queryByText("cancelBet")).toBeNull();
  });
});
