// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import TrendChartSection from "./TrendChartSection";
import { BANNER_DETAIL_FIXTURES } from "@/lib/banner-detail-fixtures";

// Mock lightweight-charts (imperative DOM lib, not suitable for jsdom unit tests)
vi.mock("lightweight-charts", () => ({
  createChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({ setData: vi.fn() })),
    timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
    remove: vi.fn(),
  })),
  LineSeries: {},
  ColorType: { Solid: "solid" },
}));

// Mock next/image (avoid jsdom Image loader issues)
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={typeof src === "string" ? src : ""} />
  ),
}));

// next-intl 桩化：CountdownPills 内部用 useTranslations，未传 label 时取 markets.bannerDetailEndIn
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("TrendChartSection", () => {
  afterEach(cleanup);

  it("renders title from list metadata", () => {
    render(
      <TrendChartSection
        title="2026 FIFA World Cup Winner"
        bannerCode="top_wins_the_world_cup"
        fixture={BANNER_DETAIL_FIXTURES.top_wins_the_world_cup}
      />
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/world cup winner/i);
  });

  it("does NOT render countdown pills when endTime is not provided", () => {
    render(
      <TrendChartSection
        title="X"
        bannerCode="top_wins_the_world_cup"
        fixture={BANNER_DETAIL_FIXTURES.top_wins_the_world_cup}
      />
    );
    expect(screen.queryByText(/^\d+D$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/bannerDetailEndIn/)).not.toBeInTheDocument();
  });

  it("renders countdown pills when endTime is provided and not expired", () => {
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    render(
      <TrendChartSection
        title="X"
        bannerCode="top_wins_the_world_cup"
        fixture={BANNER_DETAIL_FIXTURES.top_wins_the_world_cup}
        endTime={farFuture}
      />
    );
    // i18n key（实际渲染由 Provider 翻译为 "End in" / "截止还有" 等）
    expect(screen.getByText(/bannerDetailEndIn/)).toBeInTheDocument();
  });

  it("renders 4 legend items from fixture series", () => {
    render(
      <TrendChartSection
        title="X"
        bannerCode="top_wins_the_world_cup"
        fixture={BANNER_DETAIL_FIXTURES.top_wins_the_world_cup}
      />
    );
    const legend = screen.getByLabelText(/trend legend/i);
    expect(legend.querySelectorAll("li")).toHaveLength(4);
    expect(screen.getByText(/spain.*16\.15%/i)).toBeInTheDocument();
    expect(screen.getByText(/argentina.*8\.8%/i)).toBeInTheDocument();
  });

  it("uses dual-column figma node in default state", () => {
    const { container } = render(
      <TrendChartSection
        title="X"
        bannerCode="top_wins_the_world_cup"
        fixture={BANNER_DETAIL_FIXTURES.top_wins_the_world_cup}
      />
    );
    expect(container.querySelector('[data-figma-node="3550:74158"]')).toBeInTheDocument();
  });

  it("switches to single-column figma node when compact=true", () => {
    const { container } = render(
      <TrendChartSection
        title="X"
        bannerCode="top_wins_the_world_cup"
        fixture={BANNER_DETAIL_FIXTURES.top_wins_the_world_cup}
        compact
      />
    );
    expect(container.querySelector('[data-figma-node="3547:10031"]')).toBeInTheDocument();
  });

  it("applies H5 responsive classes when mobile=true (avatar size-10, title text-[16px])", () => {
    const { container } = render(
      <TrendChartSection
        title="H5 Title"
        bannerCode="top_wins_the_world_cup"
        fixture={BANNER_DETAIL_FIXTURES.top_wins_the_world_cup}
        mobile
      />
    );
    // section should have p-4 (H5 padding)
    const section = container.querySelector("section");
    expect(section?.className).toContain("p-4");
    // avatar wrapper should have size-10 (H5: 40px)
    const avatarWrapper = container.querySelector(".size-10");
    expect(avatarWrapper).toBeInTheDocument();
    // title should have text-[16px] (H5 font size)
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.className).toContain("text-[16px]");
  });

  it("renders chart with reduced height (178px) in mobile mode", () => {
    const { container } = render(
      <TrendChartSection
        title="X"
        bannerCode="top_wins_the_world_cup"
        fixture={BANNER_DETAIL_FIXTURES.top_wins_the_world_cup}
        mobile
      />
    );
    const chartContainer = container.querySelector('[data-testid="trend-chart-container"]');
    expect(chartContainer).toHaveStyle({ height: "178px" });
  });
});
