// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import FilterBar from "./FilterBar";

describe("FilterBar (mutex state machine)", () => {
  afterEach(cleanup);

  it("renders default options (热度 active=asc + 赔率 default)", () => {
    render(<FilterBar />);
    expect(screen.getByRole("button", { name: /热度/ })).toHaveAttribute("data-sort", "asc");
    expect(screen.getByRole("button", { name: /赔率/ })).toHaveAttribute("data-sort", "default");
  });

  it("clicking active key cycles asc → desc → default", () => {
    const onChange = vi.fn();
    render(<FilterBar onChange={onChange} />);
    const popularity = screen.getByRole("button", { name: /热度/ });

    fireEvent.click(popularity);
    expect(popularity).toHaveAttribute("data-sort", "desc");
    expect(onChange).toHaveBeenLastCalledWith("popularity", "desc");

    fireEvent.click(popularity);
    expect(popularity).toHaveAttribute("data-sort", "default");
    expect(onChange).toHaveBeenLastCalledWith(null, null);
  });

  it("clicking inactive key resets the other to default and sets asc", () => {
    const onChange = vi.fn();
    render(<FilterBar onChange={onChange} />);
    const popularity = screen.getByRole("button", { name: /热度/ });
    const odds = screen.getByRole("button", { name: /赔率/ });

    // 初始：热度=asc, 赔率=default
    // 点赔率 → 赔率=asc, 热度被重置
    fireEvent.click(odds);
    expect(odds).toHaveAttribute("data-sort", "asc");
    expect(popularity).toHaveAttribute("data-sort", "default");
    expect(onChange).toHaveBeenLastCalledWith("odds", "asc");
  });

  it("after switching to odds, cycling on odds works as expected", () => {
    const onChange = vi.fn();
    render(<FilterBar onChange={onChange} />);
    const odds = screen.getByRole("button", { name: /赔率/ });

    fireEvent.click(odds); // → odds asc
    fireEvent.click(odds); // → odds desc
    expect(odds).toHaveAttribute("data-sort", "desc");
    fireEvent.click(odds); // → odds default
    expect(odds).toHaveAttribute("data-sort", "default");
  });

  it("respects defaultActiveKey=null (all idle)", () => {
    render(<FilterBar defaultActiveKey={null} />);
    expect(screen.getByRole("button", { name: /热度/ })).toHaveAttribute("data-sort", "default");
    expect(screen.getByRole("button", { name: /赔率/ })).toHaveAttribute("data-sort", "default");
  });

  it("renders custom options", () => {
    render(<FilterBar options={[{ key: "vol", label: "Volume" }]} defaultActiveKey={null} />);
    expect(screen.getByText("Volume")).toBeInTheDocument();
  });

  it("preserves Figma node id for traceability", () => {
    const { container } = render(<FilterBar />);
    expect(container.querySelector('[data-figma-node="3550:73550"]')).toBeInTheDocument();
  });

  it("applies H5 px-4 padding and gap-[12px] on the wrapper div", () => {
    const { container } = render(<FilterBar />);
    const wrapper = container.querySelector('[data-figma-node="3550:73550"]');
    expect(wrapper?.className).toContain("px-4");
    expect(wrapper?.className).toContain("gap-[12px]");
  });

  it("removes px-4 at md breakpoint (md:px-0 present)", () => {
    const { container } = render(<FilterBar />);
    const wrapper = container.querySelector('[data-figma-node="3550:73550"]');
    expect(wrapper?.className).toContain("md:px-0");
  });
});
