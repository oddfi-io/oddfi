// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import BannerTabs from "./BannerTabs";
import type { HomeBannerData } from "@/types/home-banner";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn() }),
}));

const mockUseMarketBanners = vi.fn();
vi.mock("@/hooks/useMarketBanners", () => ({
  useMarketBanners: () => mockUseMarketBanners(),
}));

const makeBanner = (
  template_id: HomeBannerData["template_id"],
  tag_text: string
): HomeBannerData => ({
  banner_id: `bnr_${template_id}`,
  template_id,
  sort_order: 1,
  is_active: true,
  tag_text,
  tag_color: "#000",
  title: "T",
  subtitle: null,
  decoration_key: "k",
  items: [],
});

describe("BannerTabs", () => {
  beforeEach(() => {
    // 默认：list 接口返回 zh tag_text（验证 i18n 数据驱动）
    mockUseMarketBanners.mockReturnValue({
      data: [
        makeBanner("top_wins_the_world_cup", "热门市场"),
        makeBanner("total_goals", "球员特别"),
        makeBanner("top_golden_ball_name", "金球奖"),
        makeBanner("top_golden_boot_name", "金靴奖"),
        makeBanner("top_golden_glove_name", "金手套奖"),
      ],
    });
  });

  afterEach(() => {
    cleanup();
    mockPush.mockClear();
    mockUseMarketBanners.mockReset();
  });

  it("使用 list 接口返回的 tag_text 作为 tab label（i18n 数据驱动）", () => {
    mockUseMarketBanners.mockReturnValue({
      data: [
        makeBanner("top_wins_the_world_cup", "热门市场"),
        makeBanner("total_goals", "球员特别"),
        makeBanner("top_golden_ball_name", "金球奖"),
        makeBanner("top_golden_boot_name", "金靴奖"),
        makeBanner("top_golden_glove_name", "金手套奖"),
      ],
    });
    render(<BannerTabs current="top_wins_the_world_cup" />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getByText("热门市场")).toBeInTheDocument();
    expect(screen.getByText("球员特别")).toBeInTheDocument();
    expect(screen.getByText("金球奖")).toBeInTheDocument();
    expect(screen.getByText("金靴奖")).toBeInTheDocument();
    expect(screen.getByText("金手套奖")).toBeInTheDocument();
  });

  it("list 数据缺失时降级到内置 fallbackLabel（英文）", () => {
    mockUseMarketBanners.mockReturnValue({ data: undefined });
    render(<BannerTabs current="top_wins_the_world_cup" />);
    expect(screen.getByText("HOT MARKET")).toBeInTheDocument();
    expect(screen.getByText("PLAYER SPECIAL")).toBeInTheDocument();
    expect(screen.getByText("GOLDEN BALL")).toBeInTheDocument();
    expect(screen.getByText("GOLDEN BOOT")).toBeInTheDocument();
    expect(screen.getByText("GOLDEN GLOVE")).toBeInTheDocument();
  });

  it("highlights current tab via aria-current", () => {
    render(<BannerTabs current="top_golden_ball_name" />);
    const golden = screen.getByRole("button", { name: /金球奖/ });
    expect(golden).toHaveAttribute("aria-current", "page");
  });

  it("non-current tabs do not have aria-current", () => {
    render(<BannerTabs current="top_wins_the_world_cup" />);
    const playerSpecial = screen.getByRole("button", { name: /球员特别/ });
    expect(playerSpecial).not.toHaveAttribute("aria-current");
  });

  it("clicking non-current tab navigates to corresponding banner detail", () => {
    render(<BannerTabs current="top_wins_the_world_cup" />);
    fireEvent.click(screen.getByRole("button", { name: /金球奖/ }));
    expect(mockPush).toHaveBeenCalledWith("/markets/banner/top_golden_ball_name");
  });

  it("clicking current tab does not trigger navigation", () => {
    render(<BannerTabs current="top_wins_the_world_cup" />);
    fireEvent.click(screen.getByRole("button", { name: /热门市场/ }));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("preserves Figma node id for traceability", () => {
    const { container } = render(<BannerTabs current="top_wins_the_world_cup" />);
    expect(container.querySelector('[data-figma-node="3550:73374"]')).toBeInTheDocument();
  });

  it("nav has overflow-x-auto for H5 horizontal scroll", () => {
    const { container } = render(<BannerTabs current="top_wins_the_world_cup" />);
    const nav = container.querySelector("nav");
    expect(nav?.className).toMatch(/overflow-x-auto/);
  });
});
