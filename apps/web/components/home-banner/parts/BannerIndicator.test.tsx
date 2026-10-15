// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, cleanup } from "@testing-library/react";
import BannerIndicator from "./BannerIndicator";

afterEach(cleanup);

describe("BannerIndicator", () => {
  it("count<=1 不渲染（单卡无需指示）", () => {
    const { container } = render(<BannerIndicator count={1} activeIndex={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("count>1 渲染 72×3 轨道 + 40px 白滑块", () => {
    const { container } = render(<BannerIndicator count={5} activeIndex={0} />);
    const track = container.firstChild as HTMLElement;
    expect(track.className).toContain("w-[72px]");
    expect(track.className).toContain("bg-tertiary");
    const thumb = container.querySelector(".bg-white") as HTMLElement;
    expect(thumb).not.toBeNull();
    expect(thumb.style.width).toBe("40px");
  });

  it("activeIndex 决定滑块 left：0→0px, 中段, 末段→32px(72-40)", () => {
    const at = (idx: number) => {
      const { container } = render(<BannerIndicator count={5} activeIndex={idx} />);
      return (container.querySelector(".bg-white") as HTMLElement).style.left;
    };
    expect(at(0)).toBe("0px"); // 0/4 * 32
    expect(at(2)).toBe("16px"); // 2/4 * 32
    expect(at(4)).toBe("32px"); // 4/4 * 32
  });

  it("activeIndex 越界被 clamp 到 [0, count-1]", () => {
    const { container } = render(<BannerIndicator count={5} activeIndex={99} />);
    expect((container.querySelector(".bg-white") as HTMLElement).style.left).toBe("32px");
    cleanup();
    const { container: c2 } = render(<BannerIndicator count={5} activeIndex={-3} />);
    expect((c2.querySelector(".bg-white") as HTMLElement).style.left).toBe("0px");
  });

  it("滑块用 CSS transition 平滑滑动（非 WAAPI 状态生命周期，animation.md 例外）", () => {
    const { container } = render(<BannerIndicator count={5} activeIndex={1} />);
    const thumb = container.querySelector(".bg-white") as HTMLElement;
    expect(thumb.className).toContain("transition-[left]");
  });
});
