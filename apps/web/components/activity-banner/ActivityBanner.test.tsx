// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ActivityBanner from "./ActivityBanner";

// next/image 在 jsdom 下走优化器会报错，桩成裸 img 隔离图片优化逻辑
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

const PROPS = {
  tag: "世界杯限时活动",
  lead: "每日 5 万 ODD",
  body: "注入质押池，按质押份额分配给参与用户",
};

describe("ActivityBanner", () => {
  it("渲染标签 + 双色正文（lead + body）", () => {
    render(<ActivityBanner {...PROPS} />);
    expect(screen.getByText(PROPS.tag)).toBeTruthy();
    expect(screen.getByText(PROPS.lead)).toBeTruthy();
    // body 前带一个空格（lead/body 之间分隔）
    expect(screen.getByText(PROPS.body, { exact: false })).toBeTruthy();
  });

  it("渲染 hero 图（PC 区）", () => {
    const { container } = render(<ActivityBanner {...PROPS} />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toContain("world-cup-hero");
  });

  it("传入 heroSrc 覆盖默认图", () => {
    const { container } = render(<ActivityBanner {...PROPS} heroSrc="/custom.png" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/custom.png");
  });

  it("点击关闭按钮后整条 banner 卸载（会话内可关）", () => {
    render(<ActivityBanner {...PROPS} />);
    const closeBtn = screen.getByRole("button", { name: "Dismiss" });
    fireEvent.click(closeBtn);
    expect(screen.queryByText(PROPS.tag)).toBeNull();
  });

  it("hero 图区默认 hidden（H5 不渲染图，仅 md: 显示）", () => {
    const { container } = render(<ActivityBanner {...PROPS} />);
    const heroWrap = container.querySelector("img")?.parentElement;
    expect(heroWrap?.className).toContain("hidden");
    expect(heroWrap?.className).toContain("md:block");
  });

  it("关闭按钮默认 hidden（H5 不渲染关闭按钮，仅 md: 显示）", () => {
    render(<ActivityBanner {...PROPS} />);
    const closeBtn = screen.getByRole("button", { name: "Dismiss" });
    expect(closeBtn.className).toContain("hidden");
    expect(closeBtn.className).toContain("md:flex");
  });
});
