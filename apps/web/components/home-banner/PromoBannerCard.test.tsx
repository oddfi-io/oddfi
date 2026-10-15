// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import PromoBannerCard from "./PromoBannerCard";
import type { HomeBannerData, TemplateId } from "@/types/home-banner";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
// PromoBetCta 用 useTranslations 取「去竞猜」，单测 passthrough 返回 key
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
// next/image → 简单 img，保留 src/alt
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const makeBanner = (template: TemplateId, title = "夺冠盘标题"): HomeBannerData => ({
  banner_id: "b1",
  template_id: template,
  sort_order: 1,
  is_active: true,
  tag_text: "TAG",
  tag_color: "#000",
  title,
  subtitle: null,
  decoration_key: "world_cup_trophy",
  items: [],
});

describe("PromoBannerCard", () => {
  it("渲染后端 title", () => {
    render(
      <PromoBannerCard data={makeBanner("top_wins_the_world_cup", "谁将最终捧起大力神杯？")} />
    );
    expect(screen.getByText("谁将最终捧起大力神杯？")).toBeInTheDocument();
  });

  it("渲染「去竞猜」CTA（i18n key bannerPromoCta）", () => {
    render(<PromoBannerCard data={makeBanner("total_goals")} />);
    expect(screen.getByText("bannerPromoCta")).toBeInTheDocument();
  });

  it("按 template_id 主题渲染对应插画 + 标题色", () => {
    const { container } = render(<PromoBannerCard data={makeBanner("top_wins_the_world_cup")} />);
    expect(container.querySelector('img[src*="world_cup_trophy-v2"]')).not.toBeNull();
    // 金色标题（非 text-primary 白）
    expect(screen.getByText("夺冠盘标题")).toHaveStyle({ color: "#edb14f" });
  });

  it("不同 template 用不同插画与色（数据驱动）", () => {
    const { container } = render(<PromoBannerCard data={makeBanner("top_golden_ball_name")} />);
    expect(container.querySelector('img[src*="player_mvp-v2"]')).not.toBeNull();
    expect(screen.getByText("夺冠盘标题")).toHaveStyle({ color: "#3091e3" });
  });

  it("整卡 click → router.push 详情页（template_id 作 bannerCode）", () => {
    render(<PromoBannerCard data={makeBanner("top_golden_boot_name")} />);
    fireEvent.click(screen.getByRole("link"));
    expect(push).toHaveBeenCalledWith("/markets/banner/top_golden_boot_name");
  });

  it("键盘 Enter / Space 等价 click（a11y）", () => {
    render(<PromoBannerCard data={makeBanner("top_golden_glove_name")} />);
    const card = screen.getByRole("link");
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    expect(push).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledWith("/markets/banner/top_golden_glove_name");
  });

  it("hover 描边色注入为 CSS 变量 --promo-hover-border", () => {
    render(<PromoBannerCard data={makeBanner("total_goals")} />);
    const card = screen.getByRole("link");
    expect(card.style.getPropertyValue("--promo-hover-border")).toBe("#199264");
    expect(card.className).toContain("hover:border-[var(--promo-hover-border)]");
  });

  it("未知 template_id（契约外）→ 返回 null 不崩溃", () => {
    const bad = { ...makeBanner("total_goals"), template_id: "unknown_xx" as TemplateId };
    const { container } = render(<PromoBannerCard data={bad} />);
    expect(container.firstChild).toBeNull();
  });
});
