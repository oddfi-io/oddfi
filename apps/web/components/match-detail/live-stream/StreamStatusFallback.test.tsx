// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import StreamStatusFallback from "./StreamStatusFallback";

describe("StreamStatusFallback", () => {
  it("渲染传入的 message", () => {
    const { getByText } = render(<StreamStatusFallback message="Live stream starting soon" />);
    expect(getByText("Live stream starting soon")).toBeTruthy();
  });

  it("aria-live=polite 便于轮询命中后无障碍播报", () => {
    const { container } = render(<StreamStatusFallback message="soon" />);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});
