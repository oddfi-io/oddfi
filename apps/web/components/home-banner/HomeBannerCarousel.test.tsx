// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import HomeBannerCarousel, {
  nextLeftCardBoundary,
  offsetToActiveIndex,
} from "./HomeBannerCarousel";
import type { HomeBannerData } from "@/types/home-banner";

// Mock useMarketBanners 到可控的返回值；不依赖 TanStack Query / 网络
vi.mock("@/hooks/useMarketBanners", () => ({
  useMarketBanners: vi.fn(),
}));

// Mock next/navigation router (DD-085 / DD-143: PromoBannerCard click → router.push)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

// Mock next-intl：PromoBetCta 用 useTranslations 取「去竞猜」文案，单测无 i18n provider
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
import { useMarketBanners } from "@/hooks/useMarketBanners";
const mockUseMarketBanners = vi.mocked(useMarketBanners);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const makeBanner = (
  id: string,
  template:
    | "top_wins_the_world_cup"
    | "total_goals"
    | "top_golden_ball_name"
    | "top_golden_boot_name"
    | "top_golden_glove_name"
): HomeBannerData => ({
  banner_id: id,
  template_id: template,
  sort_order: 1,
  is_active: true,
  tag_text: "TAG",
  tag_color: "#000",
  title: "Title",
  subtitle: null,
  decoration_key: "world_cup_trophy",
  items: [
    {
      name: "BRAZIL",
      odds: 4.5,
      market_id: 10001,
      selection_id: 20001,
      bet_mode: ["single"],
      country_code: "BR",
      extra: { heat: 5 },
    },
  ],
});

// useQuery 返回结构（仅本测试关心的字段）
type QueryReturn = {
  data: HomeBannerData[] | undefined;
  isLoading: boolean;
  isError: boolean;
};
const setQuery = (overrides: Partial<QueryReturn>) => {
  mockUseMarketBanners.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useMarketBanners>);
};

describe("HomeBannerCarousel 状态机", () => {
  it("isLoading 时渲染 Skeleton（PC + H5 共用，无响应式隐藏）", () => {
    setQuery({ isLoading: true });
    const { container } = render(<HomeBannerCarousel />);
    expect(container.firstChild).not.toBeNull();
    // 3 张占位卡（HomeBannerSkeleton 内部固定 3 张 372×162，与新卡同尺寸防跳变）
    const placeholders = container.querySelectorAll('div[style*="width: 372px"]');
    expect(placeholders.length).toBe(3);
  });

  it("isError 时返回 null（整区不渲染）", () => {
    setQuery({ isError: true });
    const { container } = render(<HomeBannerCarousel />);
    expect(container.firstChild).toBeNull();
  });

  it("data 为空数组时返回 null", () => {
    setQuery({ data: [] });
    const { container } = render(<HomeBannerCarousel />);
    expect(container.firstChild).toBeNull();
  });

  it("data 为 undefined 时返回 null", () => {
    setQuery({ data: undefined });
    const { container } = render(<HomeBannerCarousel />);
    expect(container.firstChild).toBeNull();
  });

  it("有数据时三段克隆渲染（5 banner × 3 = 15 个 PromoBannerCard）", () => {
    const banners = [
      makeBanner("b1", "top_wins_the_world_cup"),
      makeBanner("b2", "total_goals"),
      makeBanner("b3", "top_golden_ball_name"),
      makeBanner("b4", "top_golden_boot_name"),
      makeBanner("b5", "top_golden_glove_name"),
    ];
    setQuery({ data: banners });
    const { container } = render(<HomeBannerCarousel />);
    // PromoBannerCard 外层 role=link（整卡可点）
    const cards = container.querySelectorAll('[role="link"]');
    expect(cards.length).toBe(15);
    // indicator 渲染（count>1）
    expect(container.querySelector(".justify-center")).not.toBeNull();
  });

  it("根容器在 H5 + PC 都渲染（无 hidden md:block 响应式隐藏）", () => {
    setQuery({ data: [makeBanner("b1", "top_wins_the_world_cup")] });
    const { container } = render(<HomeBannerCarousel />);
    const root = container.firstChild as HTMLElement | null;
    expect(root).not.toBeNull();
    const classes = root!.className.split(/\s+/);
    expect(classes).not.toContain("hidden");
    expect(classes).not.toContain("md:block");
    expect(classes).toContain("overflow-hidden");
    expect(classes).toContain("isolate");
  });

  it("根容器加 isolation: isolate（防 will-change-transform 污染父 stacking context）", () => {
    setQuery({ data: [makeBanner("b1", "top_wins_the_world_cup")] });
    const { container } = render(<HomeBannerCarousel />);
    const root = container.firstChild as HTMLElement | null;
    expect(root!.className).toContain("isolate");
  });

  it("track 容器加 will-change-transform（GPU compositing 提示）", () => {
    setQuery({ data: [makeBanner("b1", "top_wins_the_world_cup")] });
    const { container } = render(<HomeBannerCarousel />);
    expect(container.querySelector(".will-change-transform")).toBeInTheDocument();
  });

  it("track 初始 transform 定位中段（translateX(-sectionWidth)）", () => {
    const banners = [
      makeBanner("b1", "top_wins_the_world_cup"),
      makeBanner("b2", "total_goals"),
      makeBanner("b3", "top_golden_ball_name"),
    ];
    setQuery({ data: banners });
    const { container } = render(<HomeBannerCarousel />);
    const track = container.querySelector(".will-change-transform") as HTMLElement | null;
    expect(track).not.toBeNull();
    // sectionWidth = 3 * 388 = 1164
    expect(track!.style.transform).toBe("translateX(-1164px)");
  });
});

describe("HomeBannerCarousel 触摸手势", () => {
  const fiveBanners = () => [
    makeBanner("b1", "top_wins_the_world_cup"),
    makeBanner("b2", "total_goals"),
    makeBanner("b3", "top_golden_ball_name"),
    makeBanner("b4", "top_golden_boot_name"),
    makeBanner("b5", "top_golden_glove_name"),
  ];

  it("横向拖动跟手 → 松手后保持原位（不立即 snap），5s 后由下一次 tick 滑到边缘", () => {
    setQuery({ data: fiveBanners() });
    const { container } = render(<HomeBannerCarousel />);
    const root = container.firstChild as HTMLElement;
    const track = container.querySelector(".will-change-transform") as HTMLElement;
    // 初始 -sectionWidth = -5 * 388 = -1940
    expect(track.style.transform).toBe("translateX(-1940px)");

    // 向左拖 200px（dx = -200）
    fireEvent.touchStart(root, { touches: [{ clientX: 500, clientY: 200 }] });
    fireEvent.touchMove(root, { touches: [{ clientX: 300, clientY: 200 }] });
    // 拖动期间实时跟随
    expect(track.style.transform).toBe("translateX(-2140px)");

    fireEvent.touchEnd(root, {
      touches: [],
      changedTouches: [{ clientX: 300, clientY: 200 }],
    });
    // 不立即 snap：保持拖动末位置（无 wrap 越界，等价位置 -2140）
    expect(track.style.transform).toBe("translateX(-2140px)");
  });

  it("nextLeftCardBoundary：对齐位置返回再左一卡，未对齐位置返回当前左侧最近边缘", () => {
    // tick 内部用此公式：手势 5s 后下一次 tick 借此自动 snap 到卡片边缘（cardWidth=388）
    expect(nextLeftCardBoundary(-1940)).toBe(-2328); // 对齐 → 再向左一卡
    expect(nextLeftCardBoundary(-2140)).toBe(-2328); // 中段 → snap 回 -2328（距离 188 < 388）
    expect(nextLeftCardBoundary(-2327)).toBe(-2328); // 紧挨边缘 → snap 回 -2328（距离 1）
    expect(nextLeftCardBoundary(-2328)).toBe(-2716); // 对齐 → 再向左一卡
    expect(nextLeftCardBoundary(0)).toBe(-388);
  });

  it("纵向滑动占优 → 不触发拖动，让浏览器处理页面滚动", () => {
    setQuery({ data: fiveBanners() });
    const { container } = render(<HomeBannerCarousel />);
    const root = container.firstChild as HTMLElement;
    const track = container.querySelector(".will-change-transform") as HTMLElement;
    const initial = track.style.transform;

    fireEvent.touchStart(root, { touches: [{ clientX: 100, clientY: 100 }] });
    // dx=5（< 阈值），dy=150（纵向占优）
    fireEvent.touchMove(root, { touches: [{ clientX: 105, clientY: 250 }] });
    fireEvent.touchEnd(root, {
      touches: [],
      changedTouches: [{ clientX: 105, clientY: 250 }],
    });

    expect(track.style.transform).toBe(initial);
  });

  it("微动（< 8px 阈值）→ 视为 tap，不触发拖动", () => {
    setQuery({ data: fiveBanners() });
    const { container } = render(<HomeBannerCarousel />);
    const root = container.firstChild as HTMLElement;
    const track = container.querySelector(".will-change-transform") as HTMLElement;
    const initial = track.style.transform;

    fireEvent.touchStart(root, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(root, { touches: [{ clientX: 103, clientY: 102 }] });
    fireEvent.touchEnd(root, {
      touches: [],
      changedTouches: [{ clientX: 103, clientY: 102 }],
    });

    expect(track.style.transform).toBe(initial);
  });

  it("根容器加 touch-pan-y（让浏览器接管纵向滚动）", () => {
    setQuery({ data: [makeBanner("b1", "top_wins_the_world_cup")] });
    const { container } = render(<HomeBannerCarousel />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("touch-pan-y");
  });
});

describe("offsetToActiveIndex（indicator 推导纯函数）", () => {
  const CW = 388;
  const N = 5;

  it("对齐边缘逐卡递增（0..N-1）", () => {
    expect(offsetToActiveIndex(0, CW, N)).toBe(0);
    expect(offsetToActiveIndex(-CW, CW, N)).toBe(1);
    expect(offsetToActiveIndex(-2 * CW, CW, N)).toBe(2);
    expect(offsetToActiveIndex(-4 * CW, CW, N)).toBe(4);
  });

  it("初始定位中段 offset=-sectionWidth(-5*388) → index 0", () => {
    expect(offsetToActiveIndex(-N * CW, CW, N)).toBe(0);
  });

  it("越过 N 边界后对 N 取模回环（第 6 卡 = index 1）", () => {
    expect(offsetToActiveIndex(-6 * CW, CW, N)).toBe(1);
    expect(offsetToActiveIndex(-10 * CW, CW, N)).toBe(0);
  });

  it("归一不闪：offset 与 offset±sectionWidth(=N*388) 返回同 index", () => {
    const sectionWidth = N * CW;
    for (const base of [-1234, -2328, -3880, -500]) {
      expect(offsetToActiveIndex(base, CW, N)).toBe(
        offsetToActiveIndex(base + sectionWidth, CW, N)
      );
      // tick 归一阈值 -2*sectionWidth 处归一 +sectionWidth：前后同 index
      expect(offsetToActiveIndex(base - sectionWidth, CW, N)).toBe(
        offsetToActiveIndex(base, CW, N)
      );
    }
  });

  it("拖动到非对齐位置 round 就近取卡", () => {
    expect(offsetToActiveIndex(-193, CW, N)).toBe(0); // 0.497 卡 → round 0
    expect(offsetToActiveIndex(-195, CW, N)).toBe(1); // 0.503 卡 → round 1
  });

  it("n<=0 防御返回 0（不 NaN）", () => {
    expect(offsetToActiveIndex(-100, CW, 0)).toBe(0);
  });
});
