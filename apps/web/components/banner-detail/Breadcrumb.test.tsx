// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Breadcrumb from "./Breadcrumb";

// next-intl 桩化：未传 label 时组件取 key markets.bannerDetailBack；测试内断言用 key 名
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("Breadcrumb", () => {
  afterEach(cleanup);

  it("未传 label 时显示 next-intl key（实际渲染由 Provider 翻译）", () => {
    render(<Breadcrumb />);
    const link = screen.getByRole("link", { name: /bannerDetailBack/i });
    expect(link).toHaveAttribute("href", "/markets");
    expect(link).toHaveTextContent("bannerDetailBack");
  });

  it("传入 label 时优先使用，覆盖 i18n 默认值", () => {
    render(<Breadcrumb href="/custom-path" label="Back" />);
    const link = screen.getByRole("link", { name: /back/i });
    expect(link).toHaveAttribute("href", "/custom-path");
    expect(link).toHaveTextContent("Back");
  });

  it("preserves Figma node id for traceability", () => {
    const { container } = render(<Breadcrumb />);
    expect(container.querySelector('[data-figma-node="3550:73356"]')).toBeInTheDocument();
  });

  it("link has min-h-[44px] touch target for H5 (mobile-h5 spec)", () => {
    render(<Breadcrumb />);
    const link = screen.getByRole("link");
    expect(link.className).toMatch(/min-h-\[44px\]/);
  });
});
