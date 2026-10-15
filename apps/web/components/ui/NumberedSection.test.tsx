// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NumberedSection from "./NumberedSection";

describe("NumberedSection", () => {
  it("渲染 index + title + subtitle + children", () => {
    render(
      <NumberedSection index={2} title="风险偏好" subtitle="0-10 精细调节">
        <div data-testid="child">field</div>
      </NumberedSection>
    );
    expect(screen.getByRole("heading", { level: 3 }).textContent).toContain("2.");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toContain("风险偏好");
    expect(screen.getByText("0-10 精细调节")).toBeDefined();
    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("没有 subtitle 时不渲染 <p>", () => {
    const { container } = render(
      <NumberedSection index={1} title="测试">
        <span>x</span>
      </NumberedSection>
    );
    expect(container.querySelector("p")).toBeNull();
  });

  it("className 正确合并到 section", () => {
    const { container } = render(
      <NumberedSection index={1} title="t" className="mt-8">
        <span>x</span>
      </NumberedSection>
    );
    expect(container.querySelector("section")?.className).toContain("mt-8");
  });
});
