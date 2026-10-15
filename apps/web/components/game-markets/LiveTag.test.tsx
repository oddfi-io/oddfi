// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import LiveTag from "./LiveTag";

describe("LiveTag", () => {
  it("渲染红底白「LIVE」标签", () => {
    const { getByText } = render(<LiveTag />);
    const label = getByText("LIVE");
    expect(label).toBeTruthy();
    // 红底 token（bg-fn-red）+ 白字 token（text-static-white）
    expect(label.className).toContain("text-static-white");
    expect(label.parentElement?.className).toContain("bg-fn-red");
  });
});
