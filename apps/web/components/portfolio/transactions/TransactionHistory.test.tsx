// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import TransactionHistory from "./TransactionHistory";
import type { PortfolioHistoryRes } from "@/types/auth";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

vi.mock("@/hooks/useCurrencyDisplay", () => ({
  useCurrencyDisplay: () => ({ rate: null, displayCurrency: "ODD" }),
}));

vi.mock("@/hooks/usePortfolioHistoryInfinite", () => ({
  usePortfolioHistoryInfinite: vi.fn(),
}));

vi.mock("@/lib/market-type-i18n", () => ({
  translateMarketType: (t: (k: string) => string, m: string) => m,
}));

vi.mock("./TransactionRow", () => ({
  default: ({ tx }: { tx: { id: string } }) => <div data-testid={`row-${tx.id}`}>row</div>,
}));

vi.mock("./TransactionCard", () => ({
  default: ({ tx }: { tx: { id: string } }) => <div data-testid={`card-${tx.id}`}>card</div>,
}));

vi.mock("@/components/portfolio/common/StatusFilterMenu", () => ({
  default: () => <div data-testid="filter-menu" />,
}));

vi.mock("./TransactionDateRange", () => ({
  default: () => <div data-testid="date-range" />,
}));

import { usePortfolioHistoryInfinite } from "@/hooks/usePortfolioHistoryInfinite";
const mockUse = usePortfolioHistoryInfinite as unknown as ReturnType<typeof vi.fn>;

function mockHook(opts: {
  page?: PortfolioHistoryRes;
  isLoading?: boolean;
  isError?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: ReturnType<typeof vi.fn>;
}) {
  mockUse.mockReturnValue({
    data: opts.page ? { pages: [opts.page], pageParams: [1] } : undefined,
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
    hasNextPage: opts.hasNextPage ?? false,
    isFetchingNextPage: opts.isFetchingNextPage ?? false,
    fetchNextPage: opts.fetchNextPage ?? vi.fn(),
  } as unknown as ReturnType<typeof usePortfolioHistoryInfinite>);
}

const sampleLedger: PortfolioHistoryRes = {
  total: 1,
  asset_ledgers: [
    {
      business_type: "single",
      amount: "-100",
      ref_id: "TX-001",
      created_at: "2026-04-18T10:00:00Z",
      event_info: {
        odd_id: 1,
        stake: "100",
        status: "PENDING",
        type: "single",
        odds: "2.00",
        payout: "200",
        fixture_name: "A vs B",
        fixture_time: "2030-01-01T00:00:00Z",
        market_type: "FTR",
        selection: "Home",
      },
    },
  ],
};

describe("TransactionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("Loading 显示骨架屏", () => {
    mockHook({ isLoading: true });
    render(<TransactionHistory />);
    expect(
      screen.getAllByRole("generic").some((el) => el.className.includes("animate-pulse"))
    ).toBe(true);
  });

  it("空态（默认日期筛选）显示 noResult 翻译 key", () => {
    mockHook({ page: { total: 0, asset_ledgers: [] } });
    render(<TransactionHistory />);
    // makeInitialFilters() 默认带 beginDate/endDate，hasActiveFilter=true → t("noResult")
    expect(screen.getByText("noResult")).toBeTruthy();
  });

  it("渲染交易记录", () => {
    mockHook({ page: sampleLedger });
    render(<TransactionHistory />);
    // adapter id 拼 ref_id-business_type-created_at 兜底唯一（防后端 ref_id 重复）
    expect(screen.getAllByTestId("row-TX-001-single-2026-04-18T10:00:00Z").length).toBeGreaterThan(
      0
    );
  });

  it("搜索输入 debounce 300ms 后才向 hook 传入新 search", () => {
    mockHook({ page: { total: 0, asset_ledgers: [] } });
    render(<TransactionHistory />);
    mockUse.mockClear();

    const input = screen.getByPlaceholderText("searchPlaceholder") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "arg" } });
    expect(input.value).toBe("arg");

    act(() => void vi.advanceTimersByTime(200));
    expect(mockUse).not.toHaveBeenCalledWith(expect.objectContaining({ search: "arg" }));

    act(() => void vi.advanceTimersByTime(200));
    const lastCall = mockUse.mock.calls.at(-1);
    expect(lastCall?.[0]).toMatchObject({ search: "arg" });
  });

  it("hasNextPage 时显示 Load more 按钮，点击触发 fetchNextPage", () => {
    const fetchNext = vi.fn();
    mockHook({ page: sampleLedger, hasNextPage: true, fetchNextPage: fetchNext });
    render(<TransactionHistory />);
    const btn = screen.getByText("loadMore");
    fireEvent.click(btn);
    expect(fetchNext).toHaveBeenCalled();
  });

  it("isError 显示错误文案", () => {
    mockHook({ isError: true });
    render(<TransactionHistory />);
    expect(screen.getByText(/Failed to load/i)).toBeTruthy();
  });
});
