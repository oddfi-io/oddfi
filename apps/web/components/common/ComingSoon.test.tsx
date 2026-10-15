// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ComingSoon } from "./ComingSoon";

afterEach(cleanup);

describe("<ComingSoon />", () => {
  it("renders nothing when no title/subtitle/cta provided", () => {
    const { container } = render(<ComingSoon />);
    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("p")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });

  it("renders title and subtitle when provided", () => {
    render(<ComingSoon title="Hello" subtitle="World" />);
    expect(screen.getByRole("heading", { level: 1, name: "Hello" })).toBeInTheDocument();
    expect(screen.getByText("World")).toBeInTheDocument();
  });

  it("renders cta with label, onClick and data attributes", async () => {
    let clicked = false;
    render(
      <ComingSoon
        cta={{
          label: "Notify Me",
          onClick: () => {
            clicked = true;
          },
          dataAttrs: { "data-earlybird-gate": "" },
        }}
      />
    );
    const btn = screen.getByRole("button", { name: "Notify Me" });
    expect(btn).toHaveAttribute("data-earlybird-gate", "");
    btn.click();
    expect(clicked).toBe(true);
  });

  it("renders decorations and header slots", () => {
    render(
      <ComingSoon decorations={<div data-testid="deco" />} header={<div data-testid="header" />} />
    );
    expect(screen.getByTestId("deco")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toBeInTheDocument();
  });

  it("sets sectionId via data-section attribute", () => {
    const { container } = render(<ComingSoon sectionId="ai-agent-h5" />);
    expect(container.querySelector("section")).toHaveAttribute("data-section", "ai-agent-h5");
  });
});
