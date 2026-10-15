// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import FilterItem from "./FilterItem";

describe("FilterItem", () => {
  afterEach(cleanup);

  it("renders label", () => {
    render(<FilterItem label="热度" />);
    expect(screen.getByText("热度")).toBeInTheDocument();
  });

  it("default state has data-sort='default'", () => {
    render(<FilterItem label="热度" />);
    expect(screen.getByRole("button")).toHaveAttribute("data-sort", "default");
  });

  it("respects defaultSort prop (uncontrolled)", () => {
    render(<FilterItem label="热度" defaultSort="asc" />);
    expect(screen.getByRole("button")).toHaveAttribute("data-sort", "asc");
  });

  it("cycles default → asc → desc → default on clicks", () => {
    const onChange = vi.fn();
    render(<FilterItem label="赔率" onChange={onChange} />);
    const btn = screen.getByRole("button");

    fireEvent.click(btn);
    expect(btn).toHaveAttribute("data-sort", "asc");
    expect(onChange).toHaveBeenLastCalledWith("asc");

    fireEvent.click(btn);
    expect(btn).toHaveAttribute("data-sort", "desc");
    expect(onChange).toHaveBeenLastCalledWith("desc");

    fireEvent.click(btn);
    expect(btn).toHaveAttribute("data-sort", "default");
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("controlled mode: sort prop overrides internal state", () => {
    const onChange = vi.fn();
    const { rerender } = render(<FilterItem label="赔率" sort={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    // 受控：onChange 触发但 data-sort 不变（父组件未更新 sort prop）
    expect(onChange).toHaveBeenCalledWith("asc");
    expect(screen.getByRole("button")).toHaveAttribute("data-sort", "default");

    rerender(<FilterItem label="赔率" sort="asc" onChange={onChange} />);
    expect(screen.getByRole("button")).toHaveAttribute("data-sort", "asc");
  });

  it("preserves Figma node id for traceability", () => {
    const { container } = render(<FilterItem label="热度" />);
    expect(container.querySelector('[data-figma-node="3550:73551"]')).toBeInTheDocument();
  });
});
