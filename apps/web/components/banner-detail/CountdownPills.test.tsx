// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import CountdownPills from "./CountdownPills";

// next-intl 桩化：未传 label 时组件取 key markets.bannerDetailEndIn；测试内断言用 key 名
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const SAMPLE = { days: 90, hours: 31, minutes: 31, seconds: 14 };

describe("CountdownPills", () => {
  afterEach(cleanup);

  it("renders all 4 D/H/M/S pills with values", () => {
    render(<CountdownPills countdown={SAMPLE} />);
    expect(screen.getByText("90D")).toBeInTheDocument();
    expect(screen.getByText("31H")).toBeInTheDocument();
    expect(screen.getByText("31M")).toBeInTheDocument();
    expect(screen.getByText("14S")).toBeInTheDocument();
  });

  it("未传 label 时显示 next-intl key（实际渲染由 Provider 翻译）", () => {
    render(<CountdownPills countdown={SAMPLE} />);
    expect(screen.getByText("bannerDetailEndIn")).toBeInTheDocument();
  });

  it("传入 label 时优先使用，覆盖 i18n 默认值", () => {
    render(<CountdownPills countdown={SAMPLE} label="Time left" />);
    expect(screen.getByText("Time left")).toBeInTheDocument();
  });

  it("renders 3 ':' separators between 4 pills", () => {
    const { container } = render(<CountdownPills countdown={SAMPLE} />);
    const sep = container.querySelectorAll('[aria-hidden="true"]');
    expect(sep).toHaveLength(3);
    sep.forEach((s) => expect(s).toHaveTextContent(":"));
  });

  it("preserves Figma node id for traceability", () => {
    const { container } = render(<CountdownPills countdown={SAMPLE} />);
    expect(container.querySelector('[data-figma-node="3550:74086"]')).toBeInTheDocument();
  });
});
