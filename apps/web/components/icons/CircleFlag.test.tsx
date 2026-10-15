// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, cleanup } from "@testing-library/react";
import CircleFlag from "./CircleFlag";

describe("CircleFlag", () => {
  afterEach(cleanup);

  it("lowercases ISO code into asset path", () => {
    const { container } = render(<CircleFlag code="ES" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toContain("/images/flags/es.svg");
  });

  it("falls back GB-ENG to gb (until designer ships gb-eng variant)", () => {
    const { container } = render(<CircleFlag code="GB-ENG" />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("/images/flags/gb.svg");
  });

  it("respects size prop on width/height attributes", () => {
    const { container } = render(<CircleFlag code="br" size={24} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("width")).toBe("24");
    expect(img?.getAttribute("height")).toBe("24");
  });

  it("forwards className to the outer wrapper", () => {
    const { container } = render(<CircleFlag code="us" className="absolute" />);
    const wrapper = container.firstElementChild as HTMLElement | null;
    expect(wrapper?.tagName).toBe("SPAN");
    expect(wrapper?.className).toContain("absolute");
  });

  it("renders 2px bg-secondary border on the outer wrapper", () => {
    const { container } = render(<CircleFlag code="br" />);
    const wrapper = container.firstElementChild as HTMLElement | null;
    expect(wrapper?.className).toContain("border-2");
    expect(wrapper?.className).toContain("border-[var(--bg-secondary)]");
    expect(wrapper?.className).toContain("rounded-full");
  });
});
